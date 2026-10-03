import test from 'node:test';
import assert from 'node:assert/strict';
import { nairaToKobo, koboToNaira } from '../src/utils/money.js';

test('converts naira strings to integer kobo without float error', () => {
  assert.equal(nairaToKobo('0.10'), 10);
  assert.equal(nairaToKobo('1234.5'), 123450);
  assert.equal(nairaToKobo('19.99'), 1999);
});
test('rejects malformed amounts', () => {
  for (const bad of ['-1', '1.234', 'abc', '', '1e3']) assert.throws(() => nairaToKobo(bad), RangeError);
});
test('formats kobo as naira', () => {
  assert.equal(koboToNaira(5), '0.05');
  assert.equal(koboToNaira(123450), '1234.50');
});
