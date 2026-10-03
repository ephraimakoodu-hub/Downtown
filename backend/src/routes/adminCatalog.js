import { Router } from 'express';
import { z } from 'zod';
import { requirePermission as perm } from '../middleware/auth.js';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { upload, uploadDir, verifyImageSignature } from '../lib/imageUpload.js';
import { HttpError as HE } from '../utils/httpError.js';
import { writeAudit } from '../middleware/audit.js';
import { withTransaction } from '../config/db.js';
import { HttpError, notFound } from '../utils/httpError.js';
import { slugify } from '../utils/slug.js';
import { cacheClear } from '../lib/cache.js';

const id = z.coerce.number().int().positive();
const page = z.coerce.number().int().min(1).max(10000).default(1);
const dupe = (err, msg) => (err?.code === 'ER_DUP_ENTRY' ? new HttpError(409, 'DUPLICATE', msg) : err);

const productBody = z.object({
  sku: z.string().trim().min(1).max(64),
  barcode: z.string().trim().max(64).nullable().optional(),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  categoryId: z.number().int().positive(),
  brandId: z.number().int().positive().nullable().optional(),
  supplierId: z.number().int().positive().nullable().optional(),
  priceKobo: z.number().int().min(0).max(1_000_000_000),
  compareAtPriceKobo: z.number().int().min(0).nullable().optional(),
  lowStockThreshold: z.number().int().min(0).max(100000).default(5),
  imageUrl: z.string().trim().max(500).refine((v) => v.startsWith('https://') || v.startsWith('/uploads/products/'), 'Image address must use https or be an uploaded image').nullable().optional(),
  imageSource: z.enum(['upload', 'url']).nullable().optional(),
  imageRightsConfirmed: z.boolean().default(false),
  imageCredit: z.string().trim().max(255).nullable().optional(),
  isPublished: z.boolean().default(false),
}).strict().refine((b) => b.compareAtPriceKobo == null || b.compareAtPriceKobo >= b.priceKobo, { message: 'Original price must not be lower than the price', path: ['compareAtPriceKobo'] });

const cols = (b) => [b.sku, b.barcode || null, b.name, b.description ?? null, b.categoryId, b.brandId ?? null, b.supplierId ?? null, b.priceKobo, b.compareAtPriceKobo ?? null, b.lowStockThreshold, b.imageUrl ?? null, b.imageSource ?? null, b.imageRightsConfirmed ? 1 : 0, b.imageCredit ?? null, b.isPublished ? 1 : 0];

