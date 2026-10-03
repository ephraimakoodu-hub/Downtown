
import { Router } from 'express';
import { z } from 'zod';

import { requirePermission as perm } from '../middleware/auth.js';
import { writeAudit } from '../middleware/audit.js';
import { withTransaction } from '../config/db.js';
import { HttpError, notFound, forbidden } from '../utils/httpError.js';
import { canTransition, COMMIT_STATUSES } from '../utils/orderStatus.js';

const id = z.coerce.number().int().positive();
const page = z.coerce.number().int().min(1).max(10000).default(1);

const STATUSES = [
  'placed',
  'confirmed',
  'processing',
  'ready',
  'dispatched',
  'delivered',
  'cancelled',
];

export function adminOperationsRouter(pool) {
  const r = Router();

  // ---- Inventory list and low stock

  r.get('/inventory', perm(pool, 'inventory.read'), async (req, res, next) => {
    try {
      const q = z.object({
        q: z.string().trim().max(80).optional(),
        low: z.enum(['true']).optional(),
        page,
      }).parse(req.query);

      const where = ['1=1'];
      const params = [];

      if (q.q) {
        where.push('(p.name LIKE ? OR p.sku = ? OR p.barcode = ?)');
        params.push(
          `%${q.q.replace(/[\\%_]/g, '\\$&')}%`,
          q.q,
          q.q
        );
      }

      const having = q.low
        ? 'HAVING available <= p.low_stock_threshold'
        : '';

      const base = `
        FROM products p
        LEFT JOIN inventory i ON i.product_id = p.id
        WHERE ${where.join(' AND ')}
        GROUP BY p.id
        ${having}
      `;

      const [[c]] = await pool.execute(
        `SELECT COUNT(*) AS n
         FROM (
           SELECT p.id,
                  COALESCE(SUM(i.on_hand - i.reserved), 0) AS available
           ${base}
         ) t`,
        params
      );

      const [rows] = await pool.execute(
        `SELECT
           p.id,
           p.sku,
           p.name,
           p.low_stock_threshold,
           COALESCE(SUM(i.on_hand), 0) AS on_hand,
           COALESCE(SUM(i.reserved), 0) AS reserved,
           COALESCE(SUM(i.on_hand - i.reserved), 0) AS available
         ${base}
         ORDER BY available ASC, p.name
         LIMIT 25 OFFSET ${(q.page - 1) * 25}`,
        params
      );

      res.json({
        items: rows.map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          threshold: p.low_stock_threshold,
          onHand: Number(p.on_hand),
          reserved: Number(p.reserved),
          available: Number(p.available),
        })),
        page: q.page,
        pageSize: 25,
        total: Number(c.n),
      });
    } catch (e) {
      next(e);
    }
  });

  r.get('/locations', perm(pool, 'inventory.read'), async (req, res, next) => {
    try {
      const [rows] = await pool.execute(
        'SELECT id, name, kind FROM locations WHERE is_active = 1 ORDER BY name'
      );
      res.json({ items: rows });
    } catch (e) {
      next(e);
    }
  });

  // ---- Purchase orders

  r.get('/purchase-orders', perm(pool, 'purchasing.manage'), async (req, res, next) => {
    try {
      const pg = page.parse(req.query.page);

      const [rows] = await pool.execute(
        `SELECT po.id, po.status, po.created_at, s.name AS supplier
         FROM purchase_orders po
         JOIN suppliers s ON s.id = po.supplier_id
         ORDER BY po.id DESC
         LIMIT 25 OFFSET ${(pg - 1) * 25}`
      );

      const [[c]] = await pool.execute(
        'SELECT COUNT(*) AS n FROM purchase_orders'
      );

      res.json({
        items: rows,
        page: pg,
        pageSize: 25,
        total: Number(c.n),
      });
    } catch (e) {
      next(e);
    }
  });

  r.post('/purchase-orders', perm(pool, 'purchasing.manage'), async (req, res, next) => {
    try {
      const b = z.object({
        supplierId: z.number().int().positive(),
        items: z.array(
          z.object({
            productId: z.number().int().positive(),
            quantity: z.number().int().min(1).max(100000),
            unitCostKobo: z.number().int().min(0),
          }).strict()
        ).min(1).max(200),
      }).strict().parse(req.body);

      const pid = await withTransaction(pool, async (conn) => {
        const [ins] = await conn.execute(
          'INSERT INTO purchase_orders (supplier_id, created_by) VALUES (?, ?)',
          [b.supplierId, req.user.id]
        );

        for (const i of b.items) {
          await conn.execute(
            `INSERT INTO purchase_order_items
             (purchase_order_id, product_id, quantity, unit_cost_kobo)
             VALUES (?, ?, ?, ?)`,
            [ins.insertId, i.productId, i.quantity, i.unitCostKobo]
          );
        }

        await writeAudit(conn, {
          userId: req.user.id,
          action: 'purchase_order.create',
          entity: 'purchase_order',
          entityId: ins.insertId,
          requestId: req.id,
        });

        return ins.insertId;
      });

      res.status(201).json({ id: pid });
    } catch (e) {
      next(
        e?.code === 'ER_DUP_ENTRY'
          ? new HttpError(409, 'DUPLICATE', 'A product appears twice in this purchase order.')
          : e?.code === 'ER_NO_REFERENCED_ROW_2'
            ? new HttpError(400, 'BAD_REFERENCE', 'Supplier or product does not exist.')
            : e
      );
    }
  });

  r.post('/purchase-orders/:id/receive', perm(pool, 'purchasing.manage'), async (req, res, next) => {
    try {
      const poId = id.parse(req.params.id);

      const { locationId } = z.object({
        locationId: z.number().int().positive(),
      }).strict().parse(req.body);

      await withTransaction(pool, async (conn) => {
        const [[po]] = await conn.execute(
          'SELECT status FROM purchase_orders WHERE id = ? FOR UPDATE',
          [poId]
        );

        if (!po) throw notFound('Purchase order not found.');

        if (!['draft', 'sent'].includes(po.status)) {
          throw new HttpError(
            409,
            'ALREADY_CLOSED',
            'This purchase order is already received or cancelled.'
          );
        }

        const [items] = await conn.execute(
          `SELECT product_id, quantity
           FROM purchase_order_items
           WHERE purchase_order_id = ?
           ORDER BY product_id`,
          [poId]
        );

        for (const i of items) {
          await conn.execute(
            `INSERT INTO inventory
             (product_id, location_id, on_hand, reserved)
             VALUES (?, ?, ?, 0)
             ON DUPLICATE KEY UPDATE on_hand = on_hand + VALUES(on_hand)`,
            [i.product_id, locationId, i.quantity]
          );

          await conn.execute(
            `INSERT INTO stock_movements
             (product_id, location_id, delta, reason, note, user_id)
             VALUES (?, ?, ?, 'received', ?, ?)`,
            [
              i.product_id,
              locationId,
              i.quantity,
              `Purchase order ${poId}`,
              req.user.id,
            ]
          );
        }

        await conn.execute(
          "UPDATE purchase_orders SET status = 'received' WHERE id = ?",
          [poId]
        );

        await writeAudit(conn, {
          userId: req.user.id,
          action: 'purchase_order.receive',
          entity: 'purchase_order',
          entityId: poId,
          requestId: req.id,
        });
      });

      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  // ---- Orders

  r.get('/orders', perm(pool, 'orders.read'), async (req, res, next) => {
    try {
      const q = z.object({
        status: z.enum(STATUSES).optional(),
        page,
      }).parse(req.query);

      const w = q.status ? 'WHERE o.status = ?' : '';
      const params = q.status ? [q.status] : [];

      const [[c]] = await pool.execute(
        `SELECT COUNT(*) AS n FROM orders o ${w}`,
        params
      );

      const [rows] = await pool.execute(
        `SELECT
           o.public_ref,
           o.status,
           o.fulfilment,
           o.total_kobo,
           o.created_at,
           u.full_name
         FROM orders o
         JOIN users u ON u.id = o.user_id
         ${w}
         ORDER BY o.id DESC
         LIMIT 25 OFFSET ${(q.page - 1) * 25}`,
        params
      );

      res.json({
        items: rows.map((o) => ({
          ref: o.public_ref,
          status: o.status,
          fulfilment: o.fulfilment,
          totalKobo: Number(o.total_kobo),
          createdAt: o.created_at,
          customer: o.full_name,
        })),
        page: q.page,
        pageSize: 25,
        total: Number(c.n),
      });
    } catch (e) {
      next(e);
    }
  });

  r.get('/orders/:ref', perm(pool, 'orders.read'), async (req, res, next) => {
    try {
      const ref = z.string().regex(/^[A-Z0-9]{12}$/).parse(req.params.ref);

      const [[o]] = await pool.execute(
        `SELECT o.*, u.full_name, u.email
         FROM orders o
         JOIN users u ON u.id = o.user_id
         WHERE o.public_ref = ?`,
        [ref]
      );

      if (!o) throw notFound('Order not found.');

      const [items] = await pool.execute(
        `SELECT product_name, sku, unit_price_kobo, quantity
         FROM order_items
         WHERE order_id = ?`,
        [o.id]
      );

      res.json({
        order: {
          ref: o.public_ref,
          status: o.status,
          fulfilment: o.fulfilment,
          customer: o.full_name,
          email: o.email,
          phone: o.contact_phone,
          address: o.delivery_address,
          subtotalKobo: Number(o.subtotal_kobo),
          deliveryFeeKobo: Number(o.delivery_fee_kobo),
          totalKobo: Number(o.total_kobo),
          items: items.map((i) => ({
            name: i.product_name,
            sku: i.sku,
            unitPriceKobo: Number(i.unit_price_kobo),
            quantity: i.quantity,
          })),
        },
      });
    } catch (e) {
      next(e);
    }
  });

  // Stock is committed at ready/dispatched and released on cancellation.

  r.post('/orders/:ref/status', perm(pool, 'orders.manage'), async (req, res, next) => {
    try {
      const ref = z.string().regex(/^[A-Z0-9]{12}$/).parse(req.params.ref);

      const { status } = z.object({
        status: z.enum(STATUSES),
      }).strict().parse(req.body);

      await withTransaction(pool, async (conn) => {
        const [[o]] = await conn.execute(
          `SELECT id, status, fulfilment, location_id, stock_committed
           FROM orders
           WHERE public_ref = ?
           FOR UPDATE`,
          [ref]
        );

        if (!o) throw notFound('Order not found.');

        if (!canTransition(o.status, status, o.fulfilment)) {
          throw new HttpError(
            409,
            'INVALID_TRANSITION',
            `An order that is ${o.status} cannot be changed to ${status}.`
          );
        }

        const [items] = await conn.execute(
          `SELECT product_id, quantity
           FROM order_items
           WHERE order_id = ?
           ORDER BY product_id`,
          [o.id]
        );

        if (COMMIT_STATUSES.has(status) && !o.stock_committed) {
          for (const i of items) {
            await conn.execute(
              `UPDATE inventory
               SET on_hand = on_hand - ?, reserved = reserved - ?
               WHERE product_id = ? AND location_id = ?`,
              [i.quantity, i.quantity, i.product_id, o.location_id]
            );

            await conn.execute(
              `INSERT INTO stock_movements
               (product_id, location_id, delta, reason, note, user_id)
               VALUES (?, ?, ?, 'sale', ?, ?)`,
              [
                i.product_id,
                o.location_id,
                -i.quantity,
                `Order ${ref}`,
                req.user.id,
              ]
            );
          }

          await conn.execute(
            'UPDATE orders SET stock_committed = 1 WHERE id = ?',
            [o.id]
          );
        }

        if (status === 'cancelled' && !o.stock_committed) {
          for (const i of items) {
            await conn.execute(
              `UPDATE inventory
               SET reserved = reserved - ?
               WHERE product_id = ? AND location_id = ?`,
              [i.quantity, i.product_id, o.location_id]
            );
          }
        }

        await conn.execute(
          'UPDATE orders SET status = ? WHERE id = ?',
          [status, o.id]
        );

        await conn.execute(
          `INSERT INTO order_status_history
           (order_id, from_status, to_status, changed_by)
           VALUES (?, ?, ?, ?)`,
          [o.id, o.status, status, req.user.id]
        );

        await writeAudit(conn, {
          userId: req.user.id,
          action: 'order.status',
          entity: 'order',
          entityId: o.id,
          changes: { from: o.status, to: status },
          requestId: req.id,
        });
      });

      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  // ---- Refunds

  r.get('/refunds', perm(pool, 'orders.read'), async (req, res, next) => {
    try {
      const pg = page.parse(req.query.page);

      const [rows] = await pool.execute(
        `SELECT
           f.id,
           f.status,
           f.amount_kobo,
           f.reason,
           f.created_at,
           o.public_ref
         FROM refunds f
         JOIN orders o ON o.id = f.order_id
         ORDER BY f.id DESC
         LIMIT 25 OFFSET ${(pg - 1) * 25}`
      );

      const [[c]] = await pool.execute(
        'SELECT COUNT(*) AS n FROM refunds'
      );

      res.json({
        items: rows.map((f) => ({
          id: f.id,
          status: f.status,
          amountKobo: Number(f.amount_kobo),
          reason: f.reason,
          createdAt: f.created_at,
          orderRef: f.public_ref,
        })),
        page: pg,
        pageSize: 25,
        total: Number(c.n),
      });
    } catch (e) {
      next(e);
    }
  });

  r.post('/refunds/:id/decide', perm(pool, 'refunds.decide'), async (req, res, next) => {
    try {
      const fid = id.parse(req.params.id);

      const { decision } = z.object({
        decision: z.enum(['approved', 'rejected']),
      }).strict().parse(req.body);

      await withTransaction(pool, async (conn) => {
        const [[f]] = await conn.execute(
          'SELECT status FROM refunds WHERE id = ? FOR UPDATE',
          [fid]
        );

        if (!f) throw notFound('Refund request not found.');

        if (f.status !== 'requested') {
          throw new HttpError(
            409,
            'ALREADY_DECIDED',
            'This refund request has already been decided.'
          );
        }

        await conn.execute(
          'UPDATE refunds SET status = ?, decided_by = ? WHERE id = ?',
          [decision, req.user.id, fid]
        );

        await writeAudit(conn, {
          userId: req.user.id,
          action: 'refund.decide',
          entity: 'refund',
          entityId: fid,
          changes: { decision },
          requestId: req.id,
        });
      });

      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  // ---- Manual bank-transfer payment verification

  r.get('/payments', perm(pool, 'payments.manage'), async (req, res, next) => {
    try {
      const q = z.object({
        status: z.enum(['pending', 'succeeded', 'failed']).optional(),
        page,
      }).parse(req.query);

      const where = [
        "p.provider = 'manual'",
        "p.method = 'bank_transfer'",
      ];
      const params = [];

      if (q.status) {
        where.push('p.status = ?');
        params.push(q.status);
      }

      const whereSql = `WHERE ${where.join(' AND ')}`;

      const [[count]] = await pool.execute(
        `SELECT COUNT(*) AS n
         FROM payments p
         ${whereSql}`,
        params
      );

      const [rows] = await pool.execute(
        `SELECT
           p.id,
           p.order_id,
           p.provider_reference,
           p.amount_kobo,
           p.status,
           p.created_at,
           o.public_ref AS order_ref,
           o.total_kobo AS order_total_kobo,
           o.status AS order_status,
           u.full_name AS customer,
           u.email
         FROM payments p
         JOIN orders o ON o.id = p.order_id
         JOIN users u ON u.id = o.user_id
         ${whereSql}
         ORDER BY p.id DESC
         LIMIT 25 OFFSET ${(q.page - 1) * 25}`,
        params
      );

      res.json({
        items: rows.map((p) => ({
          id: p.id,
          orderRef: p.order_ref,
          customer: p.customer,
          email: p.email,
          transactionReference: p.provider_reference,
          amountKobo: Number(p.amount_kobo),
          orderTotalKobo: Number(p.order_total_kobo),
          orderStatus: p.order_status,
          status: p.status,
          createdAt: p.created_at,
        })),
        page: q.page,
        pageSize: 25,
        total: Number(count.n),
      });
    } catch (e) {
      next(e);
    }
  });

  r.post('/payments/:id/decide', perm(pool, 'payments.manage'), async (req, res, next) => {
    try {
      const paymentId = id.parse(req.params.id);

      const { decision } = z.object({
        decision: z.enum(['confirm', 'reject']),
      }).strict().parse(req.body);

      await withTransaction(pool, async (conn) => {
        const [[payment]] = await conn.execute(
          `SELECT
             p.id,
             p.order_id,
             p.amount_kobo,
             p.status,
             p.provider,
             p.method,
             o.total_kobo,
             o.status AS order_status
           FROM payments p
           JOIN orders o ON o.id = p.order_id
           WHERE p.id = ?
           FOR UPDATE`,
          [paymentId]
        );

        if (
          !payment ||
          payment.provider !== 'manual' ||
          payment.method !== 'bank_transfer'
        ) {
          throw notFound('Bank-transfer payment not found.');
        }

        if (payment.status !== 'pending') {
          throw new HttpError(
            409,
            'ALREADY_DECIDED',
            'This payment has already been decided.'
          );
        }

        if (decision === 'confirm') {
          if (payment.order_status === 'cancelled') {
            throw new HttpError(
              409,
              'ORDER_CANCELLED',
              'A payment for a cancelled order cannot be confirmed.'
            );
          }

          if (String(payment.amount_kobo) !== String(payment.total_kobo)) {
            throw new HttpError(
              409,
              'AMOUNT_MISMATCH',
              'The payment amount does not match the order total.'
            );
          }

          const [[existing]] = await conn.execute(
            `SELECT id
             FROM payments
             WHERE order_id = ?
               AND status = 'succeeded'
               AND id <> ?
             LIMIT 1
             FOR UPDATE`,
            [payment.order_id, paymentId]
          );

          if (existing) {
            throw new HttpError(
              409,
              'ORDER_ALREADY_PAID',
              'Another payment for this order has already been confirmed.'
            );
          }
        }

        const newStatus =
          decision === 'confirm' ? 'succeeded' : 'failed';

        await conn.execute(
          'UPDATE payments SET status = ? WHERE id = ?',
          [newStatus, paymentId]
        );

        await writeAudit(conn, {
          userId: req.user.id,
          action: 'payment.manual_transfer_decide',
          entity: 'payment',
          entityId: paymentId,
          changes: {
            from: 'pending',
            to: newStatus,
            orderId: payment.order_id,
          },
          requestId: req.id,
        });
      });

      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  // ---- People and audit

  r.get('/users', perm(pool, 'customers.read'), async (req, res, next) => {
    try {
      const pg = page.parse(req.query.page);

      const [rows] = await pool.execute(
        `SELECT
           u.id,
           u.email,
           u.full_name,
           u.is_active,
           r.name AS role,
           u.created_at
         FROM users u
         JOIN roles r ON r.id = u.role_id
         ORDER BY u.id DESC
         LIMIT 25 OFFSET ${(pg - 1) * 25}`
      );

      const [[c]] = await pool.execute(
        'SELECT COUNT(*) AS n FROM users'
      );

      res.json({
        items: rows.map((u) => ({
          id: u.id,
          email: u.email,
          fullName: u.full_name,
          isActive: !!u.is_active,
          role: u.role,
          createdAt: u.created_at,
        })),
        page: pg,
        pageSize: 25,
        total: Number(c.n),
      });
    } catch (e) {
      next(e);
    }
  });

  r.get('/roles', perm(pool, 'users.manage'), async (req, res, next) => {
    try {
      const [rows] = await pool.execute(
        'SELECT id, name FROM roles ORDER BY id'
      );
      res.json({ items: rows });
    } catch (e) {
      next(e);
    }
  });

  r.patch('/users/:id', perm(pool, 'users.manage'), async (req, res, next) => {
    try {
      const uid = id.parse(req.params.id);

      const b = z.object({
        roleId: z.number().int().positive().optional(),
        isActive: z.boolean().optional(),
      }).strict().refine((x) => Object.keys(x).length > 0).parse(req.body);

      if (uid === req.user.id) {
        throw forbidden('You cannot change your own role or status.');
      }

      await withTransaction(pool, async (conn) => {
        const [[u]] = await conn.execute(
          'SELECT role_id, is_active FROM users WHERE id = ? FOR UPDATE',
          [uid]
        );

        if (!u) throw notFound('User not found.');

        if (b.roleId != null) {
          const [[ro]] = await conn.execute(
            'SELECT id FROM roles WHERE id = ?',
            [b.roleId]
          );

          if (!ro) {
            throw new HttpError(400, 'BAD_ROLE', 'That role does not exist.');
          }
        }

        await conn.execute(
          'UPDATE users SET role_id = ?, is_active = ? WHERE id = ?',
          [
            b.roleId ?? u.role_id,
            b.isActive == null ? u.is_active : (b.isActive ? 1 : 0),
            uid,
          ]
        );

        await writeAudit(conn, {
          userId: req.user.id,
          action: 'user.update',
          entity: 'user',
          entityId: uid,
          changes: {
            roleId: [u.role_id, b.roleId ?? u.role_id],
            isActive: [
              !!u.is_active,
              b.isActive ?? !!u.is_active,
            ],
          },
          requestId: req.id,
        });
      });

      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  r.get('/audit-logs', perm(pool, 'audit.read'), async (req, res, next) => {
    try {
      const pg = page.parse(req.query.page);

      const [rows] = await pool.execute(
        `SELECT
           a.id,
           a.action,
           a.entity,
           a.entity_id,
           a.changes,
           a.created_at,
           u.full_name
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.user_id
         ORDER BY a.id DESC
         LIMIT 50 OFFSET ${(pg - 1) * 50}`
      );

      const [[c]] = await pool.execute(
        'SELECT COUNT(*) AS n FROM audit_logs'
      );

      res.json({
        items: rows.map((a) => ({
          id: a.id,
          action: a.action,
          entity: a.entity,
          entityId: a.entity_id,
          changes: typeof a.changes === 'string'
            ? JSON.parse(a.changes)
            : a.changes,
          at: a.created_at,
          by: a.full_name,
        })),
        page: pg,
        pageSize: 50,
        total: Number(c.n),
      });
    } catch (e) {
      next(e);
    }
  });

  // ---- Reports

  r.get('/reports/summary', perm(pool, 'reports.read'), async (req, res, next) => {
    try {
      const [byDay] = await pool.execute(
        `SELECT
           DATE(created_at) AS day,
           COUNT(*) AS orders,
           SUM(total_kobo) AS total
         FROM orders
         WHERE status <> 'cancelled'
           AND created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
         GROUP BY DATE(created_at)
         ORDER BY day`
      );

      const [status] = await pool.execute(
        'SELECT status, COUNT(*) AS n FROM orders GROUP BY status'
      );

      const [[low]] = await pool.execute(
        `SELECT COUNT(*) AS n
         FROM (
           SELECT p.id
           FROM products p
           LEFT JOIN inventory i ON i.product_id = p.id
           WHERE p.is_published = 1
           GROUP BY p.id
           HAVING COALESCE(SUM(i.on_hand - i.reserved), 0)
             <= MAX(p.low_stock_threshold)
         ) t`
      );

      const [[refunds]] = await pool.execute(
        "SELECT COUNT(*) AS n FROM refunds WHERE status = 'requested'"
      );

      res.json({
        salesByDay: byDay.map((d) => ({
          day: d.day,
          orders: Number(d.orders),
          totalKobo: Number(d.total),
        })),
        ordersByStatus: status.map((s) => ({
          status: s.status,
          count: Number(s.n),
        })),
        lowStockCount: Number(low.n),
        openRefunds: Number(refunds.n),
      });
    } catch (e) {
      next(e);
    }
  });

  // ---- Settings

  r.get('/settings', perm(pool, 'settings.manage'), async (req, res, next) => {
    try {
      const [rows] = await pool.execute(
        'SELECT setting_key, setting_value FROM settings ORDER BY setting_key'
      );
      res.json({ items: rows });
    } catch (e) {
      next(e);
    }
  });

  r.put('/settings', perm(pool, 'settings.manage'), async (req, res, next) => {
    try {
      const b = z.object({
        deliveryEnabled: z.boolean(),
        pickupEnabled: z.boolean(),
        deliveryFeeKobo: z.number().int().min(0).max(100_000_000).nullable(),
        maxItemsPerOrder: z.number().int().min(1).max(1000),
        bankTransferEnabled: z.boolean(),
        bankName: z.string().trim().max(100),
        bankAccountName: z.string().trim().max(120),
        bankAccountNumber: z.string().trim().max(20),
      }).strict().superRefine((data, ctx) => {
        if (data.deliveryEnabled && data.deliveryFeeKobo == null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['deliveryFeeKobo'],
            message: 'Set a delivery fee before enabling delivery.',
          });
        }

        if (data.bankTransferEnabled) {
          if (!data.bankName) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['bankName'],
              message: 'Enter the bank name.',
            });
          }

          if (!data.bankAccountName) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['bankAccountName'],
              message: 'Enter the account name.',
            });
          }

          if (!/^[0-9]{6,20}$/.test(data.bankAccountNumber)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['bankAccountNumber'],
              message: 'Enter a valid account number using 6 to 20 digits.',
            });
          }
        } else if (
          data.bankAccountNumber &&
          !/^[0-9]{6,20}$/.test(data.bankAccountNumber)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['bankAccountNumber'],
            message: 'Account number must contain 6 to 20 digits.',
          });
        }
      }).parse(req.body);

      await withTransaction(pool, async (conn) => {
        const set = (key, value) => conn.execute(
          `INSERT INTO settings (setting_key, setting_value, updated_by)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE
             setting_value = VALUES(setting_value),
             updated_by = VALUES(updated_by)`,
          [key, value == null ? null : String(value), req.user.id]
        );

        await set('delivery_enabled', b.deliveryEnabled);
        await set('pickup_enabled', b.pickupEnabled);
        await set('delivery_fee_kobo', b.deliveryFeeKobo);
        await set('max_items_per_order', b.maxItemsPerOrder);
        await set('bank_transfer_enabled', b.bankTransferEnabled);
        await set('bank_name', b.bankName);
        await set('bank_account_name', b.bankAccountName);
        await set('bank_account_number', b.bankAccountNumber);

        await writeAudit(conn, {
          userId: req.user.id,
          action: 'settings.update',
          entity: 'settings',
          changes: {
            deliveryEnabled: b.deliveryEnabled,
            pickupEnabled: b.pickupEnabled,
            deliveryFeeKobo: b.deliveryFeeKobo,
            maxItemsPerOrder: b.maxItemsPerOrder,
            bankTransferEnabled: b.bankTransferEnabled,
            bankName: b.bankName,
            bankAccountName: b.bankAccountName,
            bankAccountNumberUpdated: Boolean(b.bankAccountNumber),
          },
          requestId: req.id,
        });
      });

      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  return r;
}