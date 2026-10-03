
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api.js';
import { useAuth, isStaff } from '../lib/auth.jsx';

export function AuthForm() {
  const { refresh } = useAuth();

  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: ''
  });
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) =>
    setForm((previous) => ({
      ...previous,
      [key]: e.target.value
    }));

  const fe = (name) =>
    error?.fields?.find((field) => field.field === name)?.message;

  async function submit(e) {
    e.preventDefault();

    setBusy(true);
    setError(null);
    setInfo(null);

    try {
      if (mode === 'forgot') {
        const data = await api('/auth/forgot-password', {
          method: 'POST',
          body: { email: form.email }
        });

        setInfo(data.message);
      } else {
        await api(`/auth/${mode}`, {
          method: 'POST',
          body:
            mode === 'login'
              ? {
                  email: form.email,
                  password: form.password
                }
              : form
        });

        await refresh();
      }
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

  const title = {
    login: 'Sign in',
    register: 'Create an account',
    forgot: 'Reset your password'
  }[mode];

  return (
    <div className="container page narrow">
      <h1>{title}</h1>

      {error && !error.fields && (
        <div className="alert alert-error" role="alert">
          {error.message}
        </div>
      )}

      {info && (
        <div className="alert" role="status">
          {info}
        </div>
      )}

      <form onSubmit={submit} noValidate>
        {mode === 'register' && (
          <div className="field">
            <label htmlFor="a-name">Full name</label>
            <input
              id="a-name"
              autoComplete="name"
              value={form.fullName}
              onChange={set('fullName')}
              aria-invalid={!!fe('fullName')}
              aria-describedby="a-name-err"
              required
            />
            <span id="a-name-err" className="error">
              {fe('fullName')}
            </span>
          </div>
        )}

        <div className="field">
          <label htmlFor="a-email">Email address</label>
          <input
            id="a-email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={set('email')}
            aria-invalid={!!fe('email')}
            aria-describedby="a-email-err"
            required
          />
          <span id="a-email-err" className="error">
            {fe('email')}
          </span>
        </div>

        {mode !== 'forgot' && (
          <div className="field">
            <label htmlFor="a-pass">Password</label>
            <input
              id="a-pass"
              type="password"
              autoComplete={
                mode === 'login'
                  ? 'current-password'
                  : 'new-password'
              }
              value={form.password}
              onChange={set('password')}
              aria-invalid={!!fe('password')}
              aria-describedby="a-pass-err"
              required
            />

            {mode === 'register' && (
              <span className="muted">
                At least 10 characters.
              </span>
            )}

            <span id="a-pass-err" className="error">
              {fe('password')}
            </span>
          </div>
        )}

        <button
          className="btn"
          type="submit"
          disabled={busy}
        >
          {busy
            ? 'Please wait'
            : {
                login: 'Sign in',
                register: 'Create account',
                forgot: 'Send reset instructions'
              }[mode]}
        </button>
      </form>

      <p className="auth-switch">
        {mode !== 'login' && (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setMode('login');
              setError(null);
              setInfo(null);
            }}
          >
            Back to sign in
          </button>
        )}

        {mode === 'login' && (
          <>
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setMode('register');
                setError(null);
                setInfo(null);
              }}
            >
              Create an account
            </button>

            {' '}

            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setMode('forgot');
                setError(null);
                setInfo(null);
              }}
            >
              Forgot your password?
            </button>
          </>
        )}
      </p>

      {mode === 'register' && (
        <p className="muted">
          By creating an account you agree to the{' '}
          <Link to="/terms">terms</Link> and acknowledge the{' '}
          <Link to="/privacy">privacy policy</Link>.
        </p>
      )}
    </div>
  );
}

function ChangePassword() {
  const [f, setF] = useState({
    currentPassword: '',
    newPassword: ''
  });

  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();

    setMsg(null);
    setError(null);
    setBusy(true);

    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: f
      });

      setMsg('Your password was changed.');

      setF({
        currentPassword: '',
        newPassword: ''
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
    <form onSubmit={submit} className="panel" noValidate>
      <h2>Change password</h2>

      {msg && (
        <div className="alert" role="status">
          {msg}
        </div>
      )}

      {error && (
        <div className="alert alert-error" role="alert">
          {error.fields?.[0]?.message || error.message}
        </div>
      )}

      <div className="field">
        <label htmlFor="cp-cur">Current password</label>
        <input
          id="cp-cur"
          type="password"
          autoComplete="current-password"
          value={f.currentPassword}
          onChange={(e) =>
            setF({
              ...f,
              currentPassword: e.target.value
            })
          }
          required
        />
      </div>

      <div className="field">
        <label htmlFor="cp-new">New password</label>
        <input
          id="cp-new"
          type="password"
          autoComplete="new-password"
          value={f.newPassword}
          onChange={(e) =>
            setF({
              ...f,
              newPassword: e.target.value
            })
          }
          required
        />
        <span className="muted">
          At least 10 characters.
        </span>
      </div>

      <button
        className="btn"
        type="submit"
        disabled={busy}
      >
        {busy ? 'Changing password...' : 'Change password'}
      </button>
    </form>
  );
}

export default function Account() {
  const { user, logout } = useAuth();

  if (user === undefined) {
    return (
      <div className="container page">
        <div
          className="skeleton"
          style={{ height: 200 }}
          role="status"
          aria-label="Loading account"
        />
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <div className="container page narrow">
      <h1>My account</h1>

      <div className="panel">
        <p>
          <strong>{user.fullName}</strong>
          <br />
          {user.email}
        </p>

        <div className="actions-row">
          <Link className="btn" to="/account/orders">
            View my orders
          </Link>

          <Link
            className="btn btn-secondary"
            to="/account/reviews"
          >
            Write a review
          </Link>

          {isStaff(user) && (
            <Link
              className="btn btn-secondary"
              to="/admin"
            >
              Open staff dashboard
            </Link>
          )}

          <button
            className="btn btn-secondary"
            type="button"
            onClick={logout}
          >
            Sign out
          </button>
        </div>
      </div>

      <ChangePassword />
    </div>
  );
}