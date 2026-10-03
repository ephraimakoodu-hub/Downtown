import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, formatNaira } from '../../lib/api.js';
import { useFetch } from '../../lib/useFetch.js';
import { nairaToKobo, koboToInput } from '../../lib/format.js';
import DataTable, { Pager } from '../../components/DataTable.jsx';
import { useAuth, can } from '../../lib/auth.jsx';

export function ProductList() {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const { status, data, error, retry } = useFetch(`/admin/products?page=${page}${term ? `&q=${encodeURIComponent(term)}` : ''}`);
  return (
    <>
      <div className="toolbar"><h1>Products</h1>{can(user, 'products.write') && <Link className="btn" to="/admin/products/new">Add a product</Link>}</div>
      <form className="header-search" role="search" onSubmit={(e) => { e.preventDefault(); setPage(1); setTerm(q.trim()); }}>
        <label className="visually-hidden" htmlFor="pq">Search products</label>
        <input id="pq" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, SKU or barcode" maxLength={80} />
        <button className="btn" type="submit">Search products</button>
      </form>
      <DataTable caption="products" status={status} error={error} onRetry={retry} rows={data?.items} rowKey={(r) => r.id}
        empty={{ title: term ? 'No products match your search' : 'No products yet', body: term ? 'Try a different name, SKU or barcode.' : 'Add categories first, then add your first product.' }}
        columns={[
          { key: 'name', label: 'Product', render: (r) => <Link to={`/admin/products/${r.id}`}>{r.name}</Link> },
          { key: 'sku', label: 'SKU' }, { key: 'category', label: 'Category' },
          { key: 'priceKobo', label: 'Price', render: (r) => formatNaira(r.priceKobo) },
          { key: 'onHand', label: 'On hand' },
          { key: 'isPublished', label: 'Status', render: (r) => (r.isPublished ? 'Published' : 'Draft') },
        ]} />
      <Pager data={data} page={page} setPage={setPage} />
    </>
  );
}


// Defined at module level so inputs keep focus while typing.
function Field({ ctx, name, label, type = 'text', hint, apiName, ...rest }) {
  const { f, set, fe } = ctx;
  return (
    <div className="field"><label htmlFor={`pf-${name}`}>{label}</label>
      <input id={`pf-${name}`} type={type} value={f[name]} onChange={set(name)} aria-invalid={!!fe(apiName || name)} aria-describedby={`pf-${name}-e`} {...rest} />
      {hint && <span className="muted">{hint}</span>}<span id={`pf-${name}-e`} className="error">{fe(apiName || name)}</span></div>
  );
}
function Select({ ctx, name, label, list, required }) {
  const { f, set } = ctx;
  return (
    <div className="field"><label htmlFor={`pf-${name}`}>{label}</label>
      <select id={`pf-${name}`} value={f[name]} onChange={set(name)} required={required}><option value="">{required ? 'Choose one' : 'None'}</option>{(list?.data?.items || []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
  );
}

function ImageField({ ctx, setF, setDirty, setError }) {
  const { f } = ctx;
  const [busy, setBusy] = useState(false);
  const [rightsChecked, setRightsChecked] = useState(false);
  const fileRef = useRef(null);

  async function uploadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!rightsChecked) { setError(new ApiError(400, { error: { message: 'Confirm the business has the right to use this image before uploading it.' } })); e.target.value = ''; return; }
    setBusy(true); setError(null);
    const body = new FormData();
    body.append('image', file);
    body.append('rightsConfirmed', 'true');
    try {
      const res = await fetch('/api/admin/product-images', { method: 'POST', credentials: 'include', body });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, data);
      setDirty(true);
      setF({ ...f, imageUrl: data.url, imageSource: 'upload', imageRightsConfirmed: true });
    } catch (err) { setError(err instanceof ApiError ? err : new ApiError(0, null)); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  return (
    <>
      {f.imageUrl && (
        <div className="image-preview">
          <img src={f.imageUrl} alt="" width="120" height="120" />
          <div>
            <p className="muted">{f.imageSource === 'upload' ? 'Uploaded image' : 'Linked image'}{f.imageRightsConfirmed ? ', rights confirmed' : ''}</p>
            <button className="btn btn-secondary" type="button" onClick={() => setF({ ...f, imageUrl: '', imageSource: null, imageRightsConfirmed: false, imageCredit: '' })}>Remove image</button>
          </div>
        </div>
      )}
      <label className="check"><input type="checkbox" checked={rightsChecked} onChange={(e) => setRightsChecked(e.target.checked)} /> The business owns this photo or has permission to use it</label>
      <div className="field">
        <label htmlFor="pf-upload">Upload a photo (JPEG, PNG or WebP, up to 5MB)</label>
        <input id="pf-upload" ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadFile} disabled={busy} />
      </div>
      <div className="field"><label htmlFor="pf-credit">Photo credit (optional)</label><input id="pf-credit" value={f.imageCredit} maxLength={255} onChange={(e) => setF({ ...f, imageCredit: e.target.value })} /></div>
      <p className="muted">Or link to a photo already hosted elsewhere:</p>
      <div className="field"><label htmlFor="pf-imageUrl">Image address (https)</label><input id="pf-imageUrl" type="url" value={f.imageSource === 'upload' ? '' : f.imageUrl} placeholder="https://" onChange={(e) => setF({ ...f, imageUrl: e.target.value, imageSource: e.target.value ? 'url' : null })} disabled={f.imageSource === 'upload'} /></div>
    </>
  );
}

