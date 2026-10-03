// Pure pricing helpers. The server always computes totals from database prices.
export function priceOrder(lines, deliveryFeeKobo = 0) {
  let subtotal = 0;
  for (const l of lines) {
    if (!Number.isInteger(l.unitPriceKobo) || !Number.isInteger(l.quantity) || l.quantity < 1) {
      throw new RangeError('Invalid line');
    }
    subtotal += l.unitPriceKobo * l.quantity;
  }
  return { subtotalKobo: subtotal, deliveryFeeKobo, totalKobo: subtotal + deliveryFeeKobo };
}

// Merge duplicate product lines so a client cannot bypass limits by repeating a product.
export function mergeLines(items) {
  const map = new Map();
  for (const i of items) map.set(i.productId, (map.get(i.productId) || 0) + i.quantity);
  return [...map.entries()].map(([productId, quantity]) => ({ productId, quantity })).sort((a, b) => a.productId - b.productId);
}
