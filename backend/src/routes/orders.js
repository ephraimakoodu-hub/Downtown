import { Router } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import { withTransaction } from '../config/db.js';
import { HttpError, notFound } from '../utils/httpError.js';
import { mergeLines, priceOrder } from '../utils/orderPricing.js';
import { getSettings } from '../utils/settings.js';
import { itemsSchema } from './cart.js';
import { writeAudit } from '../middleware/audit.js';

const createSchema = z.object({
  items: itemsSchema,
  fulfilment: z.enum(['delivery', 'pickup']),
  contactPhone: z.string().trim().min(7).max(20).regex(/^[0-9+()\s-]+$/, 'Enter a valid phone number'),
  deliveryAddress: z.string().trim().min(5).max(300).optional(),
}).strict();

const refSchema = z.string().regex(/^[A-Z0-9]{12}$/);
const newRef = () => randomBytes(9).toString('base64').replace(/[^A-Za-z0-9]/g, 'X').toUpperCase().slice(0, 12).padEnd(12, 'A');

const publicOrder = (o) => ({
  ref: o.public_ref, status: o.status, fulfilment: o.fulfilment,
  subtotalKobo: Number(o.subtotal_kobo), deliveryFeeKobo: Number(o.delivery_fee_kobo), totalKobo: Number(o.total_kobo),
  createdAt: o.created_at,
});

