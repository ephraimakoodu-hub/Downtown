import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifySignature } from '../src/utils/signature.js';

const body = Buffer.from('{"reference":"r1","orderRef":"ABCDEFGHIJKL","amountKobo":1000,"status":"succeeded"}');
const good = createHmac('sha512', 's3cret').update(body).digest('hex');

test('accepts a correct signature', () => assert.equal(verifySignature(body, good, 's3cret'), true));
test('rejects wrong secret, tampered body, and missing values', () => {
  assert.equal(verifySignature(body, good, 'other'), false);
  assert.equal(verifySignature(Buffer.from('{"amountKobo":1}'), good, 's3cret'), false);
  assert.equal(verifySignature(body, undefined, 's3cret'), false);
  assert.equal(verifySignature(body, good, ''), false);
  assert.equal(verifySignature(body, 'short', 's3cret'), false);
});
