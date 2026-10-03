
import { useEffect, useState } from 'react';
import { api, ApiError, formatNaira } from '../../lib/api.js';
import { useFetch } from '../../lib/useFetch.js';
import { formatDate, nairaToKobo, koboToInput } from '../../lib/format.js';
import DataTable, { Pager } from '../../components/DataTable.jsx';
import { useAuth, can } from '../../lib/auth.jsx';

function AddNamed({ label, path, fields = [], onDone, build }) {
  const [v, setV] = useState({ name: '', a: '', b: '', c: '' });
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setErr(null);

    try {
      await api(path, { method: 'POST', body: build(v) });
      setV({ name: '', a: '', b: '', c: '' });
      onDone();
    } catch (x) {
      setErr(
        x instanceof ApiError
          ? (x.fields?.[0]?.message || x.message)
          : 'Something went wrong.'
      );
    }
  }

  return (
    <form className="panel" onSubmit={submit} noValidate>
      <h3>Add {label}</h3>

      {err && <div className="alert alert-error" role="alert">{err}</div>}

      <div className="field">
        <label htmlFor={`n-${path}`}>Name</label>
        <input
          id={`n-${path}`}
          value={v.name}
          onChange={(e) => setV({ ...v, name: e.target.value })}
          required
          maxLength={160}
        />
      </div>

      {fields.map(([k, lbl]) => (
        <div className="field" key={k}>
          <label htmlFor={`f-${path}-${k}`}>{lbl}</label>
          <input
            id={`f-${path}-${k}`}
            value={v[k]}
            onChange={(e) => setV({ ...v, [k]: e.target.value })}
          />
        </div>
      ))}

      <button className="btn" type="submit">Add {label}</button>
    </form>
  );
}

export function CatalogueData() {
  const cats = useFetch('/admin/categories');
  const brands = useFetch('/admin/brands');
  const sups = useFetch('/admin/suppliers');

  return (
    <>
      <h1>Categories, brands and suppliers</h1>
      <p className="muted">Only add categories and brands the supermarket actually stocks.</p>

      <section aria-labelledby="c1">
        <h2 id="c1">Categories</h2>
        <AddNamed
          label="category"
          path="/admin/categories"
          onDone={cats.retry}
          build={(v) => ({ name: v.name })}
        />
        <DataTable
          caption="categories"
          status={cats.status}
          error={cats.error}
          onRetry={cats.retry}
          rows={cats.data?.items}
          rowKey={(x) => x.id}
          empty={{ title: 'No categories yet', body: 'Add the first category above.' }}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'slug', label: 'Address name' },
          ]}
        />
      </section>

      <section aria-labelledby="c2">
        <h2 id="c2">Brands</h2>
        <AddNamed
          label="brand"
          path="/admin/brands"
          onDone={brands.retry}
          build={(v) => ({ name: v.name })}
        />
        <DataTable
          caption="brands"
          status={brands.status}
          error={brands.error}
          onRetry={brands.retry}
          rows={brands.data?.items}
          rowKey={(x) => x.id}
          empty={{ title: 'No brands yet' }}
          columns={[{ key: 'name', label: 'Name' }]}
        />
      </section>

      <section aria-labelledby="c3">
        <h2 id="c3">Suppliers</h2>
        <AddNamed
          label="supplier"
          path="/admin/suppliers"
          onDone={sups.retry}
          build={(v) => ({
            name: v.name,
            ...(v.a ? { contactName: v.a } : {}),
            ...(v.b ? { phone: v.b } : {}),
            ...(v.c ? { email: v.c } : {}),
          })}
          fields={[
            ['a', 'Contact person (optional)'],
            ['b', 'Phone (optional)'],
            ['c', 'Email (optional)'],
          ]}
        />
        <DataTable
          caption="suppliers"
          status={sups.status}
          error={sups.error}
          onRetry={sups.retry}
          rows={sups.data?.items}
          rowKey={(x) => x.id}
          empty={{ title: 'No suppliers yet' }}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'contact_name', label: 'Contact' },
            { key: 'phone', label: 'Phone' },
            { key: 'email', label: 'Email' },
          ]}
        />
      </section>
    </>
  );
}

