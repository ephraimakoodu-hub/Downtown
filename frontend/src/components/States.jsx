export function LoadingGrid({ count = 8 }) {
  return (
    <div role="status" aria-live="polite">
      <span className="visually-hidden">Loading products</span>
      <ul className="product-grid" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <li key={i}><div className="skeleton" style={{ height: 300 }} /></li>
        ))}
      </ul>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state alert-error" role="alert">
      <h2>We could not load this page</h2>
      <p>{message}</p>
      {onRetry && <div className="actions"><button className="btn" type="button" onClick={onRetry}>Try again</button></div>}
    </div>
  );
}

export function EmptyState({ title, children, actions }) {
  return (
    <div className="state">
      <h2>{title}</h2>
      <p className="muted">{children}</p>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}
