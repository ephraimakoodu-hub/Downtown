
import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../utils/httpError.js';

const int = (max) => z.coerce.number().int().min(1).max(max);

const listSchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().trim().max(140).optional(),
  brand: int(1_000_000).optional(),
  minPrice: z.coerce.number().int().min(0).optional(), // kobo
  maxPrice: z.coerce.number().int().min(0).optional(), // kobo
  inStock: z.enum(['true']).optional(),
  sort: z.enum(['name', 'price_asc', 'price_desc', 'newest']).default('name'),
  page: int(10_000).default(1),
  pageSize: int(48).default(24),
});

const SORTS = {
  name: 'p.name ASC, p.id ASC',
  price_asc: 'p.price_kobo ASC, p.id ASC',
  price_desc: 'p.price_kobo DESC, p.id DESC',
  newest: 'p.created_at DESC, p.id DESC',
};

// Escape special characters used in SQL LIKE patterns.
const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');

// Availability is derived from inventory:
// on_hand minus reserved, summed across active locations.
const AVAILABLE_SQL = `COALESCE((
  SELECT SUM(i.on_hand - i.reserved)
  FROM inventory i
  JOIN locations l ON l.id = i.location_id AND l.is_active = 1
  WHERE i.product_id = p.id
), 0)`;

function stockState(available, threshold) {
  if (available <= 0) return 'out_of_stock';
  return available <= threshold ? 'low_stock' : 'in_stock';
}

export function productsRouter(pool) {
  const r = Router();

  // Public product listing
  r.get('/', async (req, res, next) => {
    try {
      const f = listSchema.parse(req.query);

      // Only show published products in active categories.
      const where = [
        'p.is_published = 1',
        'c.is_active = 1',
      ];

      const params = [];

      if (f.q) {
        where.push(
          '(MATCH(p.name) AGAINST(? IN NATURAL LANGUAGE MODE) OR p.sku = ? OR p.barcode = ? OR p.name LIKE ?)'
        );

        params.push(
          f.q,
          f.q,
          f.q,
          `${escapeLike(f.q)}%`
        );
      }

      if (f.category) {
        where.push('c.slug = ?');
        params.push(f.category);
      }

      if (f.brand) {
        where.push('p.brand_id = ?');
        params.push(f.brand);
      }

      if (f.minPrice != null) {
        where.push('p.price_kobo >= ?');
        params.push(f.minPrice);
      }

      if (f.maxPrice != null) {
        where.push('p.price_kobo <= ?');
        params.push(f.maxPrice);
      }

      if (f.inStock) {
        where.push(`${AVAILABLE_SQL} > 0`);
      }

      const from = `
        FROM products p
        JOIN categories c ON c.id = p.category_id
        LEFT JOIN brands b ON b.id = p.brand_id
      `;

      const whereSql = `WHERE ${where.join(' AND ')}`;

      // Page values are validated integers.
      const offset = (f.page - 1) * f.pageSize;

      const [[count]] = await pool.execute(
        `SELECT COUNT(*) AS total
         ${from}
         ${whereSql}`,
        params
      );

      const [rows] = await pool.execute(
        `SELECT
           p.id,
           p.sku,
           p.name,
           p.slug,
           p.price_kobo,
           p.compare_at_price_kobo,
           p.image_url,
           p.low_stock_threshold,
           c.name AS category,
           c.slug AS category_slug,
           b.name AS brand,
           ${AVAILABLE_SQL} AS available
         ${from}
         ${whereSql}
         ORDER BY ${SORTS[f.sort]}
         LIMIT ${f.pageSize}
         OFFSET ${offset}`,
        params
      );

      res.set('Cache-Control', 'public, max-age=30');

      res.json({
        items: rows.map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          slug: p.slug,
          priceKobo: Number(p.price_kobo),
          compareAtPriceKobo:
            p.compare_at_price_kobo == null
              ? null
              : Number(p.compare_at_price_kobo),
          imageUrl: p.image_url,
          category: p.category,
          categorySlug: p.category_slug,
          brand: p.brand,
          stock: stockState(
            Number(p.available),
            p.low_stock_threshold
          ),
        })),
        page: f.page,
        pageSize: f.pageSize,
        total: Number(count.total),
      });
    } catch (err) {
      next(err);
    }
  });

  // Public product details
  r.get('/:slug', async (req, res, next) => {
    try {
      const slug = z.string()
        .trim()
        .min(1)
        .max(220)
        .parse(req.params.slug);

      const [rows] = await pool.execute(
        `SELECT
           p.id,
           p.sku,
           p.barcode,
           p.name,
           p.slug,
           p.description,
           p.price_kobo,
           p.compare_at_price_kobo,
           p.image_url,
           p.low_stock_threshold,
           c.name AS category,
           c.slug AS category_slug,
           b.name AS brand,
           ${AVAILABLE_SQL} AS available
         FROM products p
         JOIN categories c ON c.id = p.category_id
         LEFT JOIN brands b ON b.id = p.brand_id
         WHERE p.slug = ?
           AND p.is_published = 1
           AND c.is_active = 1
         LIMIT 1`,
        [slug]
      );

      const p = rows[0];

      if (!p) {
        throw notFound('This product is not available.');
      }

      res.set('Cache-Control', 'public, max-age=30');

      res.json({
        product: {
          id: p.id,
          sku: p.sku,
          barcode: p.barcode,
          name: p.name,
          slug: p.slug,
          description: p.description,
          priceKobo: Number(p.price_kobo),
          compareAtPriceKobo:
            p.compare_at_price_kobo == null
              ? null
              : Number(p.compare_at_price_kobo),
          imageUrl: p.image_url,
          category: p.category,
          categorySlug: p.category_slug,
          brand: p.brand,
          stock: stockState(
            Number(p.available),
            p.low_stock_threshold
          ),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  return r;
}