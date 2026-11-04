import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'playwright';
import {waitForStorefront} from '../src/propagation.mjs';
const config = {domain: 'fixture.invalid', handle: 'towel', variant: 'gid://shopify/ProductVariant/1'};
test('observer checks exact public variant availability and disposes context', async t => {
  let disposed = false;
  t.mock.method(request, 'newContext', async () => ({
    get: async () => ({
      status: () => 200,
      ok: () => true,
      json: async () => ({variants: [{id: 1, available: true}]}),
    }),
    dispose: async () => {
      disposed = true;
    },
  }));
  assert.deepEqual(await waitForStorefront(config, true), {attempts: 1, available: true});
  assert.ok(disposed);
});
test('429 stops observer immediately without retry', async t => {
  let calls = 0,
    disposed = false;
  t.mock.method(request, 'newContext', async () => ({
    get: async () => {
      calls++;
      return {status: () => 429};
    },
    dispose: async () => {
      disposed = true;
    },
  }));
  await assert.rejects(() => waitForStorefront(config, true), /429/);
  assert.equal(calls, 1);
  assert.ok(disposed);
});

test('a coupon change waits for a fresh cart to agree, then gives up as unverified', async () => {
  const {waitForCoupon} = await import('../src/propagation.mjs');
  const results = [{success: false}, {success: true}];
  assert.deepEqual(await waitForCoupon(attempt => results[attempt], true, {delay: 0}), {
    attempts: 2,
    accepted: true,
  });
  await assert.rejects(
    waitForCoupon(() => ({success: false}), true, {attempts: 2, delay: 0}),
    /applied but not verified/,
  );
  assert.deepEqual(await waitForCoupon(() => ({success: false}), false, {delay: 0}), {
    attempts: 1,
    accepted: false,
  });
});
