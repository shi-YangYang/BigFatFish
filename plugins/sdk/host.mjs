/* global AbortController */
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
export function servePlugin(plugin){
 const calls=new Map(),hostCalls=new Map();
 const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
 const host=(callId,method,args)=>new Promise((resolve,reject)=>{const id=randomUUID();hostCalls.set(id,{resolve,reject});send({id,callId,host:true,method,args});});
 const input=createInterface({input:process.stdin});
 input.on('line',async line=>{if(line.length>262144){process.exitCode=1;input.close();return;}let b;try{b=JSON.parse(line);if(b.host){const p=hostCalls.get(b.id);hostCalls.delete(b.id);if(b.error)p?.reject(new Error(b.error));else p?.resolve(b.result);return;}if(b.method==='cancel'){calls.get(b.id)?.abort();return;}const control=new AbortController();calls.set(b.id,control);const context={host:(method,args)=>{control.signal.throwIfAborted();return host(b.id,method,args);},signal:control.signal};let result;if(b.method==='initialize')result=await plugin.initialize?.(b.args,context)??{};else if(b.method==='health')result=await plugin.health?.()??{state:'ready'};else if(b.method==='dispose')result=await plugin.dispose?.()??{};else if(b.method==='event')result=await plugin.event?.(b.args,context)??{};else if(b.method==='tool')result=await plugin.tools[b.args.name](b.args.args,context);else throw new Error('METHOD_UNKNOWN');calls.delete(b.id);send({id:b.id,result});}catch{if(b?.id)send({id:b.id,error:'PLUGIN_FAILED'});}});
 input.on('close',()=>{for(const c of calls.values())c.abort();for(const p of hostCalls.values())p.reject(new Error('HOST_CLOSED'));});
}
