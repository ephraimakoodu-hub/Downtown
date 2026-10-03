import { Router } from 'express';
import { cached } from '../lib/cache.js';

export function categoriesRouter(pool) {
  const r = Router();
  r.get('/', async (req, res, next) => {
    try {
      // Categories change rarely and are read on every storefront page, so a short server side cache
      // avoids re-querying MySQL on every request. Cleared explicitly when an admin adds a category.
      const items = await cached('categories', 30_000, async () => {
        const [rows] = await pool.execute(`SELECT c.id, c.parent_id, c.name, c.slug FROM categories c WHERE c.is_active = 1 ORDER BY c.name ASC LIMIT 500`);
        return rows.map((c) => ({ id: c.id, parentId: c.parent_id, name: c.name, slug: c.slug }));
      });
      res.set('Cache-Control', 'public, max-age=30');
      res.json({ items });
    } catch (err) { next(err); }
  });
  return r;
}
