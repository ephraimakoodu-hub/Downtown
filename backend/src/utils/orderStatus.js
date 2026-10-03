// Allowed order status transitions. Business workflow must be confirmed before launch.
// 'ready' applies to pickup, 'dispatched' to delivery.
export const TRANSITIONS = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['ready', 'dispatched', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  dispatched: ['delivered'],
  delivered: [],
  cancelled: [],
};

// Stock leaves the shelf when the order is handed over for collection or dispatch.
export const COMMIT_STATUSES = new Set(['ready', 'dispatched']);

export function canTransition(from, to, fulfilment) {
  if (!TRANSITIONS[from]?.includes(to)) return false;
  if (to === 'ready' && fulfilment !== 'pickup') return false;
  if (to === 'dispatched' && fulfilment !== 'delivery') return false;
  return true;
}
