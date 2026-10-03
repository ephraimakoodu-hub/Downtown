import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api.js';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const [pw, setPw] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  async function submit(e) {
    e.preventDefault(); setError(null);
    try { await api('/auth/reset-password', { method: 'POST', body: { token: params.get('token') || '', newPassword: pw } }); setDone(true); }
    catch (err) { setError(err instanceof ApiError ? err : new ApiError(0, null)); }
  }
  if (done) return <div className="container page narrow"><h1>Password changed</h1><p>You can now sign in with your new password.</p><Link className="btn" to="/account">Sign in</Link></div>;
  return (
    <div className="container page narrow">
      <h1>Choose a new password</h1>
      {error && <div className="alert alert-error" role="alert">{error.fields?.[0]?.message || error.message}</div>}
      <form onSubmit={submit} noValidate>
        <div className="field"><label htmlFor="rp">New password</label><input id="rp" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required /><span className="muted">At least 10 characters.</span></div>
        <button className="btn" type="submit">Save new password</button>
      </form>
    </div>
  );
}
