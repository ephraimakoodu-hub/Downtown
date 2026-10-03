export const formatDate = (d) => new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));
export const STATUS_LABEL = { placed: 'Order placed', confirmed: 'Confirmed', processing: 'Processing', ready: 'Ready for pickup', dispatched: 'Dispatched', delivered: 'Delivered', cancelled: 'Cancelled' };

export function nairaToKobo(input) {
  const s = String(input).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [w, f = ''] = s.split('.');
  return Number(w) * 100 + Number(f.padEnd(2, '0'));
}
export const koboToInput = (k) => (k == null ? '' : `${Math.floor(k / 100)}.${String(k % 100).padStart(2, '0')}`);
