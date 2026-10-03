import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../middleware/auth.js';
import { writeAudit } from '../middleware/audit.js';
import { withTransaction } from '../config/db.js';
import { HttpError, notFound } from '../utils/httpError.js';

const adjustSchema = z.object({
  productId: z.number().int().positive(),
  locationId: z.number().int().positive(),
  delta: z.number().int().refine((n) => n !== 0, 'Change must not be zero').refine((n) => Math.abs(n) <= 100000),
  reason: z.enum(['received', 'damaged', 'expired', 'correction', 'return']),
  note: z.string().trim().max(255).optional(),
}).strict();

export function adminInventoryRouter(pool) {
  const r = Router();

  // Adjusts stock atomically. The row is locked so concurrent adjustments and reservations cannot interleave.
  r.post('/adjust', requirePermission(pool, 'inventory.adjust'), async (req, res, next) => {
    try {
      const b = adjustSchema.parse(req.body);
      const result = await withTransaction(pool, async (conn) => {
        const [rows] = await conn.execute(
          'SELECT on_hand, reserved FROM inventory WHERE product_id = ? AND location_id = ? FOR UPDATE',
          [b.productId, b.locationId],
        );
        let before = 0;
        if (rows.length) {
          before = rows[0].on_hand;
        } else {
          const [p] = await conn.execute('SELECT id FROM products WHERE id = ?', [b.productId]);
          const [l] = await conn.execute('SELECT id FROM locations WHERE id = ?', [b.locationId]);
          if (!p.length || !l.length) throw notFound('That product or location does not exist.');
          await conn.execute('INSERT INTO inventory (product_id, location_id, on_hand, reserved) VALUES (?, ?, 0, 0)', [b.productId, b.locationId]);
        }
        const after = before + b.delta;
        const reserved = rows.length ? rows[0].reserved : 0;
        if (after < reserved) {
          throw new HttpError(409, 'INSUFFICIENT_STOCK', 'This change would take stock below the amount already reserved for orders.');
        }
        await conn.execute('UPDATE inventory SET on_hand = ? WHERE product_id = ? AND location_id = ?', [after, b.productId, b.locationId]);
        await conn.execute(
          'INSERT INTO stock_movements (product_id, location_id, delta, reason, note, user_id) VALUES (?, ?, ?, ?, ?, ?)',
          [b.productId, b.locationId, b.delta, b.reason, b.note ?? null, req.user.id],
        );
        await writeAudit(conn, {
          userId: req.user.id, action: 'inventory.adjust', entity: 'inventory',
          entityId: `${b.productId}:${b.locationId}`, changes: { before, after, reason: b.reason }, requestId: req.id,
        });
        return { onHand: after, reserved };
      });
      res.json(result);
    } catch (err) { next(err); }
  });

  return r;
}
