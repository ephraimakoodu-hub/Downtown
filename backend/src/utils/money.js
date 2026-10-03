// All money is stored and computed as integer kobo (1 NGN = 100 kobo).
// Floating point is never used for monetary arithmetic.
export function nairaToKobo(input) {
  const s = String(input).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new RangeError('Invalid naira amount');
  const [whole, frac = ''] = s.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

export function koboToNaira(kobo) {
  if (!Number.isInteger(kobo) || kobo < 0) throw new RangeError('Invalid kobo amount');
  return `${Math.floor(kobo / 100)}.${String(kobo % 100).padStart(2, '0')}`;
}