const EMPTY = { sku: '', barcode: '', name: '', description: '', categoryId: '', brandId: '', supplierId: '', price: '', compareAt: '', lowStockThreshold: '5', imageUrl: '', imageSource: null, imageCredit: '', imageRightsConfirmed: false, isPublished: false };

export function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [f, setF] = useState(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const cats = useFetch('/admin/categories');
  const brands = useFetch('/admin/brands');
  const sups = useFetch('/admin/suppliers');
  const loaded = useFetch(editing ? `/admin/products/${id}` : '/categories');

  useEffect(() => {
    if (editing && loaded.status === 'ready') {
      const p = loaded.data.product;
      setF({ sku: p.sku, barcode: p.barcode || '', name: p.name, description: p.description || '', categoryId: String(p.categoryId), brandId: p.brandId ? String(p.brandId) : '', supplierId: p.supplierId ? String(p.supplierId) : '', price: koboToInput(p.priceKobo), compareAt: koboToInput(p.compareAtPriceKobo), lowStockThreshold: String(p.lowStockThreshold), imageUrl: p.imageUrl || '', imageSource: p.imageSource || null, imageCredit: p.imageCredit || '', imageRightsConfirmed: p.imageRightsConfirmed || false, isPublished: p.isPublished });
    }
  }, [editing, loaded.status, loaded.data]);
  useEffect(() => {
    if (!dirty) return undefined;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const set = (k) => (e) => { setDirty(true); setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }); };
  const fe = (n) => error?.fields?.find((x) => x.field === n)?.message;
  const opt = (v) => (v ? Number(v) : null);

  async function submit(e) {
    e.preventDefault(); setError(null);
    const price = nairaToKobo(f.price);
    const compare = f.compareAt ? nairaToKobo(f.compareAt) : null;
    if (price == null || (f.compareAt && compare == null)) { setError(new ApiError(400, { error: { message: 'Enter prices in naira, for example 1500 or 1500.50.', fields: [{ field: price == null ? 'priceKobo' : 'compareAtPriceKobo', message: 'Enter a valid amount, for example 1500.50' }] } })); return; }
    setBusy(true);
    try {
      const body = { sku: f.sku, barcode: f.barcode || null, name: f.name, description: f.description || null, categoryId: Number(f.categoryId), brandId: opt(f.brandId), supplierId: opt(f.supplierId), priceKobo: price, compareAtPriceKobo: compare, lowStockThreshold: Number(f.lowStockThreshold), imageUrl: f.imageUrl || null, imageSource: f.imageUrl ? f.imageSource : null, imageRightsConfirmed: Boolean(f.imageUrl) && f.imageRightsConfirmed, imageCredit: f.imageCredit || null, isPublished: f.isPublished };
      await api(editing ? `/admin/products/${id}` : '/admin/products', { method: editing ? 'PUT' : 'POST', body });
      setDirty(false); navigate('/admin/products');
    } catch (err) { setError(err instanceof ApiError ? err : new ApiError(0, null)); }
    finally { setBusy(false); }
  }

  const ctx = { f, set, fe };

  return (
    <>
      <h1>{editing ? 'Edit product' : 'Add a product'}</h1>
      {dirty && <p role="status" className="muted">You have unsaved changes.</p>}
      {error && !error.fields && <div className="alert alert-error" role="alert">{error.message}</div>}
      <form onSubmit={submit} noValidate>
        <fieldset className="panel"><legend>Basic information</legend>
          <Field ctx={ctx} name="name" label="Product name" required maxLength={200} />
          <Field ctx={ctx} name="sku" label="SKU" required maxLength={64} />
          <Field ctx={ctx} name="barcode" label="Barcode (optional)" maxLength={64} />
          <div className="field"><label htmlFor="pf-description">Description (optional)</label><textarea id="pf-description" rows={4} maxLength={5000} value={f.description} onChange={set('description')} /><span className="muted">Only add details you have verified, such as ingredients or pack size.</span></div>
        </fieldset>
        <fieldset className="panel"><legend>Pricing (naira)</legend>
          <Field ctx={ctx} name="price" label="Price" inputMode="decimal" apiName="priceKobo" required hint="Example: 1500.50" />
          <Field ctx={ctx} name="compareAt" label="Original price if discounted (optional)" inputMode="decimal" apiName="compareAtPriceKobo" />
        </fieldset>
        <fieldset className="panel"><legend>Category, brand and supplier</legend>
          <Select ctx={ctx} name="categoryId" label="Category" list={cats} required />
          <Select ctx={ctx} name="brandId" label="Brand (optional)" list={brands} />
          <Select ctx={ctx} name="supplierId" label="Supplier (optional)" list={sups} />
          {cats.status === 'ready' && cats.data.items.length === 0 && <p className="alert">No categories exist yet. Add one under Categories, brands, suppliers.</p>}
        </fieldset>
        <fieldset className="panel"><legend>Inventory</legend>
          <Field ctx={ctx} name="lowStockThreshold" label="Low stock threshold" type="number" min="0" />
          <p className="muted">Stock quantities are changed on the Inventory page so every change is recorded.</p>
        </fieldset>
        <fieldset className="panel"><legend>Image</legend>
          <ImageField ctx={ctx} setF={setF} setDirty={setDirty} setError={setError} />
        </fieldset>
        <fieldset className="panel"><legend>Publishing</legend>
          <label className="check"><input type="checkbox" checked={f.isPublished} onChange={set('isPublished')} /> Show this product in the shop</label>
        </fieldset>
        <div className="actions-row"><button className="btn" type="submit" disabled={busy}>{busy ? 'Saving' : 'Save product'}</button><Link className="btn btn-secondary" to="/admin/products">Cancel</Link></div>
      </form>
    </>
  );
}
