import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition } from '../src/utils/orderStatus.js';
import { priceOrder, mergeLines } from '../src/utils/orderPricing.js';

test('valid and invalid status transitions', () => {
  assert.equal(canTransition('placed', 'confirmed', 'pickup'), true);
  assert.equal(canTransition('placed', 'delivered', 'pickup'), false);
  assert.equal(canTransition('delivered', 'cancelled', 'pickup'), false);
  assert.equal(canTransition('cancelled', 'confirmed', 'delivery'), false);
});
test('ready is pickup only and dispatched is delivery only', () => {
  assert.equal(canTransition('processing', 'ready', 'pickup'), true);
  assert.equal(canTransition('processing', 'ready', 'delivery'), false);
  assert.equal(canTransition('processing', 'dispatched', 'delivery'), true);
  assert.equal(canTransition('processing', 'dispatched', 'pickup'), false);
});
test('prices come from unit price times quantity in integer kobo', () => {
  const t = priceOrder([{ unitPriceKobo: 1999, quantity: 3 }, { unitPriceKobo: 10, quantity: 1 }], 500);
  assert.deepEqual(t, { subtotalKobo: 6007, deliveryFeeKobo: 500, totalKobo: 6507 });
});
test('rejects bad quantities and merges duplicates', () => {
  assert.throws(() => priceOrder([{ unitPriceKobo: 1, quantity: 0 }]), RangeError);
  assert.throws(() => priceOrder([{ unitPriceKobo: 1.5, quantity: 1 }]), RangeError);
  assert.deepEqual(mergeLines([{ productId: 2, quantity: 1 }, { productId: 1, quantity: 2 }, { productId: 2, quantity: 3 }]),
    [{ productId: 1, quantity: 2 }, { productId: 2, quantity: 4 }]);
});