export function PurchaseOrders() {
  const [page, setPage] = useState(1);
  const list = useFetch(`/admin/purchase-orders?page=${page}`);
  const sups = useFetch('/admin/suppliers');
  const locs = useFetch('/admin/locations');

  const [f, setF] = useState({
    supplierId: '',
    sku: '',
    quantity: '',
    cost: '',
  });

  const [lines, setLines] = useState([]);
  const [err, setErr] = useState(null);

  async function addLine(e) {
    e.preventDefault();
    setErr(null);

    const cost = nairaToKobo(f.cost);
    const qty = parseInt(f.quantity, 10);

    if (cost == null || !(qty > 0)) {
      setErr('Enter a quantity above zero and a cost in naira.');
      return;
    }

    try {
      const r = await api(`/admin/products?q=${encodeURIComponent(f.sku)}`);
      const p = r.items.find((x) => x.sku === f.sku);

      if (!p) {
        setErr('No product has that exact SKU.');
        return;
      }

      setLines([
        ...lines.filter((l) => l.productId !== p.id),
        {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          quantity: qty,
          unitCostKobo: cost,
        },
      ]);

      setF({ ...f, sku: '', quantity: '', cost: '' });
    } catch (x) {
      setErr(x.message);
    }
  }

  async function create() {
    setErr(null);

    try {
      await api('/admin/purchase-orders', {
        method: 'POST',
        body: {
          supplierId: Number(f.supplierId),
          items: lines.map(({ productId, quantity, unitCostKobo }) => ({
            productId,
            quantity,
            unitCostKobo,
          })),
        },
      });

      setLines([]);
      list.retry();
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : 'Something went wrong.');
    }
  }

  async function receive(id) {
    const loc = locs.data?.items?.[0];
    if (!loc) return;

    if (!window.confirm(
      `Mark purchase order ${id} as received into ${loc.name}? This adds the stock.`
    )) return;

    try {
      await api(`/admin/purchase-orders/${id}/receive`, {
        method: 'POST',
        body: { locationId: loc.id },
      });
      list.retry();
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : 'Something went wrong.');
    }
  }

  return (
    <>
      <h1>Purchase orders</h1>

      {err && <div className="alert alert-error" role="alert">{err}</div>}

      <section className="panel" aria-labelledby="npo">
        <h2 id="npo">New purchase order</h2>

        <div className="field">
          <label htmlFor="po-sup">Supplier</label>
          <select
            id="po-sup"
            value={f.supplierId}
            onChange={(e) => setF({ ...f, supplierId: e.target.value })}
          >
            <option value="">Choose a supplier</option>
            {(sups.data?.items || []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <form onSubmit={addLine} noValidate>
          <div className="field">
            <label htmlFor="po-sku">Product SKU</label>
            <input
              id="po-sku"
              value={f.sku}
              onChange={(e) => setF({ ...f, sku: e.target.value })}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="po-q">Quantity</label>
            <input
              id="po-q"
              inputMode="numeric"
              value={f.quantity}
              onChange={(e) => setF({ ...f, quantity: e.target.value })}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="po-c">Unit cost (naira)</label>
            <input
              id="po-c"
              inputMode="decimal"
              value={f.cost}
              onChange={(e) => setF({ ...f, cost: e.target.value })}
              required
            />
          </div>

          <button className="btn btn-secondary" type="submit">Add line</button>
        </form>

        {lines.length > 0 && (
          <>
            <ul>
              {lines.map((l) => (
                <li key={l.productId}>
                  {l.quantity} x {l.name} ({l.sku}) at {formatNaira(l.unitCostKobo)}
                </li>
              ))}
            </ul>

            <button
              className="btn"
              type="button"
              disabled={!f.supplierId}
              onClick={create}
            >
              Create purchase order
            </button>
          </>
        )}
      </section>

      <DataTable
        caption="purchase orders"
        status={list.status}
        error={list.error}
        onRetry={list.retry}
        rows={list.data?.items}
        rowKey={(x) => x.id}
        empty={{ title: 'No purchase orders yet', body: 'Create one above once you have suppliers and products.' }}
        columns={[
          { key: 'id', label: 'Number' },
          { key: 'supplier', label: 'Supplier' },
          { key: 'status', label: 'Status' },
          { key: 'created_at', label: 'Created', render: (x) => formatDate(x.created_at) },
          {
            key: 'a',
            label: 'Action',
            render: (x) =>
              ['draft', 'sent'].includes(x.status) && (
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => receive(x.id)}
                >
                  Mark as received
                </button>
              ),
          },
        ]}
      />

      <Pager data={list.data} page={page} setPage={setPage} />
    </>
  );
}

