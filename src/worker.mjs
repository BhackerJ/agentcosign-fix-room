import {Buttons} from './buttons.mjs';
import {interpret} from './conversation.mjs';
import {mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {State, hash, approvalAllowed, factAction} from './state.mjs';
import {Agent} from './switch.mjs';
import {Shopify} from './shopify.mjs';
import {shop} from './shopper.mjs';
import {waitForStorefront} from './propagation.mjs';
import {reason} from './model.mjs';
const e = process.env;
for (const key of [
  'SWITCH_URL',
  'SWITCH_ROOM_ID',
  'ANALYST_ID',
  'ANALYST_KEY',
  'REPAIR_ID',
  'REPAIR_KEY',
  'MERCHANT_SENDER_ID',
  'MERCHANT_PARTICIPANT_ID',
  'ANALYST_SENDER_ID',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_MODEL',
  'SHOPIFY_DOMAIN',
  'SHOPIFY_CLIENT_ID',
  'SHOPIFY_CLIENT_SECRET',
  'SHOPIFY_API_VERSION',
  'INVENTORY_ITEM_ID',
  'LOCATION_ID',
  'VARIANT_ID',
  'PRODUCT_HANDLE',
  'MATTERMOST_URL',
  'MATTERMOST_INTEGRATION_USER',
  'MATTERMOST_INTEGRATION_PASSWORD',
  'MATTERMOST_MERCHANT_USERNAME',
  'MATTERMOST_ACTION_URL',
])
  if (!e[key]) throw Error(`Missing ${key}`);
await mkdir('runs', {recursive: true});
const state = new State('runs/state.sqlite'),
  shopify = new Shopify(e);
const shopperConfig = {
  domain: e.SHOPIFY_DOMAIN,
  handle: e.PRODUCT_HANDLE,
  variant: e.VARIANT_ID,
  password: e.STOREFRONT_PASSWORD || '',
};
let queue = Promise.resolve();
const enqueue = (event, agent, role) => {
  queue = queue.then(() => handle(event, agent, role)).catch(err => console.error('Worker:', err.message));
  return queue;
};
const analyst = new Agent(e.SWITCH_URL, e.ANALYST_ID, e.ANALYST_KEY, e.SWITCH_ROOM_ID, (v, a) =>
  enqueue(v, a, 'analyst'),
);
const repair = new Agent(e.SWITCH_URL, e.REPAIR_ID, e.REPAIR_KEY, e.SWITCH_ROOM_ID, (v, a) =>
  enqueue(v, a, 'repair'),
);
let participants = [];
const firstStart = Number(state.setting('first_start', Date.now()));
for (const c of state.all())
  if (['baseline_running', 'applying', 'retest_running'].includes(c.state)) {
    c.resume_from = c.state;
    c.state = 'interrupted';
    state.save(c);
  }
async function handle(event, agent, role) {
  if (event.type === 'ready') {
    participants = await agent.op('list_participants', {});
    const merchant = participants.find(p => p.id === e.MERCHANT_PARTICIPANT_ID && p.type === 'user');
    if (!merchant) throw Error('Configured merchant is not a human participant');
    console.log(`${role} connected; merchant verified`);
    const history = await agent.op('read_context', {
      room_id: e.SWITCH_ROOM_ID,
      since: new Date(firstStart).toISOString(),
      limit: 100,
    });
    if (history.truncated) throw Error('History truncated: operator reconciliation required');
    for (const entry of history.threads
      .flatMap(t => [t.root, ...t.replies.map(r => ({...r, thread_id: t.root.id}))])
      .sort((a, b) => a.timestamp - b.timestamp)) {
      if (entry.kind !== 'message') continue;
      await handle(
        {
          room_id: e.SWITCH_ROOM_ID,
          payload: {
            sender: entry.sender,
            sender_name: entry.sender_name,
            message_id: entry.id,
            body: entry.body,
            thread_id: entry.thread_id || null,
            addressed: entry.body.includes('@fix-room-' + role),
          },
        },
        agent,
        role,
      );
    }
    return;
  }
  const p = event.payload;
  if (event.room_id !== e.SWITCH_ROOM_ID || !p?.message_id) return;
  const dedupe = role + ':' + p.message_id;
  if (state.seen(dedupe)) return;
  const human =
    p.sender === e.MERCHANT_SENDER_ID &&
    participants.some(x => x.id === e.MERCHANT_PARTICIPANT_ID && x.type === 'user');
  let body = p.body.trim();
  let c;
  if (role === 'analyst' && human && !/^(start |fact |approve |resume storefront)/.test(body)) {
    const waiting = state.all().filter(x => x.state === 'needs_fact');
    const intent = await interpret(body, waiting.length === 1, e);
    if (intent.action === 'fact' && waiting.length === 1) body = `fact ${waiting[0].id} ${intent.quantity}`;
    else if (['inspect', 'reset'].includes(intent.action)) {
      const active = state
        .all()
        .find(x =>
          [
            'needs_fact',
            'fact_received',
            'proposed',
            'approved',
            'applying',
            'applied',
            'retest_running',
          ].includes(x.state),
        );
      if (active) {
        await agent.post(
          'A task is already in progress. Reply with the stock quantity, or approve or cancel its latest proposal.',
        );
        state.mark(dedupe);
        return;
      }
      body = intent.action === 'reset' ? 'start reset' : 'start stock';
    } else {
      await agent.post(
        intent.action === 'status'
          ? 'Progress, proposals and verification results appear here. Check the latest task message.'
          : 'Say "Why can’t customers buy the towel?" or "Reset the test inventory to zero." When asked, reply with the actual stock quantity. Use the proposal buttons to approve.',
      );
      state.mark(dedupe);
      return;
    }
  }
  try {
    if (role === 'analyst' && human && body === 'resume storefront') {
      state.setSetting('store_blocked', 'false');
      await agent.post(
        'Storefront pause cleared by merchant. The next explicit start will attempt one browser run.',
      );
    } else if (role === 'analyst' && human && /^start (stock|reset)$/.test(body)) {
      if (state.setting('store_blocked', 'false') === 'true')
        throw Error('Storefront paused after HTTP 429; wait for cooldown and explicitly resume storefront');
      const id = 'stock-' + hash(p.message_id).slice(0, 8);
      c = {
        id,
        version: 1,
        state: 'baseline_running',
        mode: body === 'start reset' ? 'reset' : 'stock',
        created: Date.now(),
        task: 'Add one configured Single hand towel to cart; no checkout',
        model: e.ANTHROPIC_MODEL,
      };
      state.save(c);
      await agent.post(
        'I am checking the product page and a fresh shopping cart. I will report the findings here.',
      );
      c.baseline = await shop(shopperConfig, `runs/${id}/baseline`);
      c.before = await shopify.snapshot();
      c.state = 'needs_fact';
      state.save(c);
      const analysis = await reason('evidence analyst', {baseline: c.baseline}, e);
      await agent.post(
        `${analysis}\n${c.mode === 'reset' ? 'What quantity should the simulated test inventory be reset to?' : 'How many sellable units are in the warehouse? For example: "The warehouse has 25 units."'}`,
      );
    } else if (role === 'analyst' && human && /^fact (stock-[a-f0-9]+) (\d+)$/.test(body)) {
      const [, id, qty] = body.match(/^fact (stock-[a-f0-9]+) (\d+)$/);
      c = state.get(id);
      const action = factAction(c, Number(qty));
      if (action !== 'accept') {
        await agent.post(
          action === 'duplicate'
            ? `${id}: this fact is already recorded; current state ${c.state}. Existing proposal and approval command remain unchanged.`
            : `${id}: fact rejected in current state; existing case is unchanged.`,
        );
        state.mark(dedupe);
        return;
      }
      c.target = Number(qty);
      if (c.mode === 'reset' && c.target !== 0) throw Error('Reset quantity must be 0');
      if (!Number.isSafeInteger(c.target) || c.target < 0 || c.target > 100)
        throw Error('Quantity must be 0–100');
      c.fact_message_id = p.message_id;
      c.state = 'fact_received';
      state.save(c);
      await agent.post(
        'The merchant confirmed the quantity. Please prepare the repair proposal.',
        'fix-room-repair',
        p.message_id,
      );
    } else if (
      role === 'repair' &&
      p.addressed &&
      p.sender_name === 'fix-room-analyst' &&
      participants.some(x => x.name === 'fix-room-analyst' && x.type === 'agent' && x.id === e.ANALYST_ID) &&
      p.sender === e.ANALYST_SENDER_ID &&
      (/prepare (stock-[a-f0-9]+)$/.test(body) ||
        state.all().some(x => x.state === 'fact_received' && x.fact_message_id === p.thread_id))
    ) {
      const id =
        body.match(/prepare (stock-[a-f0-9]+)$/)?.[1] ||
        state.all().find(x => x.state === 'fact_received' && x.fact_message_id === p.thread_id)?.id;
      c = state.get(id);
      if (!c || c.state !== 'fact_received') return;
      c.before = await shopify.snapshot();
      if (c.before.item.inventoryLevel.quantities[0].quantity === c.target) {
        c.state = 'completed';
        c.result = 'no_change_needed';
        state.save(c);
        await agent.post('Store inventory already matches the confirmed quantity. No change is needed.');
        state.mark(dedupe);
        return;
      }
      c.hash = hash({
        id: c.id,
        version: c.version,
        before: c.before,
        target: c.target,
        fact_message_id: c.fact_message_id,
      });
      c.state = 'proposed';
      state.save(c);
      const explanation = await reason(
        'bounded repair proposer',
        {available: c.before.item.inventoryLevel.quantities[0].quantity, merchant_confirmed_target: c.target},
        e,
      );
      await agent.post(
        `Preparing the inventory proposal. Approval buttons will appear shortly. <!-- proposal:${c.id} -->`,
      );
      await buttons.attach(c, explanation);
    } else if (role === 'repair' && body.startsWith('approve ')) {
      if (!event.buttonApproval) {
        await agent.post('Use the approval button on the latest proposal. No approval command is needed.');
        state.mark(dedupe);
        return;
      }
      const id = body.split(/\s+/)[1];
      c = state.get(id);
      if (
        !c ||
        !human ||
        !(
          (event.buttonApproval && c.state === 'approved') ||
          approvalAllowed(event, c, e.MERCHANT_SENDER_ID, e.SWITCH_ROOM_ID)
        )
      ) {
        await agent.post('Approval rejected: sender, room, current proposal or state mismatch.');
        return;
      }
      c.approval_message_id = p.message_id;
      c.state = 'applying';
      state.save(c);
      c.after = await shopify.apply(c);
      c.state = 'applied';
      state.save(c);
      await agent.post(
        'Inventory read-back confirmed. Waiting for the storefront to update, then testing Add to cart again.',
      );
      c.propagation = await waitForStorefront(shopperConfig, c.target > 0);
      state.save(c);
      c.state = 'retest_running';
      state.save(c);
      c.retest = await shop(shopperConfig, `runs/${c.id}/retest`);
      c.state = 'completed';
      c.result =
        c.mode === 'reset'
          ? c.retest.unavailable
            ? 'reset_verified'
            : 'reset_not_verified'
          : c.retest.success && !c.baseline.success
            ? 'improved'
            : c.retest.success
              ? 'purchasable_before_and_after'
              : 'not_improved';
      state.save(c);
      if (c.button_post_id) await buttons.receipt(c);
      await agent.post(
        c.mode === 'reset'
          ? c.retest.unavailable
            ? 'Test inventory reset verified: the product is sold out and the fresh cart is empty.'
            : 'Inventory changed, but the sold-out storefront state has not been verified.'
          : c.retest.success
            ? `Verification passed: inventory is ${c.target} units and a fresh shopping session added 1 item. No checkout or payment.`
            : 'Inventory changed, but Add to cart failed. Evidence was saved and execution paused.',
      );
    }
    state.mark(dedupe);
  } catch (error) {
    if (error.message.includes('429')) state.setSetting('store_blocked', 'true');
    if (c) {
      c.resume_from = c.state;
      c.state = error.message.includes('CONFLICT') ? 'conflict' : 'blocked';
      c.error = error.message;
      state.save(c);
    }
    await agent.post(`${c?.id || 'Request'} blocked: ${error.message}. No automatic mutation retry.`);
    state.mark(dedupe);
  }
}
const buttons = new Buttons(e, state, (c, action) => {
  if (action === 'cancel') return;
  enqueue(
    {
      room_id: e.SWITCH_ROOM_ID,
      buttonApproval: true,
      payload: {
        sender: e.MERCHANT_SENDER_ID,
        message_id: 'button:' + c.button_post_id,
        body: `approve ${c.id} v${c.version} ${c.hash}`,
      },
    },
    repair,
    'repair',
  );
});
await buttons.init();
analyst.start();
repair.start();
process.on('SIGINT', () => {
  analyst.stop();
  repair.stop();
  buttons.server.close();
  state.close();
  process.exit();
});
