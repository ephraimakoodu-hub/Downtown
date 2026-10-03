import { Router } from 'express';
import { z } from 'zod';
import { requirePermission as perm } from '../middleware/auth.js';
import { writeAudit } from '../middleware/audit.js';
import { withTransaction } from '../config/db.js';
import { HttpError, notFound } from '../utils/httpError.js';

// Public: approved reviews for a product. No personal details beyond the reviewer's first name.
export function publicReviewsRouter(pool) {
  const r = Router();
  r.get('/', async (req, res, next) => {
    try {
      const slug = z.string().trim().min(1).max(220).parse(req.query.product);
      const [[p]] = await pool.execute('SELECT id FROM products WHERE slug = ? AND is_published = 1', [slug]);
      if (!p) throw notFound('This product is not available.');
      const [rows] = await pool.execute(
        `SELECT rv.rating, rv.body, rv.created_at, u.full_name FROM reviews rv JOIN users u ON u.id = rv.user_id
          WHERE rv.product_id = ? AND rv.status = 'approved' ORDER BY rv.created_at DESC LIMIT 50`, [p.id]);
      const [[agg]] = await pool.execute("SELECT COUNT(*) AS n, AVG(rating) AS avg FROM reviews WHERE product_id = ? AND status = 'approved'", [p.id]);
      res.set('Cache-Control', 'public, max-age=30');
      res.json({
        count: Number(agg.n), average: agg.avg == null ? null : Math.round(Number(agg.avg) * 10) / 10,
        items: rows.map((rv) => ({ rating: rv.rating, body: rv.body, at: rv.created_at, name: (rv.full_name || '').split(' ')[0] || 'Customer' })),
      });
    } catch (e) { next(e); }
  });
  return r;
}

// Customer: submit a review, only for a product in an order that is actually theirs and delivered.
// The unique (order_id, product_id) key means the same purchase cannot be reviewed twice.
export function customerReviewsRouter(pool) {
  const r = Router();
  r.get('/eligible', async (req, res, next) => {
    try {
      const [rows] = await pool.execute(
        `SELECT oi.product_id, p.name, p.slug, o.public_ref AS order_ref
           FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id
          WHERE o.user_id = ? AND o.status = 'delivered'
            AND NOT EXISTS (SELECT 1 FROM reviews rv WHERE rv.order_id = o.id AND rv.product_id = oi.product_id)
          ORDER BY o.created_at DESC LIMIT 50`, [req.user.id]);
      res.set('Cache-Control', 'no-store');
      res.json({ items: rows.map((x) => ({ productId: x.product_id, name: x.name, slug: x.slug, orderRef: x.order_ref })) });
    } catch (e) { next(e); }
  });

  r.post('/', async (req, res, next) => {
    try {
      const b = z.object({ orderRef: z.string().regex(/^[A-Z0-9]{12}$/), productId: z.number().int().positive(), rating: z.number().int().min(1).max(5), body: z.string().trim().max(2000).optional() }).strict().parse(req.body);
      await withTransaction(pool, async (conn) => {
        const [[o]] = await conn.execute("SELECT id FROM orders WHERE public_ref = ? AND user_id = ? AND status = 'delivered'", [b.orderRef, req.user.id]);
        if (!o) throw new HttpError(409, 'NOT_ELIGIBLE', 'You can only review products from your own delivered orders.');
        const [[item]] = await conn.execute('SELECT 1 FROM order_items WHERE order_id = ? AND product_id = ?', [o.id, b.productId]);
        if (!item) throw new HttpError(409, 'NOT_ELIGIBLE', 'That product was not part of this order.');
        try {
          await conn.execute('INSERT INTO reviews (product_id, user_id, order_id, rating, body) VALUES (?, ?, ?, ?, ?)', [b.productId, req.user.id, o.id, b.rating, b.body || null]);
        } catch (err) {
          if (err?.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'ALREADY_REVIEWED', 'You have already reviewed this product from this order.');
          throw err;
        }
      });
      res.status(201).json({ status: 'pending' });
    } catch (e) { next(e); }
  });
  return r;
}

// Staff: moderation queue. A review only becomes public once approved.
export function adminReviewsRouter(pool) {
  const r = Router();
  r.get('/', perm(pool, 'reviews.moderate'), async (req, res, next) => {
    try {
      const status = z.enum(['pending', 'approved', 'rejected']).default('pending').parse(req.query.status || 'pending');
      const page = z.coerce.number().int().min(1).max(10000).default(1).parse(req.query.page);
      const [[c]] = await pool.execute('SELECT COUNT(*) AS n FROM reviews WHERE status = ?', [status]);
      const [rows] = await pool.execute(
        `SELECT rv.id, rv.rating, rv.body, rv.created_at, p.name AS product, u.full_name AS customer
           FROM reviews rv JOIN products p ON p.id = rv.product_id JOIN users u ON u.id = rv.user_id
          WHERE rv.status = ? ORDER BY rv.id LIMIT 25 OFFSET ${(page - 1) * 25}`, [status]);
      res.json({ items: rows.map((rv) => ({ id: rv.id, rating: rv.rating, body: rv.body, product: rv.product, customer: rv.customer, at: rv.created_at })), page, pageSize: 25, total: Number(c.n) });
    } catch (e) { next(e); }
  });
  r.post('/:id/decide', perm(pool, 'reviews.moderate'), async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const { decision } = z.object({ decision: z.enum(['approved', 'rejected']) }).strict().parse(req.body);
      await withTransaction(pool, async (conn) => {
        const [[rv]] = await conn.execute('SELECT status FROM reviews WHERE id = ? FOR UPDATE', [id]);
        if (!rv) throw notFound('Review not found.');
        if (rv.status !== 'pending') throw new HttpError(409, 'ALREADY_DECIDED', 'This review has already been moderated.');
        await conn.execute('UPDATE reviews SET status = ?, moderated_by = ?, moderated_at = NOW() WHERE id = ?', [decision, req.user.id, id]);
        await writeAudit(conn, { userId: req.user.id, action: 'review.decide', entity: 'review', entityId: id, changes: { decision }, requestId: req.id });
      });
      res.status(204).end();
    } catch (e) { next(e); }
  });
  return r;
}
