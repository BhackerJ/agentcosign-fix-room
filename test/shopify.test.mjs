import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Shopify} from '../src/shopify.mjs';
const env={INVENTORY_ITEM_ID:'item',LOCATION_ID:'loc',VARIANT_ID:'variant'};
const snapshot={store:'store',location:'loc',item:{inventoryLevel:{quantities:[{quantity:0}]}}};
test('changed baseline prevents mutation',async()=>{const s=new Shopify(env);s.snapshot=async()=>({...snapshot,store:'changed'});s.gql=async()=>{throw Error('Must not write');};await assert.rejects(()=>s.apply({before:snapshot,target:25}),/CONFLICT/);});
test('mutation binds expected quantity and idempotency key and verifies readback',async()=>{const s=new Shopify(env);let reads=0;s.snapshot=async()=>reads++?{...snapshot,item:{inventoryLevel:{quantities:[{quantity:25}]}}}:snapshot;s.gql=async(q,v)=>{assert.equal(v.key,'proposal-hash');assert.deepEqual(v.input.quantities,[{inventoryItemId:'item',locationId:'loc',quantity:25,changeFromQuantity:0}]);return {inventorySetQuantities:{userErrors:[]}};};await s.apply({id:'stock-1',version:1,hash:'proposal-hash',before:snapshot,target:25});assert.equal(reads,2);});
test('unknown write result is not retried by adapter',async()=>{const s=new Shopify(env);s.snapshot=async()=>snapshot;let calls=0;s.gql=async()=>{calls++;throw Error('timeout');};await assert.rejects(()=>s.apply({before:snapshot}),/timeout/);assert.equal(calls,1);});