export function adminCatalogRouter(pool) {
  const r = Router();

  r.get('/products', perm(pool, 'products.read'), async (req, res, next) => {
    try {
      const q = z.object({ q: z.string().trim().max(80).optional(), page, published: z.enum(['true', 'false']).optional() }).parse(req.query);
      const where = []; const params = [];
      if (q.q) { where.push('(p.name LIKE ? OR p.sku = ? OR p.barcode = ?)'); params.push(`%${q.q.replace(/[\\%_]/g, '\\$&')}%`, q.q, q.q); }
      if (q.published) { where.push('p.is_published = ?'); params.push(q.published === 'true' ? 1 : 0); }
      const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const [[c]] = await pool.execute(`SELECT COUNT(*) AS n FROM products p ${w}`, params);
      const [rows] = await pool.execute(
        `SELECT p.id, p.sku, p.barcode, p.name, p.price_kobo, p.is_published, c.name AS category,
                COALESCE((SELECT SUM(i.on_hand) FROM inventory i WHERE i.product_id = p.id), 0) AS on_hand
           FROM products p JOIN categories c ON c.id = p.category_id ${w} ORDER BY p.name, p.id LIMIT 25 OFFSET ${(q.page - 1) * 25}`, params);
      res.json({ items: rows.map((p) => ({ id: p.id, sku: p.sku, barcode: p.barcode, name: p.name, priceKobo: Number(p.price_kobo), isPublished: !!p.is_published, category: p.category, onHand: Number(p.on_hand) })), page: q.page, pageSize: 25, total: Number(c.n) });
    } catch (e) { next(e); }
  });

  r.get('/products/:id', perm(pool, 'products.read'), async (req, res, next) => {
    try {
      const [[p]] = await pool.execute('SELECT * FROM products WHERE id = ?', [id.parse(req.params.id)]);
      if (!p) throw notFound('Product not found.');
      res.json({ product: { id: p.id, sku: p.sku, barcode: p.barcode, name: p.name, description: p.description, categoryId: p.category_id, brandId: p.brand_id, supplierId: p.supplier_id, priceKobo: Number(p.price_kobo), compareAtPriceKobo: p.compare_at_price_kobo == null ? null : Number(p.compare_at_price_kobo), lowStockThreshold: p.low_stock_threshold, imageUrl: p.image_url, imageSource: p.image_source, imageRightsConfirmed: !!p.image_rights_confirmed, imageCredit: p.image_credit, isPublished: !!p.is_published } });
    } catch (e) { next(e); }
  });

  r.post('/products', perm(pool, 'products.write'), async (req, res, next) => {
    try {
      const b = productBody.parse(req.body);
      const out = await withTransaction(pool, async (conn) => {
        const base = slugify(b.name) || 'product';
        const slug = `${base}-${b.sku.toLowerCase().replace(/[^a-z0-9]/g, '')}`.slice(0, 200);
        const [ins] = await conn.execute(
          'INSERT INTO products (sku, barcode, name, description, category_id, brand_id, supplier_id, price_kobo, compare_at_price_kobo, low_stock_threshold, image_url, image_source, image_rights_confirmed, image_credit, is_published, slug) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [...cols(b), slug]);
        await writeAudit(conn, { userId: req.user.id, action: 'product.create', entity: 'product', entityId: ins.insertId, changes: { sku: b.sku, priceKobo: b.priceKobo }, requestId: req.id });
        return ins.insertId;
      });
      res.status(201).json({ id: out });
    } catch (e) { next(dupe(e, 'A product with this SKU, barcode or name already exists.')); }
  });

  r.put('/products/:id', perm(pool, 'products.write'), async (req, res, next) => {
    try {
      const pid = id.parse(req.params.id);
      const b = productBody.parse(req.body);
      await withTransaction(pool, async (conn) => {
        const [[old]] = await conn.execute('SELECT price_kobo, is_published FROM products WHERE id = ? FOR UPDATE', [pid]);
        if (!old) throw notFound('Product not found.');
        await conn.execute(
          'UPDATE products SET sku=?, barcode=?, name=?, description=?, category_id=?, brand_id=?, supplier_id=?, price_kobo=?, compare_at_price_kobo=?, low_stock_threshold=?, image_url=?, image_source=?, image_rights_confirmed=?, image_credit=?, is_published=? WHERE id=?',
          [...cols(b), pid]);
        await writeAudit(conn, { userId: req.user.id, action: 'product.update', entity: 'product', entityId: pid,
          changes: { priceKobo: [Number(old.price_kobo), b.priceKobo], published: [!!old.is_published, b.isPublished] }, requestId: req.id });
      });
      res.status(204).end();
    } catch (e) { next(dupe(e, 'A product with this SKU or barcode already exists.')); }
  });

  // Staff upload a product photo here first, then reference the returned URL in the product form.
  // Rights confirmation is a checkbox the staff member ticks; it records that they attest to having
  // permission to use the image, it does not verify licensing on its own.
  r.post('/product-images', perm(pool, 'products.write'), (req, res, next) => {
    upload.single('image')(req, res, async (err) => {
      try {
        if (err) throw (err instanceof HttpError ? err : new HE(400, 'UPLOAD_FAILED', err.message || 'The image could not be uploaded.'));
        if (!req.file) throw new HE(400, 'NO_FILE', 'Choose an image file to upload.');
        const rightsConfirmed = req.body.rightsConfirmed === 'true';
        if (!rightsConfirmed) { await unlink(req.file.path).catch(() => {}); throw new HE(400, 'RIGHTS_NOT_CONFIRMED', 'Confirm the business has the right to use this image before uploading it.'); }
        const ok = await verifyImageSignature(req.file.path, req.file.mimetype);
        if (!ok) { await unlink(req.file.path).catch(() => {}); throw new HE(415, 'BAD_FILE_CONTENT', 'This file does not look like a valid image of its claimed type.'); }
        res.status(201).json({ url: `/uploads/products/${path.basename(req.file.path)}`, source: 'upload', credit: (req.body.credit || '').slice(0, 255) || null });
      } catch (e) { next(e); }
    });
  });

  // Simple named lookups share one pattern.
  for (const [path, table, permission, extra] of [['categories', 'categories', 'products.write', true], ['brands', 'brands', 'products.write', false], ['suppliers', 'suppliers', 'suppliers.manage', false]]) {
    const readPerm = table === 'suppliers' ? 'suppliers.manage' : 'products.read';
    r.get(`/${path}`, perm(pool, readPerm), async (req, res, next) => {
      try {
        const [rows] = await pool.query(`SELECT * FROM ${table} ORDER BY name LIMIT 500`);
        res.json({ items: rows });
      } catch (e) { next(e); }
    });
    r.post(`/${path}`, perm(pool, permission), async (req, res, next) => {
      try {
        const shape = table === 'suppliers'
          ? z.object({ name: z.string().trim().min(2).max(160), contactName: z.string().trim().max(120).optional(), phone: z.string().trim().max(30).optional(), email: z.string().trim().email().max(254).optional() }).strict()
          : z.object({ name: z.string().trim().min(2).max(120), parentId: z.number().int().positive().nullable().optional() }).strict();
        const b = shape.parse(req.body);
        const rid = await withTransaction(pool, async (conn) => {
          let ins;
          if (table === 'suppliers') [ins] = await conn.execute('INSERT INTO suppliers (name, contact_name, phone, email) VALUES (?,?,?,?)', [b.name, b.contactName ?? null, b.phone ?? null, b.email ?? null]);
          else if (extra) { [ins] = await conn.execute('INSERT INTO categories (name, slug, parent_id) VALUES (?,?,?)', [b.name, slugify(b.name) || 'category', b.parentId ?? null]); cacheClear('categories'); }
          else [ins] = await conn.execute('INSERT INTO brands (name) VALUES (?)', [b.name]);
          await writeAudit(conn, { userId: req.user.id, action: `${table}.create`, entity: table, entityId: ins.insertId, changes: { name: b.name }, requestId: req.id });
          return ins.insertId;
        });
        res.status(201).json({ id: rid });
      } catch (e) { next(dupe(e, 'That name already exists.')); }
    });
  }
  return r;
}