export function ordersRouter(pool) {
  const r = Router();

  // Creates an order. Prices, fees and stock are decided on the server. Idempotency-Key prevents duplicate orders on retry.
  r.post('/', async (req, res, next) => {
    try {
      const key = z.string().regex(/^[\w-]{16,80}$/, 'Idempotency-Key header is required').parse(req.get('idempotency-key'));
      const body = createSchema.parse(req.body);
      if (body.fulfilment === 'delivery' && !body.deliveryAddress) {
        throw new HttpError(400, 'VALIDATION_FAILED', 'Enter a delivery address.', undefined);
      }
      const requestHash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
      const userId = req.user.id;

      const outcome = await withTransaction(pool, async (conn) => {
        // Claim the key. A duplicate key means this request already ran or is running.
        const [ins] = await conn.execute('INSERT IGNORE INTO idempotency_keys (user_id, idem_key, request_hash) VALUES (?, ?, ?)', [userId, key, requestHash]);
        if (!ins.affectedRows) {
          const [[prev]] = await conn.execute('SELECT request_hash, response_status, response_body FROM idempotency_keys WHERE user_id = ? AND idem_key = ? FOR UPDATE', [userId, key]);
          if (prev.request_hash !== requestHash) throw new HttpError(422, 'IDEMPOTENCY_MISMATCH', 'This request key was already used for a different order.');
          if (prev.response_status == null) throw new HttpError(409, 'IN_PROGRESS', 'This order is still being processed. Please wait a moment.');
          return { status: prev.response_status, body: typeof prev.response_body === 'string' ? JSON.parse(prev.response_body) : prev.response_body };
        }

        const settings = await getSettings(conn);
        if (body.fulfilment === 'delivery' && (!settings.deliveryEnabled || settings.deliveryFeeKobo == null)) {
          throw new HttpError(409, 'DELIVERY_UNAVAILABLE', 'Delivery is not available right now.');
        }
        if (body.fulfilment === 'pickup' && !settings.pickupEnabled) {
          throw new HttpError(409, 'PICKUP_UNAVAILABLE', 'Pickup is not available right now.');
        }
        const lines = mergeLines(body.items);
        if (lines.reduce((n, l) => n + l.quantity, 0) > settings.maxItemsPerOrder) {
          throw new HttpError(422, 'TOO_MANY_ITEMS', 'This order has too many items. Please split it into smaller orders.');
        }
        const [[loc]] = await conn.execute("SELECT id FROM locations WHERE is_active = 1 AND kind = 'store' ORDER BY id LIMIT 1");
        if (!loc) throw new HttpError(503, 'NO_LOCATION', 'Ordering is not set up yet.');

        // Lock rows in a fixed order (sorted by product id) to avoid deadlocks and overselling.
        const priced = [];
        const snapshot = [];
        for (const l of lines) {
          const [[p]] = await conn.execute('SELECT id, sku, name, price_kobo, is_published FROM products WHERE id = ?', [l.productId]);
          if (!p || !p.is_published) throw new HttpError(409, 'PRODUCT_UNAVAILABLE', 'One of the products in your cart is no longer available.', { productId: l.productId });
          const [[inv]] = await conn.execute('SELECT on_hand, reserved FROM inventory WHERE product_id = ? AND location_id = ? FOR UPDATE', [l.productId, loc.id]);
          if (!inv || inv.on_hand - inv.reserved < l.quantity) {
            throw new HttpError(409, 'INSUFFICIENT_STOCK', `Not enough stock for ${p.name}.`, { productId: l.productId });
          }
          await conn.execute('UPDATE inventory SET reserved = reserved + ? WHERE product_id = ? AND location_id = ?', [l.quantity, l.productId, loc.id]);
          priced.push({ unitPriceKobo: Number(p.price_kobo), quantity: l.quantity });
          snapshot.push({ ...l, name: p.name, sku: p.sku, unitPriceKobo: Number(p.price_kobo) });
        }
        const fee = body.fulfilment === 'delivery' ? settings.deliveryFeeKobo : 0;
        const totals = priceOrder(priced, fee);
        const ref = newRef();
        const [o] = await conn.execute(
          `INSERT INTO orders (public_ref, user_id, status, fulfilment, contact_phone, delivery_address, subtotal_kobo, delivery_fee_kobo, total_kobo, location_id)
           VALUES (?, ?, 'placed', ?, ?, ?, ?, ?, ?, ?)`,
          [ref, userId, body.fulfilment, body.contactPhone, body.fulfilment === 'delivery' ? body.deliveryAddress : null, totals.subtotalKobo, totals.deliveryFeeKobo, totals.totalKobo, loc.id]);
        for (const s of snapshot) {
          await conn.execute('INSERT INTO order_items (order_id, product_id, product_name, sku, unit_price_kobo, quantity) VALUES (?, ?, ?, ?, ?, ?)',
            [o.insertId, s.productId, s.name, s.sku, s.unitPriceKobo, s.quantity]);
        }
        await conn.execute("INSERT INTO order_status_history (order_id, from_status, to_status, changed_by) VALUES (?, NULL, 'placed', ?)", [o.insertId, userId]);
        const responseBody = { order: { ref, status: 'placed', fulfilment: body.fulfilment, ...totals } };
        await conn.execute('UPDATE idempotency_keys SET response_status = 201, response_body = ? WHERE user_id = ? AND idem_key = ?', [JSON.stringify(responseBody), userId, key]);
        return { status: 201, body: responseBody };
      });
      res.status(outcome.status).json(outcome.body);
    } catch (err) { next(err); }
  });

  r.get('/', async (req, res, next) => {
    try {
      const page = z.coerce.number().int().min(1).max(1000).default(1).parse(req.query.page);
      const [rows] = await pool.execute(
        `SELECT public_ref, status, fulfilment, subtotal_kobo, delivery_fee_kobo, total_kobo, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 20 OFFSET ${(page - 1) * 20}`, [req.user.id]);
      const [[c]] = await pool.execute('SELECT COUNT(*) AS n FROM orders WHERE user_id = ?', [req.user.id]);
      res.set('Cache-Control', 'no-store');
      res.json({ items: rows.map(publicOrder), page, pageSize: 20, total: Number(c.n) });
    } catch (err) { next(err); }
  });

  // Ownership is part of the query, so another customer's order looks identical to a missing one.
  r.get('/:ref', async (req, res, next) => {
    try {
      const ref = refSchema.parse(req.params.ref);
      const [[o]] = await pool.execute('SELECT * FROM orders WHERE public_ref = ? AND user_id = ?', [ref, req.user.id]);
      if (!o) throw notFound('We could not find that order.');
      const [items] = await pool.execute('SELECT product_name, sku, unit_price_kobo, quantity FROM order_items WHERE order_id = ?', [o.id]);
      const [history] = await pool.execute('SELECT to_status, created_at FROM order_status_history WHERE order_id = ? ORDER BY id', [o.id]);
      const [[pay]] = await pool.execute("SELECT COUNT(*) AS n FROM payments WHERE order_id = ? AND status = 'succeeded'", [o.id]);
      const [refunds] = await pool.execute('SELECT status, amount_kobo, created_at FROM refunds WHERE order_id = ? ORDER BY id DESC', [o.id]);
      res.set('Cache-Control', 'no-store');
      res.json({
        order: {
          ...publicOrder(o), contactPhone: o.contact_phone, deliveryAddress: o.delivery_address, paid: pay.n > 0,
          items: items.map((i) => ({ name: i.product_name, sku: i.sku, unitPriceKobo: Number(i.unit_price_kobo), quantity: i.quantity })),
          history: history.map((h) => ({ status: h.to_status, at: h.created_at })),
          refunds: refunds.map((f) => ({ status: f.status, amountKobo: Number(f.amount_kobo), at: f.created_at })),
        },
      });
    } catch (err) { next(err); }
  });

  // Customers may cancel their own order only before it is processed.
  r.post('/:ref/cancel', async (req, res, next) => {
    try {
      const ref = refSchema.parse(req.params.ref);
      await withTransaction(pool, async (conn) => {
        const [[o]] = await conn.execute('SELECT id, status, location_id FROM orders WHERE public_ref = ? AND user_id = ? FOR UPDATE', [ref, req.user.id]);
        if (!o) throw notFound('We could not find that order.');
        if (!['placed', 'confirmed'].includes(o.status)) throw new HttpError(409, 'CANNOT_CANCEL', 'This order can no longer be cancelled online. Please contact the supermarket.');
        const [items] = await conn.execute('SELECT product_id, quantity FROM order_items WHERE order_id = ? ORDER BY product_id', [o.id]);
        for (const i of items) await conn.execute('UPDATE inventory SET reserved = reserved - ? WHERE product_id = ? AND location_id = ?', [i.quantity, i.product_id, o.location_id]);
        await conn.execute("UPDATE orders SET status = 'cancelled' WHERE id = ?", [o.id]);
        await conn.execute("INSERT INTO order_status_history (order_id, from_status, to_status, changed_by) VALUES (?, ?, 'cancelled', ?)", [o.id, o.status, req.user.id]);
        await writeAudit(conn, { userId: req.user.id, action: 'order.cancel_by_customer', entity: 'order', entityId: o.id, requestId: req.id });
      });
      res.status(204).end();
    } catch (err) { next(err); }
  });

  r.post('/:ref/refund-request', async (req, res, next) => {
    try {
      const ref = refSchema.parse(req.params.ref);
      const body = z.object({ reason: z.string().trim().min(5).max(500) }).strict().parse(req.body);
      const [[o]] = await pool.execute('SELECT id, status, total_kobo FROM orders WHERE public_ref = ? AND user_id = ?', [ref, req.user.id]);
      if (!o) throw notFound('We could not find that order.');
      if (!['delivered', 'cancelled'].includes(o.status)) throw new HttpError(409, 'NOT_ELIGIBLE', 'A refund can be requested once the order is delivered or cancelled.');
      const [[open]] = await pool.execute("SELECT COUNT(*) AS n FROM refunds WHERE order_id = ? AND status IN ('requested','approved','paid')", [o.id]);
      if (open.n > 0) throw new HttpError(409, 'ALREADY_REQUESTED', 'A refund request already exists for this order.');
      await pool.execute('INSERT INTO refunds (order_id, requested_by, reason, amount_kobo) VALUES (?, ?, ?, ?)', [o.id, req.user.id, body.reason, o.total_kobo]);
      res.status(201).json({ status: 'requested' });
    } catch (err) { next(err); }
  });

  return r;
}
