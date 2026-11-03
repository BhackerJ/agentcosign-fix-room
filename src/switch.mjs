import WebSocket from 'ws';
import {randomUUID} from 'node:crypto';
export class Agent {
 constructor(base,id,key,room,onMessage){Object.assign(this,{base,id,key,room,onMessage});this.connection=randomUUID();this.cursor=0;this.stopped=false;}
 async op(name,body){const r=await fetch(`${this.base}/agents/${this.id}/ops/${name}`,{method:'POST',headers:{Authorization:`Bearer ${this.key}`,'Content-Type':'application/json','X-Switch-Connection-Id':this.connection},body:JSON.stringify(body)});if(!r.ok)throw Error(`Switch ${name}: HTTP ${r.status}`);return (await r.json()).result;}
 async post(content,target,threadId){return target?this.op('send_targeted_message',{body:content,target_names:[target],...(threadId?{thread_id:threadId}:{})}):this.op('post_message',{body:content});}
 start(){const url=new URL(`${this.base}/agents/${this.id}/connection/ws`);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.search=new URLSearchParams({connection_id:this.connection,rooms:this.room,scope:'single',start_from:'head'}).toString();const ws=this.ws=new WebSocket(url,{headers:{Authorization:`Bearer ${this.key}`}});
 ws.on('message',async raw=>{try{const f=JSON.parse(raw);if(f.event==='ping')return ws.send(JSON.stringify({type:'pong',cursor:this.cursor}));if(f.event==='connection_state'){this.cursor=f.data.cursor;await this.onMessage({type:'ready'},this);return;}if(['evicted','room_released'].includes(f.event)){console.error('Switch subscription released; reconnecting');ws.close();return;}if(f.event==='refused')throw Error(`Switch refused ${JSON.stringify(f.data)}`);if(f.event==='message'){await this.onMessage(f.data,this);this.cursor=f.data.sequence??this.cursor;}}catch(e){console.error(e.message);}});
 ws.on('error',e=>console.error('Switch socket:',e.message));ws.on('close',()=>{if(!this.stopped)setTimeout(()=>this.start(),3000);});}
 stop(){this.stopped=true;this.ws?.close();}
}
