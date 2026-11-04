import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {publicShop} from '../../src/public-shopper.mjs';
import {agentOutcome} from '../../src/agent-shopper.mjs';

// Local fake merchant + scripted model boundary. Exercises real browser controls,
// not Anthropic quality or Shopify compatibility. No external service calls.
async function fixture(eligible, challenge = false) {
  let cartPosts = 0, checkoutHits = 0;
  const server = createServer(async (req,res) => {
    if (req.url === '/checkout') { checkoutHits++; res.end('UNSAFE'); return; }
    if (challenge && req.url === '/products/pouch') return res.end('<h1>Verify browser</h1><button>Verify browser</button>');
    if (req.url === '/products/pouch') return res.end('<h1>Demo Travel Pouch $16.00</h1><p>FIXROOM20: 20% from $30</p><form method="post" action="/cart/add"><input name="quantity" type="number" value="1"><button>Add to cart</button></form>');
    if (req.url === '/cart/add') { cartPosts++; res.writeHead(302,{Location:'/cart'}); return res.end(); }
    if (req.url === '/cart/update.js') return setTimeout(()=>res.end(JSON.stringify({message: eligible?'FIXROOM20 applied: $6.40 off, $25.60':'Discount code cannot be applied to your cart'})),1200);
    if (req.url === '/cart') return res.end(`<h1>Cart: Demo Travel Pouch, Single, 2 × $16.00. Total items in cart: 2</h1><p id="result">$32.00</p><details><summary>Discount</summary><input aria-label="Discount" id="code"><button onclick="fetch('/cart/update.js',{method:'POST'}).then(r=>r.json()).then(r=>document.getElementById('result').textContent=r.message)">Apply</button></details><a href="/checkout">Checkout</a><button onclick="location.href='/checkout'">Continue</button>`);
    res.writeHead(404);res.end();
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  return {server,origin:`http://127.0.0.1:${server.address().port}`, counts:()=>({cartPosts,checkoutHits})};
}
function decide({text,controls,previous_actions}) {
  const find = pattern => controls.find(c=>pattern.test(c.text+' '+c.name));
  if (/cannot be applied/.test(text)) return {action:'stop',report:'CANNOT_COMPLETE: Discount code cannot be applied to your cart'};
  if (/25.60/.test(text)) return {action:'finish',report:'DONE: FIXROOM20, two Demo Travel Pouches, $25.60 in cart'};
  if (!/Cart:/.test(text)) {
    if (!previous_actions.some(a=>a.value==='2')) return {action:'fill',index:find(/quantity/).index,value:'2'};
    return {action:'click',index:find(/Add to cart/).index};
  }
  const input=controls.find(c=>c.tag==='input' && c.name==='Discount');
  if (!input) return {action:'click',index:controls.find(c=>c.tag==='summary').index};
  if (!previous_actions.some(a=>a.value==='FIXROOM20')) return {action:'fill',index:input.index,value:'FIXROOM20'};
  return {action:'click',index:find(/Apply/).index};
}
for (const eligible of [false,true]) test(`public client executes ${eligible?'successful':'rejected'} coupon browser visit`,async()=>{
  const f=await fixture(eligible),dir=await mkdtemp(join(tmpdir(),'fixroom-shopper-'));
  try {
    const noRejectedAction = input => {assert.doesNotMatch(input.text,/cannot be applied/); return decide(input);};
    const a=await publicShop({domain:'unused',handle:'pouch',task:'promotion',code:'FIXROOM20'},dir,{}, {decide:noRejectedAction,origin:f.origin});
    assert.equal(a.status,'ok');assert.equal(a.cart_observed,eligible);assert.equal(a.purchase_disabled_observed,!eligible);
    const result=agentOutcome(a,{success:eligible,unavailable:!eligible});assert.equal(result.success,eligible);
    assert.equal(f.counts().cartPosts,1);assert.equal(f.counts().checkoutHits,0);
  } finally {await new Promise(r=>f.server.close(r));await rm(dir,{recursive:true,force:true});}
});
test('disguised checkout navigation is blocked before reaching server',async()=>{
  const f=await fixture(true),dir=await mkdtemp(join(tmpdir(),'fixroom-guard-'));
  try {
    const a=await publicShop({domain:'unused',handle:'pouch',task:'promotion',code:'FIXROOM20'},dir,{},
      {origin:f.origin,decide:({controls})=>({action:'click',index:controls.find(c=>/Add to cart|Continue/.test(c.text)).index})});
    assert.equal(a.status,'failed');assert.equal(f.counts().checkoutHits,0);
  } finally {await new Promise(r=>f.server.close(r));await rm(dir,{recursive:true,force:true});}
});

test('a model DONE without a matching observed cart cannot pass',async()=>{
 const f=await fixture(true),dir=await mkdtemp(join(tmpdir(),'fixroom-false-done-'));
 try {
  const a=await publicShop({domain:'unused',handle:'pouch',task:'promotion',code:'FIXROOM20'},dir,{},
   {origin:f.origin,decide:()=>({action:'finish',report:'DONE: successful cart'})});
  assert.equal(a.cart_observed,false);
  assert.throws(()=>agentOutcome(a,{success:true}),/did not confirm/);
  assert.equal(f.counts().cartPosts,0);
 } finally {await new Promise(r=>f.server.close(r));await rm(dir,{recursive:true,force:true});}
});

test('Verify browser stops before the model can click verification',async()=>{
 const f=await fixture(true,true),dir=await mkdtemp(join(tmpdir(),'fixroom-challenge-'));let calls=0;
 try {
  const a=await publicShop({domain:'unused',handle:'pouch',task:'promotion',code:'FIXROOM20'},dir,{},
    {origin:f.origin,decide:()=>{calls++;return {action:'click',index:0};}});
  assert.equal(calls,0);assert.equal(a.status,'failed');assert.match(a.report,/Verification challenge/);
 } finally {await new Promise(r=>f.server.close(r));await rm(dir,{recursive:true,force:true});}
});
