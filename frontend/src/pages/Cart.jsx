import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { api, formatNaira } from '../lib/api.js';
import { useCart } from '../lib/cart.jsx';
import { EmptyState, ErrorState } from '../components/States.jsx';

export function useQuote(items, fulfilment) {
  const [state, setState] = useState({ status: 'loading', quote: null, error: null });
  const key = JSON.stringify([items, fulfilment]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!items.length) { setState({ status: 'empty', quote: null, error: null }); return undefined; }
    const ctl = new AbortController();
    setState((s) => ({ ...s, status: 'loading' }));
    api('/cart/quote', { method: 'POST', body: { items, ...(fulfilment ? { fulfilment } : {}) }, signal: ctl.signal })
      .then((quote) => setState({ status: 'ready', quote, error: null }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ status: 'error', quote: null, error }); });
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);
  return { ...state, retry: () => setTick((t) => t + 1) };
}

const PROBLEM = { unavailable: 'No longer available', insufficient_stock: 'Not enough stock for this quantity' };

export default function Cart() {
  const { items, setQuantity, remove } = useCart();
  const { status, quote, error, retry } = useQuote(items);

  if (status === 'empty') {
    return <div className="container page"><h1>Your cart</h1><EmptyState title="Your cart is empty" actions={<Link className="btn" to="/products">Shop groceries</Link>}>Add products to see them here.</EmptyState></div>;
  }
  const blocked = quote?.lines.some((l) => l.problem);

  return (
    <div className="container page">
      <h1>Your cart</h1>
      {status === 'loading' && <div className="skeleton" style={{ height: 240 }} role="status" aria-label="Loading cart" />}
      {status === 'error' && <ErrorState message={error.message} onRetry={retry} />}
      {status === 'ready' && (
        <div className="cart-layout">
          <ul className="cart-lines">
            {quote.lines.map((l) => (
              <li key={l.productId} className="cart-line">
                <div>
                  <strong>{l.name ? <Link to={`/products/${l.slug}`}>{l.name}</Link> : 'Unavailable product'}</strong>
                  {l.unitPriceKobo != null && <div className="muted">{formatNaira(l.unitPriceKobo)} each</div>}
                  {l.problem && <div className="error" role="alert">{PROBLEM[l.problem]}{l.problem === 'insufficient_stock' ? ` (${l.available} available)` : ''}</div>}
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor={`q-${l.productId}`}>Quantity</label>
                  <input id={`q-${l.productId}`} type="number" min="1" max="50" value={l.quantity} onChange={(e) => setQuantity(l.productId, Number(e.target.value) || 1)} />
                </div>
                <div className="price">{l.unitPriceKobo != null ? formatNaira(l.unitPriceKobo * l.quantity) : ''}</div>
                <button className="btn btn-secondary" type="button" onClick={() => remove(l.productId)} aria-label={`Remove ${l.name || 'item'} from cart`}><Trash2 size={18} aria-hidden="true" /> Remove</button>
              </li>
            ))}
          </ul>
          <aside className="summary" aria-label="Order summary">
            <h2>Order summary</h2>
            <dl className="totals"><dt>Subtotal</dt><dd>{formatNaira(quote.subtotalKobo)}</dd></dl>
            <p className="muted">Delivery fee, if any, is shown at checkout before you confirm.</p>
            {blocked && <p className="error" role="alert">Fix the items marked above before checking out.</p>}
            {blocked ? <button className="btn" type="button" disabled>Continue to checkout</button> : <Link className="btn" to="/checkout">Continue to checkout</Link>}
          </aside>
        </div>
      )}
    </div>
  );
}