export function Users() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const list = useFetch(`/admin/users?page=${page}`);
  const roles = useFetch(can(user, 'users.manage') ? '/admin/roles' : '/categories');
  const [err, setErr] = useState(null);

  async function patch(id, body) {
    if (!window.confirm('Change this account? This is recorded in the audit log.')) return;

    setErr(null);

    try {
      await api(`/admin/users/${id}`, { method: 'PATCH', body });
      list.retry();
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : 'Something went wrong.');
    }
  }

  const manage = can(user, 'users.manage');
  const roleList = roles.data?.items || [];

  return (
    <>
      <h1>Customers and staff</h1>

      {err && <div className="alert alert-error" role="alert">{err}</div>}

      <DataTable
        caption="accounts"
        status={list.status}
        error={list.error}
        onRetry={list.retry}
        rows={list.data?.items}
        rowKey={(u) => u.id}
        empty={{ title: 'No accounts yet' }}
        columns={[
          { key: 'fullName', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'isActive', label: 'Status', render: (u) => (u.isActive ? 'Active' : 'Disabled') },
          {
            key: 'role',
            label: 'Role',
            render: (u) =>
              manage && u.id !== user.id ? (
                <>
                  <label className="visually-hidden" htmlFor={`r-${u.id}`}>
                    Role for {u.fullName}
                  </label>
                  <select
                    id={`r-${u.id}`}
                    value={roleList.find((r) => r.name === u.role)?.id || ''}
                    onChange={(e) => patch(u.id, { roleId: Number(e.target.value) })}
                  >
                    {roleList.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </>
              ) : u.role.replace('_', ' '),
          },
          {
            key: 'a',
            label: 'Action',
            render: (u) =>
              manage && u.id !== user.id && (
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => patch(u.id, { isActive: !u.isActive })}
                >
                  {u.isActive ? 'Disable account' : 'Enable account'}
                </button>
              ),
          },
        ]}
      />

      <Pager data={list.data} page={page} setPage={setPage} />
    </>
  );
}

export function AuditLogs() {
  const [page, setPage] = useState(1);
  const r = useFetch(`/admin/audit-logs?page=${page}`);

  return (
    <>
      <h1>Audit log</h1>

      <DataTable
        caption="audit log"
        status={r.status}
        error={r.error}
        onRetry={r.retry}
        rows={r.data?.items}
        rowKey={(a) => a.id}
        empty={{ title: 'No activity recorded yet' }}
        columns={[
          { key: 'at', label: 'When', render: (a) => formatDate(a.at) },
          { key: 'by', label: 'Who', render: (a) => a.by || 'System' },
          { key: 'action', label: 'Action' },
          {
            key: 'entity',
            label: 'Item',
            render: (a) => `${a.entity}${a.entityId ? ` ${a.entityId}` : ''}`,
          },
          {
            key: 'changes',
            label: 'Details',
            render: (a) => (a.changes ? JSON.stringify(a.changes) : ''),
          },
        ]}
      />

      <Pager data={r.data} page={page} setPage={setPage} />
    </>
  );
}

