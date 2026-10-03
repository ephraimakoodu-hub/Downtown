
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError, formatNaira } from '../lib/api.js';
import { useCart } from '../lib/cart.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useQuote } from './Cart.jsx';
import { EmptyState, ErrorState } from '../components/States.jsx';

export default function Checkout() {
  const { items, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [fulfilment, setFulfilment] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // One key per checkout attempt prevents duplicate orders after network retries.
  const idemKey = useRef(crypto.randomUUID());

  const {
    status,
    quote,
    error: qError,
    retry
  } = useQuote(items, fulfilment || undefined);

  const fieldError = (n) =>
    error?.fields?.find((f) => f.field === n)?.message;

  const options = useMemo(
    () => ({
      delivery: quote?.deliveryEnabled,
      pickup: quote?.pickupEnabled
    }),
    [quote]
  );

  if (user === undefined) {
    return (
      <div className="container page">
        <div
          className="skeleton"
          style={{ height: 200 }}
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container page">
        <EmptyState
          title="Sign in to check out"
          actions={
            <Link className="btn" to="/account">
              Sign in or create an account
            </Link>
          }
        >
          Your cart is saved on this device.
        </EmptyState>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="container page">
        <EmptyState
          title="Your cart is empty"
          actions={
            <Link className="btn" to="/products">
              Shop groceries
            </Link>
          }
        >
          Add products before checking out.
        </EmptyState>
      </div>
    );
  }

  async function submit(e) {
    e.preventDefault();

    if (!fulfilment) {
      setError(
        new ApiError(400, {
          error: {
            message: 'Choose delivery or pickup.',
            fields: [
              {
                field: 'fulfilment',
                message: 'Choose delivery or pickup.'
              }
            ]
          }
        })
      );
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idemKey.current
        },
        body: JSON.stringify({
          items,
          fulfilment,
          contactPhone: phone,
          ...(fulfilment === 'delivery'
            ? { deliveryAddress: address }
            : {})
        })
      }).catch(() => {
        throw new ApiError(0, {
          error: {
            message:
              'We could not reach the server. Your order was not placed. Check your connection and try again.'
          }
        });
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new ApiError(res.status, data);
      }

      clear();

      navigate(`/account/orders/${data.order.ref}`, {
        state: { placed: true }
      });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err
          : new ApiError(0, null)
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container page">
      <h1>Checkout</h1>

      {status === 'error' && (
        <ErrorState
          message={qError.message}
          onRetry={retry}
        />
      )}

      {error && !error.fields && (
        <div className="alert alert-error" role="alert">
          {error.message}
        </div>
      )}

      {status !== 'error' && (
        <form
          className="cart-layout"
          onSubmit={submit}
          noValidate
        >
          <div>
            <fieldset className="panel">
              <legend>1. Delivery or pickup</legend>

              {quote && !options.delivery && !options.pickup && (
                <p className="alert alert-error" role="alert">
                  Ordering is not available yet. The supermarket has
                  not switched on delivery or pickup.
                </p>
              )}

              {options.pickup && (
                <label className="check">
                  <input
                    type="radio"
                    name="f"
                    value="pickup"
                    checked={fulfilment === 'pickup'}
                    onChange={() => setFulfilment('pickup')}
                  />
                  Pickup
                </label>
              )}

              {options.delivery && (
                <label className="check">
                  <input
                    type="radio"
                    name="f"
                    value="delivery"
                    checked={fulfilment === 'delivery'}
                    onChange={() => setFulfilment('delivery')}
                  />
                  Delivery
                </label>
              )}

              {fieldError('fulfilment') && (
                <span className="error" role="alert">
                  {fieldError('fulfilment')}
                </span>
              )}
            </fieldset>

            <fieldset className="panel">
              <legend>2. Your details</legend>

              <p className="muted">
                Name and email come from your account: {user.fullName},{' '}
                {user.email}.
              </p>

              <div className="field">
                <label htmlFor="c-phone">Phone number</label>
                <input
                  id="c-phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  aria-invalid={!!fieldError('contactPhone')}
                  aria-describedby="c-phone-err"
                  required
                />
                <span id="c-phone-err" className="error">
                  {fieldError('contactPhone')}
                </span>
              </div>

              {fulfilment === 'delivery' && (
                <div className="field">
                  <label htmlFor="c-addr">Delivery address</label>
                  <input
                    id="c-addr"
                    autoComplete="street-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    aria-invalid={!!fieldError('deliveryAddress')}
                    aria-describedby="c-addr-err"
                    required
                  />
                  <span id="c-addr-err" className="error">
                    {fieldError('deliveryAddress')}
                  </span>
                </div>
              )}
            </fieldset>

            <fieldset className="panel">
              <legend>3. Payment</legend>

              <h3>Bank Transfer</h3>

              <p>
                We accept payment by bank transfer.
              </p>

              <p className="muted">
                After placing your order, you will see the
                supermarket's bank name, account name and account
                number, together with your exact order amount and
                order reference.
              </p>

              <p className="muted">
                You can then submit your bank transaction reference
                on your order page.
              </p>

              <p className="muted">
                Your payment will remain pending until the supermarket
                verifies that the transfer has been received.
              </p>
            </fieldset>
          </div>

          <aside className="summary" aria-label="Order summary">
            <h2>Order summary</h2>

            {status === 'loading' && (
              <div
                className="skeleton"
                style={{ height: 120 }}
                role="status"
                aria-label="Loading summary"
              />
            )}

            {status === 'ready' && (
              <>
                <ul className="summary-lines">
                  {quote.lines.map((l) => (
                    <li key={l.productId}>
                      <span>
                        {l.quantity} x {l.name}
                      </span>
                      <span>
                        {l.unitPriceKobo != null
                          ? formatNaira(l.unitPriceKobo * l.quantity)
                          : ''}
                      </span>
                    </li>
                  ))}
                </ul>

                <dl className="totals">
                  <dt>Subtotal</dt>
                  <dd>{formatNaira(quote.subtotalKobo)}</dd>

                  <dt>Delivery fee</dt>
                  <dd>
                    {fulfilment === 'delivery'
                      ? formatNaira(quote.deliveryFeeKobo)
                      : fulfilment === 'pickup'
                        ? formatNaira(0)
                        : 'Choose an option'}
                  </dd>

                  <dt>
                    <strong>Total</strong>
                  </dt>
                  <dd>
                    <strong>{formatNaira(quote.totalKobo)}</strong>
                  </dd>
                </dl>

                <p className="muted">
                  The final total is calculated again by the server
                  when you place the order.
                </p>

                <button
                  className="btn"
                  type="submit"
                  disabled={
                    busy ||
                    quote.lines.some((l) => l.problem) ||
                    (!options.delivery && !options.pickup)
                  }
                >
                  {busy ? 'Placing order' : 'Place order'}
                </button>

                {quote.lines.some((l) => l.problem) && (
                  <p className="error" role="alert">
                    Some items are unavailable.{' '}
                    <Link to="/cart">Review your cart</Link>.
                  </p>
                )}
              </>
            )}
          </aside>
        </form>
      )}
    </div>
  );
}