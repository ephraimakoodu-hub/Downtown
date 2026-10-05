
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError, formatNaira } from '../lib/api.js';
import { useCart } from '../lib/cart.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useQuote } from './Cart.jsx';
import { EmptyState, ErrorState } from '../components/States.jsx';

// Generate a unique key for each checkout attempt.
// This supports browsers where crypto.randomUUID is unavailable.
function createIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);

    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function Checkout() {
  const { items, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [fulfilment, setFulfilment] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Keep one key throughout this checkout attempt.
  const idemKey = useRef(null);

  if (!idemKey.current) {
    idemKey.current = createIdempotencyKey();
  }

  const {
    status,
    quote,
    error: qError,
    retry
  } = useQuote(items, fulfilment || undefined);

  const fieldError = (name) =>
    error?.fields?.find((field) => field.field === name)?.message;

  const options = useMemo(
    () => ({
      delivery: Boolean(quote?.deliveryEnabled),
      pickup: Boolean(quote?.pickupEnabled)
    }),
    [quote]
  );

  if (user === undefined) {
    return (
      <main className="container page">
        <div
          className="skeleton"
          style={{ height: 200 }}
          role="status"
          aria-label="Loading account"
        />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="container page">
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
      </main>
    );
  }

  if (!items.length) {
    return (
      <main className="container page">
        <EmptyState
          title="Your cart is empty"
          actions={
            <Link className="btn" to="/products">
              Continue shopping
            </Link>
          }
        >
          Add products before checking out.
        </EmptyState>
      </main>
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

    if (!phone.trim()) {
      setError(
        new ApiError(400, {
          error: {
            message: 'Enter your phone number.',
            fields: [
              {
                field: 'contactPhone',
                message: 'Enter your phone number.'
              }
            ]
          }
        })
      );
      return;
    }

    if (fulfilment === 'delivery' && !address.trim()) {
      setError(
        new ApiError(400, {
          error: {
            message: 'Enter your delivery address.',
            fields: [
              {
                field: 'deliveryAddress',
                message: 'Enter your delivery address.'
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
          contactPhone: phone.trim(),
          ...(fulfilment === 'delivery'
            ? { deliveryAddress: address.trim() }
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

      if (!data?.order?.ref) {
        throw new ApiError(500, {
          error: {
            message:
              'The server response was incomplete. Please check your orders before trying again.'
          }
        });
      }

      clear();

      navigate(`/account/orders/${data.order.ref}`, {
        state: { placed: true }
      });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err
          : new ApiError(0, {
              error: {
                message:
                  'Something went wrong. Please try again.'
              }
            })
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container page checkout-page">
      <h1>Checkout</h1>

      {status === 'error' && (
        <ErrorState
          message={qError?.message || 'Unable to load your order summary.'}
          onRetry={retry}
        />
      )}

      {error && (
        <div className="alert alert-error" role="alert">
          {error.message}
        </div>
      )}

      {status !== 'error' && (
        <form
          className="cart-layout checkout-layout"
          onSubmit={submit}
          noValidate
        >
          <div className="checkout-main">
            <fieldset className="panel">
              <legend>1. Delivery or pickup</legend>

              {quote && !options.delivery && !options.pickup && (
                <p className="alert alert-error" role="alert">
                  Ordering is not available yet. The store has not
                  switched on delivery or pickup.
                </p>
              )}

              {options.pickup && (
                <label className="check">
                  <input
                    type="radio"
                    name="fulfilment"
                    value="pickup"
                    checked={fulfilment === 'pickup'}
                    onChange={() => {
                      setFulfilment('pickup');
                      setError(null);
                    }}
                  />
                  Pickup
                </label>
              )}

              {options.delivery && (
                <label className="check">
                  <input
                    type="radio"
                    name="fulfilment"
                    value="delivery"
                    checked={fulfilment === 'delivery'}
                    onChange={() => {
                      setFulfilment('delivery');
                      setError(null);
                    }}
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
                Name and email come from your account:{' '}
                {user.fullName}, {user.email}.
              </p>

              <div className="field">
                <label htmlFor="c-phone">Phone number</label>
                <input
                  id="c-phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
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
                  <textarea
                    id="c-addr"
                    autoComplete="street-address"
                    rows={3}
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

              <p>We accept payment by bank transfer.</p>

              <p className="muted">
                After placing your order, you will see the store's
                bank name, account name and account number, together
                with your exact order amount and order reference.
              </p>

              <p className="muted">
                You can then submit your bank transaction reference
                on your order page.
              </p>

              <p className="muted">
                Your payment will remain pending until the store
                verifies that the transfer has been received.
              </p>
            </fieldset>
          </div>

          <aside className="summary checkout-summary" aria-label="Order summary">
            <h2>Order summary</h2>

            {status === 'loading' && (
              <div
                className="skeleton"
                style={{ height: 120 }}
                role="status"
                aria-label="Loading order summary"
              />
            )}

            {status === 'ready' && quote && (
              <>
                <ul className="summary-lines">
                  {quote.lines.map((line) => (
                    <li key={line.productId}>
                      <span>
                        {line.quantity} x {line.name}
                      </span>

                      <span>
                        {line.unitPriceKobo != null
                          ? formatNaira(
                              line.unitPriceKobo * line.quantity
                            )
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
                    <strong>
                      {formatNaira(quote.totalKobo)}
                    </strong>
                  </dd>
                </dl>

                <p className="muted">
                  The final total is calculated again by the server
                  when you place the order.
                </p>

                <button
                  className="btn checkout-submit"
                  type="submit"
                  disabled={
                    busy ||
                    quote.lines.some((line) => line.problem) ||
                    (!options.delivery && !options.pickup)
                  }
                >
                  {busy ? 'Placing order...' : 'Place order'}
                </button>

                {quote.lines.some((line) => line.problem) && (
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
    </main>
  );
}