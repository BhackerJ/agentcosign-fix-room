import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Shopify} from '../src/shopify.mjs';
const env = {INVENTORY_ITEM_ID: 'item', LOCATION_ID: 'loc', VARIANT_ID: 'variant'};
const snapshot = {store: 'store', location: 'loc', item: {inventoryLevel: {quantities: [{quantity: 0}]}}};
test('changed baseline prevents mutation', async () => {
  const s = new Shopify(env);
  s.snapshot = async () => ({...snapshot, store: 'changed'});
  s.gql = async () => {
    throw Error('Must not write');
  };
  await assert.rejects(() => s.apply({before: snapshot, target: 25}), /CONFLICT/);
});
test('mutation binds expected quantity and idempotency key and verifies readback', async () => {
  const s = new Shopify(env);
  let reads = 0;
  s.snapshot = async () =>
    reads++ ? {...snapshot, item: {inventoryLevel: {quantities: [{quantity: 25}]}}} : snapshot;
  s.gql = async (q, v) => {
    assert.equal(v.key, 'proposal-hash');
    assert.deepEqual(v.input.quantities, [
      {inventoryItemId: 'item', locationId: 'loc', quantity: 25, changeFromQuantity: 0},
    ]);
    return {inventorySetQuantities: {userErrors: []}};
  };
  await s.apply({id: 'stock-1', version: 1, hash: 'proposal-hash', before: snapshot, target: 25});
  assert.equal(reads, 2);
});
test('unknown write result is not retried by adapter', async () => {
  const s = new Shopify(env);
  s.snapshot = async () => snapshot;
  let calls = 0;
  s.gql = async () => {
    calls++;
    throw Error('timeout');
  };
  await assert.rejects(() => s.apply({before: snapshot}), /timeout/);
  assert.equal(calls, 1);
});

test('the coupon write changes only the minimum and refuses a changed or mismatched coupon', async () => {
  const env = {SHOPIFY_DOMAIN: 'store', DISCOUNT_ID: 'id', DISCOUNT_CODE: 'SAVE20', OFFER_HANDLE: 'pouch'};
  const coupon = (amount, overrides = {}) => ({
    codeDiscountNode: {
      codeDiscount: {
        status: 'ACTIVE',
        codes: {nodes: [{code: 'SAVE20'}]},
        minimumRequirement: {greaterThanOrEqualToSubtotal: {amount, currencyCode: 'USD'}},
        customerGets: {value: {percentage: 0.2}, items: {products: {nodes: [{handle: 'pouch'}]}}},
        ...overrides,
      },
    },
  });
  let current = coupon('50.0');
  const writes = [];
  const shopify = new Shopify(env);
  shopify.gql = async (query, variables) => {
    if (!query.startsWith('mutation')) return current;
    writes.push(variables);
    current = coupon(variables.input.minimumRequirement.subtotal.greaterThanOrEqualToSubtotal);
    return {discountCodeBasicUpdate: {userErrors: []}};
  };
  const before = await shopify.discountSnapshot();
  assert.equal(before.minimum, 50);
  assert.equal(before.percentage, 20);
  const after = await shopify.applyCouponMinimum({before, target: 30});
  assert.equal(after.minimum, 30);
  assert.deepEqual(writes, [
    {id: 'id', input: {minimumRequirement: {subtotal: {greaterThanOrEqualToSubtotal: '30.00'}}}},
  ]);

  await assert.rejects(shopify.applyCouponMinimum({before, target: 25}), /CONFLICT/);
  assert.equal(writes.length, 1);

  current = coupon('50.0', {codes: {nodes: [{code: 'OTHER'}]}});
  await assert.rejects(shopify.discountSnapshot(), /Fixture mapping mismatch/);

  current = coupon('50.0');
  const fresh = await shopify.discountSnapshot();
  shopify.gql = async (query, variables) => {
    if (!query.startsWith('mutation')) return writes.length > 1 ? coupon('50.0') : current;
    writes.push(variables);
    return {discountCodeBasicUpdate: {userErrors: []}};
  };
  await assert.rejects(shopify.applyCouponMinimum({before: fresh, target: 30}), /read-back mismatch/);
});
