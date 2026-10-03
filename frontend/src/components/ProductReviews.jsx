import { useFetch } from '../lib/useFetch.js';
import { formatDate } from '../lib/format.js';
import { EmptyState, ErrorState } from './States.jsx';

function Stars({ value }) {
  return <span aria-label={`${value} out of 5 stars`}>{'★'.repeat(value)}{'☆'.repeat(5 - value)}</span>;
}

export default function ProductReviews({ slug }) {
  const { status, data, error, retry } = useFetch(`/reviews?product=${encodeURIComponent(slug)}`);
  if (status === 'loading') return <div className="skeleton" style={{ height: 120 }} role="status" aria-label="Loading reviews" />;
  if (status === 'error') return <ErrorState message={error.message} onRetry={retry} />;
  return (
    <section aria-labelledby="reviews-h" className="section">
      <h2 id="reviews-h">Customer reviews</h2>
      {data.count === 0 ? (
        <EmptyState title="No reviews yet">Reviews appear here once customers who bought this product write one.</EmptyState>
      ) : (
        <>
          <p><Stars value={Math.round(data.average)} /> {data.average} out of 5, based on {data.count} review{data.count === 1 ? '' : 's'}</p>
          <ul className="review-list">
            {data.items.map((rv, i) => (
              <li key={i} className="panel">
                <p><Stars value={rv.rating} /> <strong>{rv.name}</strong> <span className="muted">{formatDate(rv.at)}</span></p>
                {rv.body && <p>{rv.body}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
