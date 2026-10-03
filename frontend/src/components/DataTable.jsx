import { ErrorState, EmptyState } from './States.jsx';

// Table on wide screens, stacked cards on phones (see .table in app.css, driven by data-label).
export default function DataTable({ caption, columns, rows, rowKey, status, error, onRetry, empty }) {
  if (status === 'loading') return <div className="skeleton" style={{ height: 240 }} role="status" aria-label={`Loading ${caption}`} />;
  if (status === 'error') return <ErrorState message={error?.message} onRetry={onRetry} />;
  if (!rows?.length) return <EmptyState title={empty?.title || 'Nothing here yet'}>{empty?.body || ''}</EmptyState>;
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="visually-hidden">{caption}</caption>
        <thead><tr>{columns.map((c) => <th key={c.key} scope="col">{c.label}</th>)}</tr></thead>
        <tbody>{rows.map((r) => <tr key={rowKey(r)}>{columns.map((c) => <td key={c.key} data-label={c.label}>{c.render ? c.render(r) : r[c.key]}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function Pager({ data, page, setPage }) {
  if (!data) return null;
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <nav className="pagination" aria-label="Pagination">
      <button className="btn btn-secondary" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous page</button>
      <span>Page {page} of {pages} ({data.total} total)</span>
      <button className="btn btn-secondary" type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next page</button>
    </nav>
  );
}
