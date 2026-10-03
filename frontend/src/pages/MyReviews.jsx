import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api.js';
import { useFetch } from '../lib/useFetch.js';
import { EmptyState, ErrorState } from '../components/States.jsx';
import { AuthForm } from './Account.jsx';
import { useAuth } from '../lib/auth.jsx';

function ReviewForm({ item, onDone }) {
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setError(null); setBusy(true);
    try { await api('/my-reviews', { method: 'POST', body: { orderRef: item.orderRef, productId: item.productId, rating, body: body || undefined } }); onDone(); }
    catch (err) { setError(err instanceof ApiError ? (err.fields?.[0]?.message || err.message) : 'Something went wrong.'); }
    finally { setBusy(false); }
  }
  return (
    <form className="panel" onSubmit={submit} noValidate aria-label={`Review ${item.name}`}>
      <h3>{item.name}</h3>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="field"><label htmlFor={`rt-${item.productId}`}>Rating</label>
        <select id={`rt-${item.productId}`} value={rating} onChange={(e) => setRating(Number(e.target.value))}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} out of 5</option>)}</select></div>
      <div className="field"><label htmlFor={`bd-${item.productId}`}>Your review (optional)</label><textarea id={`bd-${item.productId}`} rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} /></div>
      <button className="btn" type="submit" disabled={busy}>{busy ? 'Sending' : 'Submit review'}</button>
    </form>
  );
}

export default function MyReviews() {
  const { user } = useAuth();
  const { status, data, error, retry } = useFetch('/my-reviews/eligible');
  const [done, setDone] = useState(new Set());
  if (user === undefined) return <div className="container page"><div className="skeleton" style={{ height: 200 }} role="status" aria-label="Loading" /></div>;
  if (!user) return <AuthForm />;
  return (
    <div className="container page">
      <h1>Write a review</h1>
      <p className="muted">You can review products from orders that have been delivered to you.</p>
      {status === 'loading' && <div className="skeleton" style={{ height: 200 }} role="status" aria-label="Loading" />}
      {status === 'error' && <ErrorState message={error.message} onRetry={retry} />}
      {status === 'ready' && data.items.filter((i) => !done.has(i.productId)).length === 0 && (
        <EmptyState title="Nothing to review right now" actions={<Link className="btn" to="/account/orders">My orders</Link>}>Products from delivered orders you have not yet reviewed will appear here.</EmptyState>
      )}
      {status === 'ready' && data.items.filter((i) => !done.has(i.productId)).map((item) => (
        <ReviewForm key={`${item.orderRef}-${item.productId}`} item={item} onDone={() => { setDone(new Set([...done, item.productId])); retry(); }} />
      ))}
    </div>
  );
}
