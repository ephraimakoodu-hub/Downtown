import { useState } from 'react';
import { api, ApiError } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

export default function EmailVerifyBanner() {
  const { user } = useAuth();
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!user || user.emailVerified) return null;

  async function resend() {
    setBusy(true); setMsg(null);
    try { const d = await api('/auth/resend-verification', { method: 'POST' }); setMsg(d.message); }
    catch (err) { setMsg(err instanceof ApiError ? err.message : 'Something went wrong.'); }
    finally { setBusy(false); }
  }
  return (
    <div className="alert" role="status">
      <strong>Verify your email address.</strong> We sent a verification link to {user.email} when you registered.
      {msg ? <> {msg}</> : <> <button type="button" className="link-btn" onClick={resend} disabled={busy}>{busy ? 'Sending' : 'Resend verification email'}</button></>}
    </div>
  );
}
