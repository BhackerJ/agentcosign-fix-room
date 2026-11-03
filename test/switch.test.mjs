import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Agent} from '../src/switch.mjs';
test('room announcements use post_message; handoffs require explicit target',async()=>{const a=new Agent('http://localhost','id','key','room',()=>{}),calls=[];a.op=async(name,args)=>calls.push({name,args});await a.post('baseline started');await a.post('prepare stock-1','fix-room-repair');assert.deepEqual(calls,[{name:'post_message',args:{body:'baseline started'}},{name:'send_targeted_message',args:{body:'prepare stock-1',target_names:['fix-room-repair']}}]);});
