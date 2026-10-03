
import { useState, useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api, ApiError, formatNaira } from '../lib/api.js';
import { useFetch } from '../lib/useFetch.js';
import { useAuth } from '../lib/auth.jsx';
import { formatDate, STATUS_LABEL } from '../lib/format.js';
import { EmptyState, ErrorState } from '../components/States.jsx';
import { AuthForm } from './Account.jsx';

function Guard({ children }) {
  const { user } = useAuth();

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

  return user ? children : <AuthForm />;
}

export function OrderList() {
  const [page, setPage] = useState(1);
  const { status, data, error, retry } = useFetch(`/orders?page=${page}`);

  return (
    <Guard>
      <div className="container page">
        <h1>My orders</h1>

        {status === 'loading' && (
          <div
            className="skeleton"
            style={{ height: 200 }}
            role="status"
            aria-label="Loading orders"
          />
        )}

        {status === 'error' && (
          <ErrorState message={error.message} onRetry={retry} />
        )}

        {status === 'ready' && data.items.length === 0 && (
          <EmptyState
            title="No orders yet"
            actions={
              <Link className="btn" to="/products">
                Shop groceries
              </Link>
            }
          >
            Orders you place will appear here.
          </EmptyState>
        )}

        {status === 'ready' && data.items.length > 0 && (
          <>
            <ul className="order-list">
              {data.items.map((o) => (
                <li key={o.ref} className="panel">
                  <Link to={`/account/orders/${o.ref}`}>
                    <strong>Order {o.ref}</strong>
                  </Link>

                  <div className="muted">
                    {formatDate(o.createdAt)} ·{' '}
                    {o.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'}
                  </div>

                  <div>
                    <span className="badge badge-ok">
                      {STATUS_LABEL[o.status]}
                    </span>{' '}
                    <span className="price">
                      {formatNaira(o.totalKobo)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <nav className="pagination" aria-label="Pagination">
              <button
                className="btn btn-secondary"
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous page
              </button>

              <span>
                Page {page} of{' '}
                {Math.max(1, Math.ceil(data.total / data.pageSize))}
              </span>

              <button
                className="btn btn-secondary"
                type="button"
                disabled={page * data.pageSize >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next page
              </button>
            </nav>
          </>
        )}
      </div>
    </Guard>
  );
}

// Order progress
function Progress({ order }) {
  const steps =
    order.fulfilment === 'pickup'
      ? ['placed', 'confirmed', 'processing', 'ready', 'delivered']
      : ['placed', 'confirmed', 'processing', 'dispatched', 'delivered'];

  if (order.status === 'cancelled') {
    return (
      <p className="alert alert-error">
        This order was cancelled.
      </p>
    );
  }

  const current = steps.indexOf(order.status);

  return (
    <ol className="progress" aria-label="Order progress">
      {steps.map((s, i) => (
        <li
          key={s}
          className={i <= current ? 'done' : ''}
          aria-current={i === current ? 'step' : undefined}
        >
          <span className="dot" aria-hidden="true" />{' '}
          {STATUS_LABEL[s]}
          {i <= current ? (
            <span className="visually-hidden"> (reached)</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

// Bank transfer instructions and reference submission
function BankTransfer({ orderRef, orderStatus, paid }) {
  const [instructions, setInstructions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadInstructions() {
      setLoading(true);
      setError(null);

      try {
        const result = await api(
          `/orders/${encodeURIComponent(orderRef)}/payment-instructions`
        );

        if (active) {
          setInstructions(result);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'Could not load bank transfer details.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadInstructions();

    return () => {
      active = false;
    };
  }, [orderRef, reload]);

  async function copyAccountNumber() {
    try {
      await navigator.clipboard.writeText(
        String(instructions.bankAccountNumber)
      );

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(
        'Could not copy automatically. Please select and copy the account number.'
      );
    }
  }

  async function submitReference(e) {
    e.preventDefault();

    setError(null);
    setMessage(null);

    const cleanReference = reference.trim();

    if (cleanReference.length < 4 || cleanReference.length > 120) {
      setError('Enter a valid bank transaction reference.');
      return;
    }

    setBusy(true);

    try {
      await api(`/orders/${encodeURIComponent(orderRef)}/pay`, {
        method: 'POST',
        body: {
          providerReference: cleanReference
        }
      });

      setReference('');
      setMessage(
        'Your transfer reference has been submitted. Your payment is pending verification by the supermarket.'
      );
      setReload((v) => v + 1);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.fields?.[0]?.message || err.message
          : 'Could not submit your transfer reference. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  if (paid) {
    return (
      <div className="panel">
        <h2>Payment</h2>
        <p className="alert">
          Your payment has been confirmed. Thank you!
        </p>
      </div>
    );
  }

  if (orderStatus === 'cancelled') return null;

  if (loading) {
    return (
      <div className="panel">
        <h2>Bank transfer</h2>
        <div
          className="skeleton"
          style={{ height: 180 }}
          role="status"
          aria-label="Loading bank details"
        />
      </div>
    );
  }

  if (error && !instructions) {
    return (
      <div className="panel">
        <h2>Bank transfer</h2>
        <p className="alert alert-error">{error}</p>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => setReload((v) => v + 1)}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!instructions?.bankTransferEnabled) {
    return (
      <div className="panel">
        <h2>Bank transfer</h2>
        <p className="muted">
          Bank transfer instructions are not currently available.
          Please contact the supermarket.
        </p>
      </div>
    );
  }

  const paymentStatus = instructions.paymentStatus;

  return (
    <div
      className="panel"
      style={{
        border: '1px solid #F5B942',
        background: '#181B21',
        padding: '24px'
      }}
    >
      <div style={{ marginBottom: '20px' }}>
        <span
          style={{
            color: '#F5B942',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '1.5px',
            textTransform: 'uppercase'
          }}
        >
          Secure payment
        </span>

        <h2 style={{ marginTop: '8px', marginBottom: '8px' }}>
          Bank transfer
        </h2>

        <p className="muted" style={{ margin: 0 }}>
          Transfer the exact amount below to complete your order.
        </p>
      </div>

      <div
        style={{
          background: '#20242C',
          border: '1px solid #292E36',
          borderRadius: '12px',
          padding: '18px',
          marginBottom: '18px'
        }}
      >
        <p className="muted" style={{ margin: '0 0 6px' }}>
          Bank name
        </p>
        <strong style={{ fontSize: '17px' }}>
          {instructions.bankName}
        </strong>

        <div style={{ marginTop: '18px' }}>
          <p className="muted" style={{ margin: '0 0 6px' }}>
            Account name
          </p>
          <strong>{instructions.bankAccountName}</strong>
        </div>

        <div style={{ marginTop: '18px' }}>
          <p className="muted" style={{ margin: '0 0 6px' }}>
            Account number
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}
          >
            <strong
              style={{
                fontSize: '22px',
                letterSpacing: '1.5px',
                color: '#F5B942'
              }}
            >
              {instructions.bankAccountNumber}
            </strong>

            <button
              className="btn btn-secondary"
              type="button"
              onClick={copyAccountNumber}
            >
              {copied ? 'Copied!' : 'Copy number'}
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          background: '#292316',
          border: '1px solid #6B5420',
          borderRadius: '12px',
          padding: '18px',
          marginBottom: '18px'
        }}
      >
        <p
          style={{
            color: '#F5B942',
            margin: '0 0 8px',
            fontSize: '13px',
            fontWeight: 700
          }}
        >
          AMOUNT TO TRANSFER
        </p>

        <h2
          style={{
            color: '#F5B942',
            fontSize: '30px',
            margin: 0
          }}
        >
          {formatNaira(instructions.amountKobo)}
        </h2>

        <div style={{ marginTop: '18px' }}>
          <p className="muted" style={{ margin: '0 0 5px' }}>
            Order reference
          </p>
          <strong>
            {instructions.orderRef || orderRef}
          </strong>
        </div>
      </div>

      {paymentStatus === 'pending' && (
        <p className="alert">
          Your transaction reference has been submitted.
          Payment is awaiting supermarket verification.
        </p>
      )}

      {paymentStatus === 'failed' && (
        <p className="alert alert-error">
          The previous payment submission was rejected.
          You may submit a new transaction reference if you have
          completed a new transfer.
        </p>
      )}

      {message && (
        <p className="alert" role="status">
          {message}
        </p>
      )}

      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}

      {paymentStatus !== 'pending' && paymentStatus !== 'succeeded' && (
        <form onSubmit={submitReference} noValidate>
          <div className="field">
            <label htmlFor="bank-reference">
              Bank transaction reference
            </label>

            <input
              id="bank-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              minLength={4}
              maxLength={120}
              placeholder="Enter your transfer reference"
              required
            />
          </div>

          <button
            className="btn"
            type="submit"
            disabled={busy || !reference.trim()}
            style={{ width: '100%' }}
          >
            {busy ? 'Submitting...' : 'Submit transfer reference'}
          </button>
        </form>
      )}

      <p className="muted" style={{ fontSize: '13px', marginTop: '18px' }}>
        Submitting a reference does not confirm payment immediately.
        The supermarket must verify that the money has arrived.
      </p>
    </div>
  );
}

export function OrderDetail() {
  const { ref } = useParams();
  const location = useLocation();

  const {
    status,
    data,
    error,
    retry
  } = useFetch(`/orders/${encodeURIComponent(ref)}`);

  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [reason, setReason] = useState('');

  async function cancel() {
    if (
      !window.confirm(
        'Cancel this order? Reserved items will be released.'
      )
    ) {
      return;
    }

    setErr(null);

    try {
      await api(`/orders/${encodeURIComponent(ref)}/cancel`, {
        method: 'POST'
      });

      setMsg('Your order was cancelled.');
      retry();
    } catch (e) {
      setErr(
        e instanceof ApiError
          ? e.message
          : 'Something went wrong.'
      );
    }
  }

  async function refund(e) {
    e.preventDefault();
    setErr(null);

    try {
      await api(`/orders/${encodeURIComponent(ref)}/refund-request`, {
        method: 'POST',
        body: { reason }
      });

      setMsg(
        'Your refund request was sent to the supermarket.'
      );

      setReason('');
      retry();
    } catch (e2) {
      setErr(
        e2 instanceof ApiError
          ? e2.fields?.[0]?.message || e2.message
          : 'Something went wrong.'
      );
    }
  }

  return (
    <Guard>
      <div className="container page">
        <p>
          <Link to="/account/orders">← Back to my orders</Link>
        </p>

        {location.state?.placed && (
          <div className="alert" role="status">
            <strong>Your order was placed.</strong>{' '}
            Keep your order number: {ref}. Follow the bank transfer
            instructions alongside your order details.
          </div>
        )}

        {msg && (
          <div className="alert" role="status">
            {msg}
          </div>
        )}

        {err && (
          <div className="alert alert-error" role="alert">
            {err}
          </div>
        )}

        {status === 'loading' && (
          <div
            className="skeleton"
            style={{ height: 240 }}
            role="status"
            aria-label="Loading order"
          />
        )}

        {status === 'error' &&
          (error.status === 404 ? (
            <EmptyState
              title="Order not found"
              actions={
                <Link className="btn" to="/account/orders">
                  My orders
                </Link>
              }
            >
              Check the order number and make sure you are signed
              in to the right account.
            </EmptyState>
          ) : (
            <ErrorState
              message={error.message}
              onRetry={retry}
            />
          ))}

        {status === 'ready' && (() => {
          const o = data.order;

          return (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
                  gap: '24px',
                  alignItems: 'start'
                }}
              >
                {/* LEFT COLUMN: ORDER DETAILS */}
                <section style={{ minWidth: 0 }}>
                  <div className="panel">
                    <span
                      style={{
                        color: '#F5B942',
                        fontSize: '12px',
                        fontWeight: 700,
                        letterSpacing: '1.5px',
                        textTransform: 'uppercase'
                      }}
                    >
                      Order details
                    </span>

                    <h1 style={{ marginTop: '8px', marginBottom: '8px' }}>
                      Order {o.ref}
                    </h1>

                    <p className="muted">
                      {formatDate(o.createdAt)} ·{' '}
                      {o.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'}
                      {o.deliveryAddress
                        ? ` to ${o.deliveryAddress}`
                        : ''}
                    </p>

                    <h2 style={{ marginTop: '24px' }}>
                      Order progress
                    </h2>

                    <Progress order={o} />
                  </div>

                  <div className="panel" style={{ marginTop: '20px' }}>
                    <h2>Items ordered</h2>

                    <table className="table">
                      <caption className="visually-hidden">
                        Items in this order
                      </caption>

                      <thead>
                        <tr>
                          <th scope="col">Product</th>
                          <th scope="col">Quantity</th>
                          <th scope="col">Price</th>
                        </tr>
                      </thead>

                      <tbody>
                        {o.items.map((i) => (
                          <tr key={i.sku}>
                            <td data-label="Product">{i.name}</td>
                            <td data-label="Quantity">
                              {i.quantity}
                            </td>
                            <td data-label="Price">
                              {formatNaira(
                                i.unitPriceKobo * i.quantity
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <dl className="totals">
                      <dt>Subtotal</dt>
                      <dd>{formatNaira(o.subtotalKobo)}</dd>

                      <dt>Delivery fee</dt>
                      <dd>{formatNaira(o.deliveryFeeKobo)}</dd>

                      <dt>
                        <strong>Total</strong>
                      </dt>
                      <dd>
                        <strong>{formatNaira(o.totalKobo)}</strong>
                      </dd>
                    </dl>

                    <div
                      style={{
                        borderTop: '1px solid #292E36',
                        paddingTop: '15px',
                        marginTop: '15px'
                      }}
                    >
                      <span className="muted">Payment status: </span>
                      <strong style={{ color: o.paid ? '#65D6A1' : '#F5B942' }}>
                        {o.paid ? 'Paid' : 'Awaiting payment'}
                      </strong>
                    </div>
                  </div>

                  {['placed', 'confirmed'].includes(o.status) && (
                    <div style={{ marginTop: '20px' }}>
                      <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={cancel}
                      >
                        Cancel this order
                      </button>
                    </div>
                  )}

                  {['delivered', 'cancelled'].includes(o.status) &&
                    o.refunds.length === 0 && (
                      <form
                        className="panel"
                        style={{ marginTop: '20px' }}
                        onSubmit={refund}
                        noValidate
                      >
                        <h2>Request a refund</h2>

                        <div className="field">
                          <label htmlFor="rf">Reason</label>
                          <input
                            id="rf"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            maxLength={500}
                            required
                          />
                        </div>

                        <button className="btn" type="submit">
                          Send refund request
                        </button>
                      </form>
                    )}

                  {o.refunds.length > 0 && (
                    <div className="panel" style={{ marginTop: '20px' }}>
                      <h2>Refund request</h2>
                      <p>Status: {o.refunds[0].status}</p>
                    </div>
                  )}
                </section>

                {/* RIGHT COLUMN: BANK TRANSFER */}
                <aside style={{ minWidth: 0 }}>
                  <BankTransfer
                    orderRef={o.ref}
                    orderStatus={o.status}
                    paid={o.paid}
                  />
                </aside>
              </div>
            </>
          );
        })()}
      </div>
    </Guard>
  );
}