export function Settings() {
  const r = useFetch('/admin/settings');
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (r.status !== 'ready') return;

    const m = Object.fromEntries(
      r.data.items.map((i) => [i.setting_key, i.setting_value])
    );

    setF({
      deliveryEnabled: m.delivery_enabled === 'true',
      pickupEnabled: m.pickup_enabled === 'true',
      fee: m.delivery_fee_kobo == null
        ? ''
        : koboToInput(Number(m.delivery_fee_kobo)),
      max: m.max_items_per_order || '100',
      bankTransferEnabled: m.bank_transfer_enabled === 'true',
      bankName: m.bank_name || '',
      bankAccountName: m.bank_account_name || '',
      bankAccountNumber: m.bank_account_number || '',
    });
  }, [r.status, r.data]);

  async function save(e) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    const fee = f.fee === '' ? null : nairaToKobo(f.fee);

    if (f.fee !== '' && fee == null) {
      setErr('Enter the delivery fee in naira, for example 1500.');
      return;
    }

    if (f.deliveryEnabled && fee == null) {
      setErr('Set a delivery fee before switching delivery on.');
      return;
    }

    if (
      f.bankTransferEnabled &&
      (!f.bankName.trim() ||
        !f.bankAccountName.trim() ||
        !/^\d{6,20}$/.test(f.bankAccountNumber.trim()))
    ) {
      setErr(
        'Enter the bank name, account name and a valid account number (6–20 digits) before enabling bank transfers.'
      );
      return;
    }

    setSaving(true);

    try {
      await api('/admin/settings', {
        method: 'PUT',
        body: {
          deliveryEnabled: f.deliveryEnabled,
          pickupEnabled: f.pickupEnabled,
          deliveryFeeKobo: fee,
          maxItemsPerOrder: Number(f.max),
          bankTransferEnabled: f.bankTransferEnabled,
          bankName: f.bankName.trim(),
          bankAccountName: f.bankAccountName.trim(),
          bankAccountNumber: f.bankAccountNumber.trim(),
        },
      });

      setMsg('Settings saved successfully.');
      r.retry();
    } catch (x) {
      setErr(
        x instanceof ApiError
          ? (x.fields?.[0]?.message || x.message)
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (!f) {
    return (
      <>
        <h1>Settings</h1>
        <div
          className="skeleton"
          style={{ height: 200 }}
          role="status"
          aria-label="Loading settings"
        />
      </>
    );
  }

  return (
    <>
      <h1>Settings</h1>

      <p className="muted">
        Manage supermarket delivery, pickup and customer payment instructions.
      </p>

      {msg && <div className="alert" role="status">{msg}</div>}
      {err && <div className="alert alert-error" role="alert">{err}</div>}

      <form className="panel" onSubmit={save} noValidate>
        <h2>Delivery and pickup</h2>

        <label className="check">
          <input
            type="checkbox"
            checked={f.pickupEnabled}
            onChange={(e) => setF({ ...f, pickupEnabled: e.target.checked })}
          />
          Offer pickup
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={f.deliveryEnabled}
            onChange={(e) => setF({ ...f, deliveryEnabled: e.target.checked })}
          />
          Offer delivery
        </label>

        <div className="field">
          <label htmlFor="s-fee">Delivery fee (naira)</label>
          <input
            id="s-fee"
            inputMode="decimal"
            value={f.fee}
            onChange={(e) => setF({ ...f, fee: e.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="s-max">Maximum items per order</label>
          <input
            id="s-max"
            type="number"
            min="1"
            max="1000"
            value={f.max}
            onChange={(e) => setF({ ...f, max: e.target.value })}
          />
        </div>

        <hr />

        <h2>Bank transfer payments</h2>

        <p className="muted">
          Enter the supermarket account customers should transfer money to.
          These details will be displayed during checkout or on the order page.
        </p>

        <label className="check">
          <input
            type="checkbox"
            checked={f.bankTransferEnabled}
            onChange={(e) =>
              setF({ ...f, bankTransferEnabled: e.target.checked })
            }
          />
          Accept bank transfers
        </label>

        <div className="field">
          <label htmlFor="s-bank-name">Bank name</label>
          <input
            id="s-bank-name"
            type="text"
            maxLength="120"
            placeholder="Enter bank name"
            value={f.bankName}
            onChange={(e) => setF({ ...f, bankName: e.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="s-account-name">Account name</label>
          <input
            id="s-account-name"
            type="text"
            maxLength="160"
            placeholder="Enter account name"
            value={f.bankAccountName}
            onChange={(e) =>
              setF({ ...f, bankAccountName: e.target.value })
            }
          />
        </div>

        <div className="field">
          <label htmlFor="s-account-number">Account number</label>
          <input
            id="s-account-number"
            type="text"
            inputMode="numeric"
            maxLength="20"
            placeholder="Enter account number"
            value={f.bankAccountNumber}
            onChange={(e) =>
              setF({
                ...f,
                bankAccountNumber: e.target.value.replace(/\D/g, ''),
              })
            }
          />
        </div>

        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save settings'}
        </button>
      </form>
    </>
  );
}

export function ReviewModeration() {
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const r = useFetch(`/admin/reviews?status=${status}&page=${page}`);
  const [err, setErr] = useState(null);

  async function decide(id, decision) {
    setErr(null);

    try {
      await api(`/admin/reviews/${id}/decide`, {
        method: 'POST',
        body: { decision },
      });
      r.retry();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Something went wrong.');
    }
  }

  return (
    <>
      <h1>Review moderation</h1>

      <div className="field" style={{ maxWidth: 220 }}>
        <label htmlFor="rv-status">Status</label>
        <select
          id="rv-status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="pending">Waiting for review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {err && <div className="alert alert-error" role="alert">{err}</div>}

      <DataTable
        caption="reviews"
        status={r.status}
        error={r.error}
        onRetry={r.retry}
        rows={r.data?.items}
        rowKey={(x) => x.id}
        empty={{ title: status === 'pending' ? 'Nothing waiting for review' : `No ${status} reviews` }}
        columns={[
          { key: 'product', label: 'Product' },
          { key: 'customer', label: 'Customer' },
          { key: 'rating', label: 'Rating', render: (x) => `${x.rating} / 5` },
          { key: 'body', label: 'Review' },
          { key: 'at', label: 'Submitted', render: (x) => formatDate(x.at) },
          {
            key: 'a',
            label: 'Action',
            render: (x) =>
              status === 'pending' && (
                <div className="actions-row">
                  <button
                    className="btn"
                    type="button"
                    onClick={() => decide(x.id, 'approved')}
                  >
                    Approve
                  </button>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => decide(x.id, 'rejected')}
                  >
                    Reject
                  </button>
                </div>
              ),
          },
        ]}
      />

      <Pager data={r.data} page={page} setPage={setPage} />
    </>
  );
}