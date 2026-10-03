import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api.js';
import { useFetch } from '../../lib/useFetch.js';
import DataTable, { Pager } from '../../components/DataTable.jsx';
import { useAuth, can } from '../../lib/auth.jsx';

const REASONS = [['received', 'Stock received'], ['return', 'Customer return'], ['damaged', 'Damaged'], ['expired', 'Expired'], ['correction', 'Count correction']];

function AdjustForm({ product, locations, onDone, onCancel }) {
  const [f, setF] = useState({ delta: '', reason: 'received', locationId: locations[0]?.id ? String(locations[0].id) : '', note: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const negative = ['damaged', 'expired'].includes(f.reason);

  async function submit(e) {
    e.preventDefault(); setError(null);
    let delta = parseInt(f.delta, 10);
    if (!Number.isInteger(delta) || delta === 0) { setError('Enter a whole number that is not zero.'); return; }
    if (negative && delta > 0) delta = -delta;
    if (delta < 0 && !window.confirm(`Remove ${-delta} from ${product.name}? This is recorded in the stock history.`)) return;
    setBusy(true);
    try {
      await api('/admin/inventory/adjust', { method: 'POST', body: { productId: product.id, locationId: Number(f.locationId), delta, reason: f.reason, note: f.note || undefined } });
      onDone();
    } catch (err) { setError(err instanceof ApiError ? (err.fields?.[0]?.message || err.message) : 'Something went wrong.'); }
    finally { setBusy(false); }
  }
  return (
    <form className="panel" onSubmit={submit} noValidate aria-label={`Adjust stock for ${product.name}`}>
      <h2>Adjust stock: {product.name}</h2>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="field"><label htmlFor="adj-reason">Reason</label><select id="adj-reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })}>{REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      <div className="field"><label htmlFor="adj-delta">Quantity {negative ? 'to remove' : '(use a negative number to remove)'}</label><input id="adj-delta" inputMode="numeric" value={f.delta} onChange={(e) => setF({ ...f, delta: e.target.value })} required /></div>
      <div className="field"><label htmlFor="adj-loc">Location</label><select id="adj-loc" value={f.locationId} onChange={(e) => setF({ ...f, locationId: e.target.value })}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
      <div className="field"><label htmlFor="adj-note">Note (optional)</label><input id="adj-note" value={f.note} maxLength={255} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
      <div className="actions-row"><button className="btn" type="submit" disabled={busy}>{busy ? 'Saving' : 'Save adjustment'}</button><button className="btn btn-secondary" type="button" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

export default function Inventory() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null);
  const low = params.get('low') === 'true';
  const qs = `page=${page}${low ? '&low=true' : ''}${params.get('q') ? `&q=${encodeURIComponent(params.get('q'))}` : ''}`;
  const { status, data, error, retry } = useFetch(`/admin/inventory?${qs}`);
  const locs = useFetch('/admin/locations');

  return (
    <>
      <h1>Inventory</h1>
      <form className="header-search" role="search" onSubmit={(e) => { e.preventDefault(); setPage(1); const n = new URLSearchParams(params); q.trim() ? n.set('q', q.trim()) : n.delete('q'); setParams(n); }}>
        <label className="visually-hidden" htmlFor="iq">Search inventory</label>
        <input id="iq" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, SKU or barcode" maxLength={80} />
        <button className="btn" type="submit">Search inventory</button>
      </form>
      <label className="check"><input type="checkbox" checked={low} onChange={(e) => { setPage(1); const n = new URLSearchParams(params); e.target.checked ? n.set('low', 'true') : n.delete('low'); setParams(n); }} /> Show low or out of stock only</label>
      {target && locs.status === 'ready' && <AdjustForm product={target} locations={locs.data.items} onCancel={() => setTarget(null)} onDone={() => { setTarget(null); retry(); }} />}
      <DataTable caption="inventory" status={status} error={error} onRetry={retry} rows={data?.items} rowKey={(r) => r.id}
        empty={{ title: low ? 'No low stock products' : 'No products yet', body: low ? 'Every product is above its low stock threshold.' : 'Add products first, then record stock here.' }}
        columns={[
          { key: 'name', label: 'Product' }, { key: 'sku', label: 'SKU' },
          { key: 'onHand', label: 'On hand' }, { key: 'reserved', label: 'Reserved' },
          { key: 'available', label: 'Available', render: (r) => <>{r.available}{' '}<span className={`badge ${r.available <= 0 ? 'badge-out' : r.available <= r.threshold ? 'badge-low' : 'badge-ok'}`}>{r.available <= 0 ? 'Out of stock' : r.available <= r.threshold ? 'Low stock' : 'In stock'}</span></> },
          { key: 'a', label: 'Action', render: (r) => can(user, 'inventory.adjust') && <button className="btn btn-secondary" type="button" onClick={() => { setTarget(r); window.scrollTo({ top: 0 }); }}>Adjust stock</button> },
        ]} />
      <Pager data={data} page={page} setPage={setPage} />
    </>
  );
}
