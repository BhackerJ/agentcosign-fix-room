import {test} from 'node:test';
import assert from 'node:assert/strict';
import {agentOutcome} from '../src/agent-shopper.mjs';
const agent = {
  status: 'ok',
  guard_stops: [],
  cart_observed: true,
  report: 'DONE: observed one towel in the cart',
};
test('agent claim alone cannot pass a failed independent cart check', () =>
  assert.throws(() => agentOutcome(agent, {success: false})));
test('probe success alone cannot pass an incomplete shopping-agent run', () =>
  assert.throws(() =>
    agentOutcome({...agent, report: 'CANNOT_COMPLETE: browser challenge'}, {success: true}),
  ));
test('timeout or guard stop blocks completion', () => {
  assert.throws(() => agentOutcome({...agent, status: 'timeout'}, {}));
  assert.throws(() => agentOutcome({...agent, guard_stops: ['challenge']}, {}));
});
test('matching agent and independent results pass', () =>
  assert.equal(agentOutcome(agent, {success: true}).success, true));
test('sold-out baseline needs agent and browser evidence', () => {
  assert.equal(
    agentOutcome(
      {...agent, report: 'CANNOT_COMPLETE: sold out', purchase_disabled_observed: true},
      {unavailable: true},
    ).unavailable,
    true,
  );
  assert.throws(() => agentOutcome({...agent, report: 'CANNOT_COMPLETE: empty cart'}, {unavailable: true}));
});

test('a DONE report without recorded cart observation is rejected', () =>
  assert.throws(() => agentOutcome({...agent, cart_observed: false}, {success: true})));

test('an explanatory preface does not erase an explicit unavailable marker', () =>
  assert.equal(
    agentOutcome(
      {
        ...agent,
        report: 'The purchase button is disabled.\n\nCANNOT_COMPLETE: sold out',
        purchase_disabled_observed: true,
      },
      {unavailable: true},
    ).unavailable,
    true,
  ));

test('a rejected coupon needs the agent and the probe to agree', async () => {
  const {agentOutcome} = await import('../src/agent-shopper.mjs');
  const agent = {
    status: 'ok',
    report: 'CANNOT_COMPLETE\nDiscount code cannot be applied to your cart',
    purchase_disabled_observed: true,
  };
  assert.equal(agentOutcome(agent, {success: false, unavailable: true}).unavailable, true);
  assert.throws(() => agentOutcome(agent, {success: true, unavailable: false}), /did not confirm/);
  assert.throws(
    () => agentOutcome({...agent, purchase_disabled_observed: false}, {success: false, unavailable: true}),
    /did not confirm/,
  );
});
