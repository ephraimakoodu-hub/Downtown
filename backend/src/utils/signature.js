import { createHmac, timingSafeEqual } from 'node:crypto';

// Verifies a hex HMAC-SHA512 of the raw body. The real payment provider's scheme must be confirmed.
export function verifySignature(rawBody, signature, secret) {
  if (!secret || !signature) return false;
  const expected = Buffer.from(createHmac('sha512', secret).update(rawBody).digest('hex'), 'utf8');
  const given = Buffer.from(String(signature), 'utf8');
  return expected.length === given.length && timingSafeEqual(expected, given);
}
