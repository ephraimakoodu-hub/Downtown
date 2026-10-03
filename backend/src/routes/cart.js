import { Router } from 'express';
import { z } from 'zod';
import { mergeLines, priceOrder } from '../utils/orderPricing.js';
import { getSettings } from '../utils/settings.js';

export const itemsSchema = z.array(z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(50),
}).strict()).min(1).max(100);

// Prices a cart from database prices so the client can show accurate totals. Nothing is reserved here.
export function cartRouter(pool) {
  const r = Router();
  r.post('/quote', async (req, res, next) => {
    try {
      const { items, fulfilment } = z.object({ items: itemsSchema, fulfilment: z.enum(['delivery', 'pickup']).optional() }).strict().parse(req.body);
      const lines = mergeLines(items);
      const ids = lines.map((l) => l.productId);
      const [rows] = await pool.query(
        `SELECT p.id, p.name, p.slug, p.price_kobo, p.image_url, p.is_published,
                COALESCE((SELECT SUM(i.on_hand - i.reserved) FROM inventory i JOIN locations l ON l.id = i.location_id AND l.is_active = 1 WHERE i.product_id = p.id), 0) AS available
           FROM products p WHERE p.id IN (?)`, [ids]);
      const byId = new Map(rows.map((p) => [p.id, p]));
      const settings = await getSettings(pool);
      const out = [];
      const priced = [];
      for (const l of lines) {
        const p = byId.get(l.productId);
        const ok = p && p.is_published && Number(p.available) >= l.quantity;
        out.push({
          productId: l.productId, quantity: l.quantity, name: p?.name ?? null, slug: p?.slug ?? null, imageUrl: p?.image_url ?? null,
          unitPriceKobo: p ? Number(p.price_kobo) : null,
          problem: !p || !p.is_published ? 'unavailable' : Number(p.available) < l.quantity ? 'insufficient_stock' : null,
          available: p ? Math.max(0, Number(p.available)) : 0,
        });
        if (ok) priced.push({ unitPriceKobo: Number(p.price_kobo), quantity: l.quantity });
      }
      const fee = fulfilment === 'delivery' && settings.deliveryFeeKobo != null ? settings.deliveryFeeKobo : 0;
      res.json({ lines: out, ...priceOrder(priced, fee), deliveryEnabled: settings.deliveryEnabled, pickupEnabled: settings.pickupEnabled });
    } catch (err) { next(err); }
  });
  return r;
}
