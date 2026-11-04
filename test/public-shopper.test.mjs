import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowedRequest, shopperMode, chooseAction} from '../src/public-shopper.mjs';
test('public is the clean-clone default, legacy and probe remain explicit',()=>{
 assert.equal(shopperMode({}),'public');assert.equal(shopperMode({AGENTCOSIGN_ROOT:'/existing'}),'legacy');
 assert.equal(shopperMode({SHOPPER_MODE:'probe'}),'probe');assert.throws(()=>shopperMode({SHOPPER_MODE:'typo'}));
});
test('network guard permits cart operations but rejects checkout and external navigation',()=>{
 const origin='https://shop.invalid';
 for(const path of ['/cart/add.js','/cart/update.js','/password']) assert.ok(allowedRequest(origin+path,'POST',false,origin));
 for(const path of ['/checkout','/checkouts/session','/payments','/orders/123']) assert.equal(allowedRequest(origin+path,'GET',true,origin),false);
 assert.equal(allowedRequest('https://other.invalid/cart','GET',true,origin),false);
 assert.equal(allowedRequest(origin+'/admin','POST',false,origin),false);
});
test('Anthropic request carries observed controls, not store admin credentials',async()=>{
 const previous=globalThis.fetch;
 try {
  globalThis.fetch=async(url,options)=>{
   const body=JSON.parse(options.body);assert.ok(body.messages[0].content.includes('Apply'));
   assert.ok(!options.body.includes('admin-secret'));assert.equal(body.tool_choice.name,'browser_action');return {ok:true,json:async()=>({content:[{type:'tool_use',name:'browser_action',input:{action:'click',index:2}}]})};
  };
  assert.deepEqual(await chooseAction({controls:[{index:2,text:'Apply'}]}, {ANTHROPIC_API_KEY:'test',ANTHROPIC_MODEL:'test',SHOPIFY_CLIENT_SECRET:'admin-secret'}),{action:'click',index:2});
 } finally {globalThis.fetch=previous;}
});

test('cart observations need the exact visible quantity, variant, price and discount',async()=>{
 const {observations}=await import('../src/public-shopper.mjs');
 const text='Demo Travel Pouch Single $16.00 FIXROOM20 $6.40 off $25.60';
 assert.equal(observations(text,true,'FIXROOM20',{cartPage:true,quantities:['2']}).cart_observed,true);
 for(const metadata of [{cartPage:false,quantities:['2']},{cartPage:true,quantities:['1']}])
  assert.equal(observations(text,true,'FIXROOM20',metadata).cart_observed,false);
 assert.equal(observations(text.replace('6.40','3.20'),true,'FIXROOM20',{cartPage:true,quantities:['2']}).cart_observed,false);
});

test('Shopify unit-sale presentation proves the same two-item discount',async()=>{
 const {observations}=await import('../src/public-shopper.mjs');
 const text='Demo Travel Pouch Pack: Single FIXROOM20 Sale price $12.80 Regular price $16.00 Estimated total $25.60';
 assert.equal(observations(text,true,'FIXROOM20',{cartPage:true,quantities:['2']}).cart_observed,true);
 assert.equal(observations(text.replace('12.80','15.00'),true,'FIXROOM20',{cartPage:true,quantities:['2']}).cart_observed,false);
});
