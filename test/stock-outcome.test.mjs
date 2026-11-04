import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stockOutcome} from '../src/stock-outcome.mjs';
test('sold-out rejection after enabled button is unavailable', () => {
  assert.deepEqual(
    stockOutcome(false, "The product 'Demo Hand Towel - Single' is already sold out.", [], '1'),
    {unavailable: true, success: false},
  );
});
test('empty cart alone is not proof of sold out', () => {
  assert.deepEqual(stockOutcome(false, 'Add to cart', [], '1'), {unavailable: false, success: false});
});
test('actual matching cart wins over stale sold-out text', () => {
  assert.deepEqual(stockOutcome(false, 'already sold out', [{variant_id: '1', quantity: 1}], '1'), {
    unavailable: false,
    success: true,
  });
});
