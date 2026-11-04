import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseIntent} from '../src/conversation.mjs';
test('intent accepts JSON wrappers and only explicit bounded stock facts', () => {
  assert.deepEqual(parseIntent('```json\n{"action":"inspect","quantity":null}\n```', false), {
    action: 'inspect',
    quantity: null,
  });
  for (const body of [
    '{"action":"approve","quantity":25}',
    '{"action":"fact","quantity":101}',
    '{"action":"fact","quantity":-1}',
    '{"action":"fact","quantity":"25"}',
  ])
    assert.equal(parseIntent(body, true).action, 'unknown');
  assert.equal(parseIntent('{"action":"fact","quantity":25}', false).action, 'unknown');
});

test('coupon actions are recognized, and a fact still needs a waiting case', async () => {
  const {parseIntent} = await import('../src/conversation.mjs');
  assert.equal(parseIntent('{"action":"inspect_coupon","quantity":null}', false).action, 'inspect_coupon');
  assert.equal(parseIntent('{"action":"reset_coupon","quantity":null}', false).action, 'reset_coupon');
  assert.equal(parseIntent('{"action":"fact","quantity":30}', true).quantity, 30);
  assert.equal(parseIntent('{"action":"fact","quantity":30}', false).action, 'unknown');
});
