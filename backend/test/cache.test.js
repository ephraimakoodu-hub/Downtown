import test from 'node:test';
import assert from 'node:assert/strict';
import { cacheGet, cacheSet, cacheClear, cached } from '../src/lib/cache.js';

test('stores and retrieves a value within its TTL', () => {
  cacheSet('k1', { a: 1 }, 1000);
  assert.deepEqual(cacheGet('k1'), { a: 1 });
});
test('expired entries are not returned', async () => {
  cacheSet('k2', 'x', 1);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(cacheGet('k2'), undefined);
});
test('clear removes entries by prefix, and clear() with no prefix clears everything', () => {
  cacheSet('cat:1', 'a', 1000); cacheSet('cat:2', 'b', 1000); cacheSet('other', 'c', 1000);
  cacheClear('cat:');
  assert.equal(cacheGet('cat:1'), undefined); assert.equal(cacheGet('other'), 'c');
  cacheClear();
  assert.equal(cacheGet('other'), undefined);
});
test('cached() computes once and reuses the value until it expires', async () => {
  let calls = 0;
  const fn = async () => { calls += 1; return calls; };
  assert.equal(await cached('c1', 1000, fn), 1);
  assert.equal(await cached('c1', 1000, fn), 1);
  assert.equal(calls, 1);
});
