import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtemp, mkdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocketServer} from 'ws';
import {State} from '../src/state.mjs';

const WORKER = fileURLToPath(new URL('../src/worker.mjs', import.meta.url));
const STUB = new URL('./stub-network.mjs', import.meta.url).href;
const ROOM = 'room';
const STORE = 'store.invalid';
const BEFORE = {
  store: STORE,
  location: 'location',
  item: {
    id: 'item',
    tracked: true,
    inventoryLevel: {quantities: [{name: 'available', quantity: 0}]},
    variant: {
      id: 'variant',
      sku: 'SKU',
      price: '12.00',
      inventoryPolicy: 'DENY',
      product: {id: 'product', handle: 'towel'},
    },
  },
};

const listen = server =>
  new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));

async function freePort() {
  const server = createServer();
  const port = await listen(server);
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function until(check, label) {
  const deadline = Date.now() + 20000;
  for (;;) {
    const value = check();
    if (value) return value;
    if (Date.now() > deadline) throw Error(`Timed out waiting for ${label}`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

// Stands in for Switch and Mattermost, then runs the real worker process against them.
async function startWorker({modelStatus = 200, cases = []}) {
  const posts = [],
    patches = [],
    sockets = {};
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    const reply = value => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(value));
    };
    if (req.url === '/api/v4/users/login') {
      res.setHeader('Token', 'stub');
      return reply({});
    }
    if (req.url.startsWith('/api/v4/teams/')) return reply({id: 'channel'});
    if (req.url.startsWith('/api/v4/users/username/')) return reply({id: 'human'});
    if (req.url.endsWith('/patch')) {
      patches.push(body);
      return reply({});
    }
    const op = req.url.match(/\/ops\/(\w+)$/)?.[1];
    if (op === 'list_participants')
      return reply({
        result: [
          {id: 'merchant', type: 'user', name: 'user'},
          {id: 'analyst', type: 'agent', name: 'fix-room-analyst'},
        ],
      });
    if (op === 'read_context') return reply({result: {threads: [], truncated: false}});
    posts.push(body.body);
    return reply({result: {}});
  });
  const wss = new WebSocketServer({server});
  wss.on('connection', (ws, req) => {
    const agent = req.url.split('/')[2];
    sockets[agent] = ws;
    ws.send(JSON.stringify({event: 'connection_state', data: {cursor: 0}}));
  });
  const port = await listen(server);
  const base = `http://127.0.0.1:${port}`;
  const actionPort = await freePort();

  const cwd = await mkdtemp(join(tmpdir(), 'fix-room-worker-'));
  await mkdir(join(cwd, 'runs'));
  const seed = new State(join(cwd, 'runs/state.sqlite'));
  for (const c of cases) seed.save(c);
  seed.close();

  const child = spawn(process.execPath, ['--import', STUB, WORKER], {
    cwd,
    stdio: 'ignore',
    env: {
      PATH: process.env.PATH,
      STUB_MODEL_STATUS: String(modelStatus),
      SWITCH_URL: base,
      SWITCH_ROOM_ID: ROOM,
      ANALYST_ID: 'analyst',
      ANALYST_KEY: 'k',
      REPAIR_ID: 'repair',
      REPAIR_KEY: 'k',
      MERCHANT_SENDER_ID: 'merchant-sender',
      MERCHANT_PARTICIPANT_ID: 'merchant',
      ANALYST_SENDER_ID: 'analyst-sender',
      ANTHROPIC_API_KEY: 'k',
      ANTHROPIC_MODEL: 'stub',
      SHOPIFY_DOMAIN: STORE,
      SHOPIFY_CLIENT_ID: 'id',
      SHOPIFY_CLIENT_SECRET: 'secret',
      SHOPIFY_API_VERSION: 'stub',
      INVENTORY_ITEM_ID: 'item',
      LOCATION_ID: 'location',
      VARIANT_ID: 'variant',
      PRODUCT_HANDLE: 'towel',
      MATTERMOST_URL: base,
      MATTERMOST_INTEGRATION_USER: 'u',
      MATTERMOST_INTEGRATION_PASSWORD: 'p',
      MATTERMOST_MERCHANT_USERNAME: 'human',
      MATTERMOST_ACTION_URL: `http://127.0.0.1:${actionPort}/actions`,
      MATTERMOST_ACTION_PORT: String(actionPort),
    },
  });
  await until(() => sockets.analyst && sockets.repair, 'both agents to connect');
  return {
    posts,
    patches,
    sockets,
    actionPort,
    readState(read) {
      const state = new State(join(cwd, 'runs/state.sqlite'));
      try {
        return read(state);
      } finally {
        state.close();
      }
    },
    async stop() {
      child.kill();
      for (const ws of Object.values(sockets)) ws.terminate();
      wss.close();
      server.close();
      await rm(cwd, {recursive: true, force: true});
    },
  };
}

const humanMessage = body =>
  JSON.stringify({
    event: 'message',
    data: {
      room_id: ROOM,
      sequence: 1,
      payload: {
        sender: 'merchant-sender',
        sender_name: 'user',
        message_id: 'human-1',
        body,
      },
    },
  });

test('a model rate limit reaches the room and does not pause the storefront', async () => {
  const worker = await startWorker({modelStatus: 429});
  try {
    worker.sockets.analyst.send(humanMessage('Why can’t customers buy the towel?'));
    const post = await until(
      () => worker.posts.find(text => text.includes('Model HTTP 429')),
      'the failure in the room',
    );
    assert.match(post, /blocked/);
    assert.equal(
      worker.readState(state => state.setting('store_blocked', 'false')),
      'false',
    );
  } finally {
    await worker.stop();
  }
});

test('a failure after the write updates the approval card, not just the room', async () => {
  const proposal = {
    id: 'stock-test',
    version: 1,
    state: 'proposed',
    mode: 'stock',
    target: 25,
    hash: 'hash',
    button_post_id: 'post',
    button_token: 'secret-token',
    before: BEFORE,
    baseline: {success: false},
    created: 1,
  };
  const worker = await startWorker({cases: [proposal]});
  try {
    const click = await fetch(`http://127.0.0.1:${worker.actionPort}/actions`, {
      method: 'POST',
      body: JSON.stringify({
        user_id: 'human',
        channel_id: 'channel',
        post_id: 'post',
        context: {case_id: proposal.id, hash: 'hash', token: 'secret-token', action: 'approve'},
      }),
    });
    assert.equal(click.status, 200);
    // The storefront host does not resolve, so verification fails after inventory was written and read back.
    const patch = await until(
      () => worker.patches.find(p => /did not finish/.test(p.message)),
      'the card to report the failure',
    );
    assert.match(patch.message, /Inventory is now 25 units/);
    await until(
      () => worker.posts.some(text => text.includes('stock-test blocked')),
      'the failure in the room',
    );
    assert.equal(
      worker.readState(state => state.get(proposal.id).state),
      'blocked',
    );
  } finally {
    await worker.stop();
  }
});
