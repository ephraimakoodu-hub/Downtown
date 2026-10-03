import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const { refresh } = useAuth();
  const [state, setState] = useState('checking');
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = params.get('token');
    if (!token) { setState('missing'); return; }
    api('/auth/verify-email', { method: 'POST', body: { token } })
      .then(() => { setState('done'); refresh(); })
      .catch((err) => { setState('error'); setError(err instanceof ApiError ? err.message : 'Something went wrong.'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return (
    <div className="container page narrow">
      <h1>Email verification</h1>
      {state === 'checking' && <div className="skeleton" style={{ height: 80 }} role="status" aria-label="Verifying" />}
      {state === 'missing' && <p>This link is missing its verification code.</p>}
      {state === 'done' && <div className="alert" role="status">Your email address is now verified. <Link to="/account">Go to my account</Link></div>}
      {state === 'error' && <div className="alert alert-error" role="alert">{error} <Link to="/account">Go to my account</Link> to request a new link.</div>}
    </div>
  );
}
