import {test} from 'node:test';
import assert from 'node:assert/strict';
import {offerOutcome} from '../src/offer-outcome.mjs';

const cart = (overrides = {}) => ({
  items: [{variant_id: 7, quantity: 2, original_line_price: 3200}],
  discount_codes: [{code: 'FIXROOM20', applicable: true}],
  total_discount: 640,
  items_subtotal_price: 2560,
  ...overrides,
});
const outcome = (value, message = '') => offerOutcome(value, '7', 'FIXROOM20', 20, message);

test('the exact expected discount on the expected cart is a success', () => {
  const result = outcome(cart());
  assert.equal(result.success, true);
  assert.equal(result.unavailable, false);
  assert.equal(result.discount_cents, 640);
  assert.equal(result.merchandise_after_discount_cents, 2560);
});

test('a rejected code is reported as unavailable, not as an inconclusive cart', () => {
  const result = outcome(
    cart({
      discount_codes: [{code: 'FIXROOM20', applicable: false}],
      total_discount: 0,
      items_subtotal_price: 3200,
    }),
    'Discount code cannot be applied to your cart',
  );
  assert.equal(result.success, false);
  assert.equal(result.unavailable, true);
});

test('an accepted code with the wrong amount or quantity is not a success', () => {
  assert.equal(outcome(cart({total_discount: 320, items_subtotal_price: 2880})).success, false);
  assert.equal(
    outcome(cart({items: [{variant_id: 7, quantity: 1, original_line_price: 3200}]})).success,
    false,
  );
  assert.equal(outcome(cart({items: []})).success, false);
});

test('a failed check without the rejection message stays inconclusive', () => {
  assert.equal(
    outcome(cart({discount_codes: [], total_discount: 0, items_subtotal_price: 3200})).unavailable,
    false,
  );
});
