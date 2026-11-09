import {readInput as input} from '../io/input.js';
import { randomUUID } from 'node:crypto';
import { createRuntimeClient } from '../runtime/client.js';
import type { DataPaths } from '../../../runtime/src/paths.js';
export async function bilibiliCommand(p:DataPaths,args:string[],output:(value:unknown)=>void){
 const [, action = 'status', id] = args;
 const { request: call } = createRuntimeClient(p);
 if(action==='status')output(await call('/v1/bilibili'));
 else if(action==='configure')output(await call('/v1/bilibili','PUT',await input()));
 else if(['search','read','import'].includes(action))output(await call('/v1/bilibili/'+action,'POST',await input()));
 else if(action==='watch'){const b=await input();output(await call('/v1/bilibili/tasks','POST',{...b,requestId:b.requestId??randomUUID()}));}
 else if(action==='tasks')output(await call('/v1/bilibili/tasks'));
 else if(action==='task'&&id)output(await call('/v1/bilibili/tasks/'+encodeURIComponent(id)));
 else if(action==='cancel'&&id)output(await call('/v1/bilibili/tasks/'+encodeURIComponent(id)+'/cancel','POST'));
 else if(action==='share'&&id)output(await call('/v1/bilibili/tasks/'+encodeURIComponent(id)+'/share','POST',await input()));
 else if(['verify','logout'].includes(action))output(await call('/v1/bilibili/'+action,'POST'));
 else if(action==='login')output(await call('/v1/bilibili/login/start','POST'));
 else if(action==='poll'&&id)output(await call('/v1/bilibili/login/poll','POST',{id}));
 else if(action==='cancel-login')output(await call('/v1/bilibili/login/cancel','POST',{id}));
 else throw new Error('INVALID_ARGUMENTS');
}
