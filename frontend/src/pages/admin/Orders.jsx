import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError, formatNaira } from '../../lib/api.js';
import { useFetch } from '../../lib/useFetch.js';
import { formatDate, STATUS_LABEL } from '../../lib/format.js';
import DataTable, { Pager } from '../../components/DataTable.jsx';
import { ErrorState } from '../../components/States.jsx';
import { useAuth, can } from '../../lib/auth.jsx';

// Display hint only. The server enforces the real transition rules.
const NEXT = { placed: ['confirmed', 'cancelled'], confirmed: ['processing', 'cancelled'], processing: ['ready', 'dispatched', 'cancelled'], ready: ['delivered', 'cancelled'], dispatched: ['delivered'], delivered: [], cancelled: [] };

export function AdminOrders() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const r = useFetch(`/admin/orders?page=${page}${status ? `&status=${status}` : ''}`);
  return (
    <>
      <h1>Orders</h1>
      <div className="field" style={{ maxWidth: 260 }}><label htmlFor="os">Filter by status</label>
        <select id="os" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All orders</option>{Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      <DataTable caption="orders" status={r.status} error={r.error} onRetry={r.retry} rows={r.data?.items} rowKey={(o) => o.ref}
        empty={{ title: 'No orders found', body: status ? 'No orders have this status.' : 'Orders will appear here when customers place them.' }}
        columns={[
          { key: 'ref', label: 'Order', render: (o) => <Link to={`/admin/orders/${o.ref}`}>{o.ref}</Link> },
          { key: 'customer', label: 'Customer' }, { key: 'fulfilment', label: 'Type', render: (o) => (o.fulfilment === 'pickup' ? 'Pickup' : 'Delivery') },
          { key: 'status', label: 'Status', render: (o) => STATUS_LABEL[o.status] },
          { key: 'totalKobo', label: 'Total', render: (o) => formatNaira(o.totalKobo) }, { key: 'createdAt', label: 'Placed', render: (o) => formatDate(o.createdAt) },
        ]} />
      <Pager data={r.data} page={page} setPage={setPage} />
    </>
  );
}

export function AdminOrderDetail() {
  const { ref } = useParams();
  const { user } = useAuth();
  const { status, data, error, retry } = useFetch(`/admin/orders/${ref}`);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  async function move(to) {
    if (to === 'cancelled' && !window.confirm('Cancel this order? Reserved stock will be released.')) return;
    setErr(null); setMsg(null);
    try { await api(`/admin/orders/${ref}/status`, { method: 'POST', body: { status: to } }); setMsg(`Order marked as ${STATUS_LABEL[to]}.`); retry(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Something went wrong.'); }
  }
  if (status === 'loading') return <div className="skeleton" style={{ height: 240 }} role="status" aria-label="Loading order" />;
  if (status === 'error') return <ErrorState message={error.message} onRetry={retry} />;
  const o = data.order;
  const next = NEXT[o.status].filter((s) => !(s === 'ready' && o.fulfilment !== 'pickup') && !(s === 'dispatched' && o.fulfilment !== 'delivery'));
  return (
    <>
      <p><Link to="/admin/orders">Back to orders</Link></p>
      <h1>Order {o.ref}</h1>
      {msg && <div className="alert" role="status">{msg}</div>}{err && <div className="alert alert-error" role="alert">{err}</div>}
      <div className="panel"><p><strong>{STATUS_LABEL[o.status]}</strong> · {o.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'}</p>
        <p>{o.customer} · {o.email} · {o.phone}{o.address ? <><br />Deliver to: {o.address}</> : null}</p>
        {can(user, 'orders.manage') && next.length > 0 && <div className="actions-row">{next.map((s) => <button key={s} className={s === 'cancelled' ? 'btn btn-secondary' : 'btn'} type="button" onClick={() => move(s)}>{s === 'cancelled' ? 'Cancel order' : `Mark as ${STATUS_LABEL[s].toLowerCase()}`}</button>)}</div>}</div>
      <table className="table"><caption className="visually-hidden">Items</caption><thead><tr><th scope="col">Product</th><th scope="col">SKU</th><th scope="col">Quantity</th><th scope="col">Line total</th></tr></thead>
        <tbody>{o.items.map((i) => <tr key={i.sku}><td data-label="Product">{i.name}</td><td data-label="SKU">{i.sku}</td><td data-label="Quantity">{i.quantity}</td><td data-label="Line total">{formatNaira(i.unitPriceKobo * i.quantity)}</td></tr>)}</tbody></table>
      <dl className="totals"><dt>Subtotal</dt><dd>{formatNaira(o.subtotalKobo)}</dd><dt>Delivery fee</dt><dd>{formatNaira(o.deliveryFeeKobo)}</dd><dt><strong>Total</strong></dt><dd><strong>{formatNaira(o.totalKobo)}</strong></dd></dl>
    </>
  );
}

export function Refunds() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [err, setErr] = useState(null);
  const r = useFetch(`/admin/refunds?page=${page}`);
  async function decide(id, decision) {
    if (!window.confirm(decision === 'approved' ? 'Approve this refund request? Money is not moved automatically.' : 'Reject this refund request?')) return;
    setErr(null);
    try { await api(`/admin/refunds/${id}/decide`, { method: 'POST', body: { decision } }); r.retry(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Something went wrong.'); }
  }
  return (
    <>
      <h1>Refund requests</h1>
      <p className="muted">Approving records the decision. Paying the customer is done outside this system until a payment provider is connected.</p>
      {err && <div className="alert alert-error" role="alert">{err}</div>}
      <DataTable caption="refund requests" status={r.status} error={r.error} onRetry={r.retry} rows={r.data?.items} rowKey={(x) => x.id}
        empty={{ title: 'No refund requests', body: 'Customer requests will appear here.' }}
        columns={[
          { key: 'orderRef', label: 'Order', render: (x) => <Link to={`/admin/orders/${x.orderRef}`}>{x.orderRef}</Link> },
          { key: 'amountKobo', label: 'Amount', render: (x) => formatNaira(x.amountKobo) }, { key: 'reason', label: 'Reason' }, { key: 'status', label: 'Status' },
          { key: 'a', label: 'Action', render: (x) => x.status === 'requested' && can(user, 'refunds.decide') && <div className="actions-row"><button className="btn" type="button" onClick={() => decide(x.id, 'approved')}>Approve</button><button className="btn btn-secondary" type="button" onClick={() => decide(x.id, 'rejected')}>Reject</button></div> },
        ]} />
      <Pager data={r.data} page={page} setPage={setPage} />
    </>
  );
}
