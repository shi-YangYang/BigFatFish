import {readInput as input} from '../io/input.js';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createRuntimeClient } from '../runtime/client.js';
import type { DataPaths } from '../../../runtime/src/paths.js';
import type { MemoryTask } from '../../../runtime/src/memory/types.js';
export async function lifeCommand(p:DataPaths,args:string[],output:(v:unknown)=>void) {
 const { request: call } = createRuntimeClient(p);
 const [command, action, id] = args;
 if(command==='life') {if(!action||action==='home')output(await call('/v1/life'));else if(action==='timeline'||action==='moods')output(await call('/v1/life/'+action));else throw new Error('INVALID_ARGUMENTS');return;}
 if(command==='memories') {
  if(!action||action==='list')output(await call('/v1/memories'));
  else if(action==='search')output(await call('/v1/memories/search','POST',await input()));
  else if(action==='create')output(await call('/v1/memories','POST',await input()));
  else if(action==='export')output(await call('/v1/memories/export','POST',await input()));
  else if(action==='get'&&id)output(await call('/v1/memories/'+encodeURIComponent(id)));
  else if(action==='edit'&&id)output(await call('/v1/memories/'+encodeURIComponent(id),'PUT',await input()));
  else if(action==='merge'&&id)output(await call('/v1/memories/'+encodeURIComponent(id)+'/merge','POST',await input()));
  else if(action==='delete'&&id)output(await call('/v1/memories/'+encodeURIComponent(id)+'/delete','POST',await input()));
  else throw new Error('INVALID_ARGUMENTS');return;
 }
 if(command==='diaries'&&(!action||action==='list')){output(await call('/v1/diaries'));return;}
 if(command==='diaries'&&action==='rebuild'&&id){output(await call('/v1/diaries/'+encodeURIComponent(id)+'/rebuild','POST'));return;}
 if(command==='memory-tasks') {
  if(action==='get'&&id)output(await call('/v1/memory-tasks/'+encodeURIComponent(id)));
  else if(action==='cancel'&&id)output(await call('/v1/memory-tasks/'+encodeURIComponent(id)+'/cancel','POST'));
  else if(!action||action==='list')output(await call('/v1/memory-tasks'));
  else if(action==='extract'||action==='diary'){
   const b=await input();let task=await call<MemoryTask>('/v1/memory-tasks/'+action,'POST',{requestId:randomUUID(),...b});output(task);
   const cancel=()=>{void call('/v1/memory-tasks/'+task.id+'/cancel','POST').catch(()=>{});};process.once('SIGINT',cancel);
   try{while(['queued','running'].includes(task.status)){await delay(200);task=await call('/v1/memory-tasks/'+task.id);}output(task);if(task.status!=='completed')process.exitCode=1;}finally{process.removeListener('SIGINT',cancel);}
  }else throw new Error('INVALID_ARGUMENTS');return;
 }
 throw new Error('INVALID_ARGUMENTS');
}
