import {test} from 'node:test';
import assert from 'node:assert/strict';
import {copy, currentValue, resultOf, validateTarget} from '../src/cases.mjs';
import {receiptUpdate} from '../src/buttons.mjs';

test('coupon targets are bounded and a reset must restore the fixture fault', () => {
  validateTarget({mode: 'promotion', target: 30});
  validateTarget({mode: 'promotion-reset', target: 50});
  assert.throws(() => validateTarget({mode: 'promotion', target: 0}));
  assert.throws(() => validateTarget({mode: 'promotion', target: 101}));
  assert.throws(() => validateTarget({mode: 'promotion-reset', target: 30}));
});

test('stock targets keep their existing bounds', () => {
  validateTarget({mode: 'stock', target: 0});
  validateTarget({mode: 'reset', target: 0});
  assert.throws(() => validateTarget({mode: 'reset', target: 25}));
  assert.throws(() => validateTarget({mode: 'stock', target: 101}));
});

test('results compare the fresh cart with the baseline', () => {
  assert.equal(
    resultOf({mode: 'promotion', baseline: {success: false}, retest: {success: true}}),
    'improved',
  );
  assert.equal(
    resultOf({mode: 'promotion', baseline: {success: false}, retest: {success: false}}),
    'not_improved',
  );
  assert.equal(
    resultOf({mode: 'promotion', baseline: {success: true}, retest: {success: true}}),
    'purchasable_before_and_after',
  );
  assert.equal(resultOf({mode: 'promotion-reset', retest: {unavailable: true}}), 'reset_verified');
  assert.equal(resultOf({mode: 'promotion-reset', retest: {unavailable: false}}), 'reset_not_verified');
});

test('coupon cards name the minimum and the measured discount', () => {
  const c = {
    id: 'offer-1',
    state: 'completed',
    mode: 'promotion',
    target: 30,
    before: {code: 'FIXROOM20', minimum: 50},
    retest: {success: true, discount_cents: 640, merchandise_after_discount_cents: 2560},
  };
  assert.equal(currentValue(c), 50);
  assert.match(copy(c).cardChange, /FIXROOM20.*\$50.*\$30/);
  assert.equal(copy(c).approveLabel, 'Approve $30 coupon minimum');
  const {message} = receiptUpdate(c, 'http://callback.invalid/actions');
  assert.match(message, /minimum is \$30/);
  assert.match(message, /\$6\.40 off/);
  assert.match(message, /\$25\.60 merchandise subtotal/);
});
