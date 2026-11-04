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
