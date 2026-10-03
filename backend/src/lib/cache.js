// Small in-memory TTL cache for read-heavy, non-personal data (category list, published product pages).
// Deliberately not Redis: this app has one web process so far, and a shared cache has no measured
// benefit yet (see docs/ARCHITECTURE.md). Never used for anything customer-specific or authenticated.
const store = new Map();

export function cacheGet(key) {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) { store.delete(key); return undefined; }
  return hit.value;
}

export function cacheSet(key, value, ttlMs) {
  store.set(key, { value, expires: Date.now() + ttlMs });
}

// Call after any write that changes what a cached read would return (e.g. product publish, category add).
export function cacheClear(prefix) {
  for (const key of store.keys()) if (!prefix || key.startsWith(prefix)) store.delete(key);
}

export async function cached(key, ttlMs, fn) {
  const hit = cacheGet(key);
  if (hit !== undefined) return hit;
  const value = await fn();
  cacheSet(key, value, ttlMs);
  return value;
}
