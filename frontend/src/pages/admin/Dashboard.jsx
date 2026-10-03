import { Link } from 'react-router-dom';
import { useFetch } from '../../lib/useFetch.js';
import { formatNaira } from '../../lib/api.js';
import { STATUS_LABEL } from '../../lib/format.js';
import { EmptyState, ErrorState } from '../../components/States.jsx';
import { useAuth, can } from '../../lib/auth.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const allowed = can(user, 'reports.read');
  const { status, data, error, retry } = useFetch(allowed ? '/admin/reports/summary' : '/auth/me');
  if (!allowed) return <><h1>Dashboard</h1><p>Use the menu to open the areas available to your role.</p></>;
  if (status === 'loading') return <><h1>Dashboard</h1><div className="skeleton" style={{ height: 240 }} role="status" aria-label="Loading dashboard" /></>;
  if (status === 'error') return <><h1>Dashboard</h1><ErrorState message={error.message} onRetry={retry} /></>;
  const max = Math.max(1, ...data.salesByDay.map((d) => d.totalKobo));
  return (
    <>
      <h1>Dashboard</h1>
      <ul className="stat-grid">
        <li className="panel"><div className="muted">Products low or out of stock</div><strong className="stat">{data.lowStockCount}</strong><Link to="/admin/inventory?low=true">View low stock</Link></li>
        <li className="panel"><div className="muted">Refund requests waiting</div><strong className="stat">{data.openRefunds}</strong><Link to="/admin/refunds">Review refunds</Link></li>
      </ul>
      <section aria-labelledby="st"><h2 id="st">Orders by status</h2>
        {data.ordersByStatus.length === 0 ? <EmptyState title="No orders yet">Orders will be counted here once customers place them.</EmptyState> : (
          <ul className="chips">{data.ordersByStatus.map((s) => <li key={s.status} className="badge badge-ok">{STATUS_LABEL[s.status]}: {s.count}</li>)}</ul>
        )}
      </section>
      <section aria-labelledby="sd"><h2 id="sd">Sales in the last 30 days (excluding cancelled orders)</h2>
        {data.salesByDay.length === 0 ? <EmptyState title="No sales in this period">Daily totals will appear here after orders are placed.</EmptyState> : (
          <table className="table"><caption className="visually-hidden">Daily order totals in naira</caption>
            <thead><tr><th scope="col">Day</th><th scope="col">Orders</th><th scope="col">Total</th><th scope="col">Share of best day</th></tr></thead>
            <tbody>{data.salesByDay.map((d) => (
              <tr key={d.day}><td data-label="Day">{String(d.day).slice(0, 10)}</td><td data-label="Orders">{d.orders}</td><td data-label="Total">{formatNaira(d.totalKobo)}</td>
                <td data-label="Share of best day"><div className="bar" aria-hidden="true"><span style={{ width: `${Math.round((d.totalKobo / max) * 100)}%` }} /></div></td></tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </>
  );
}
