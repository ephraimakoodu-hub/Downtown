export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || 'The request could not be completed.');
    this.status = status;
    this.code = body?.error?.code;
    this.fields = body?.error?.fields;
  }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      signal,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, { error: { code: 'NETWORK', message: 'We could not reach the server. Check your connection and try again.' } });
  }
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { /* non JSON error page */ }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export function formatNaira(kobo) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(kobo / 100);
}
