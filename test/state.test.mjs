import {test} from 'node:test';
import assert from 'node:assert/strict';
import {State,approvalAllowed,factAction} from '../src/state.mjs';
test('persistent case and message deduplication',()=>{const s=new State(':memory:');s.save({id:'stock-1',state:'proposed'});assert.equal(s.get('stock-1').state,'proposed');s.mark('a');s.mark('a');assert.equal(s.seen('a'),true);s.close();});
test('approval binds exact human sender, room, hash and state',()=>{const c={id:'stock-1',version:1,hash:'abc',state:'proposed'},e={room_id:'r',payload:{sender:'human',body:'approve stock-1 v1 abc'}};assert.ok(approvalAllowed(e,c,'human','r'));for(const wrong of [{...e,room_id:'x'},{...e,payload:{...e.payload,sender:'agent'}},{...e,payload:{...e.payload,body:'approve stock-1 v1 old'}}])assert.equal(approvalAllowed(wrong,c,'human','r'),false);assert.equal(approvalAllowed(e,{...c,state:'applying'},'human','r'),false);});

test('repeated facts preserve an existing proposal rather than blocking it',()=>{const c={id:'stock-1',state:'proposed',target:0,hash:'approved-hash'};const before=structuredClone(c);assert.equal(factAction(c,0),'duplicate');assert.equal(factAction(c,25),'reject');assert.deepEqual(c,before);assert.equal(factAction({...c,state:'needs_fact'},0),'accept');});
