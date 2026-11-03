import {readInput as input} from './input.js';
import { randomUUID } from 'node:crypto';
import { readConnection, requestRuntime } from '../../runtime/src/connection.js';
import type { DataPaths } from '../../runtime/src/paths.js';
export async function bilibiliCommand(p:DataPaths,args:string[],output:(value:unknown)=>void){
 const [,action='status',id]=args,c=readConnection(p),base='/v1/bilibili',call=(url:string,method='GET',body?:unknown)=>requestRuntime(c,base+url,method,body);
 if(action==='status')output(await call(''));
 else if(action==='configure')output(await call('','PUT',await input()));
 else if(['search','read','import'].includes(action))output(await call('/'+action,'POST',await input()));
 else if(action==='watch'){const b=await input();output(await call('/tasks','POST',{...b,requestId:b.requestId??randomUUID()}));}
 else if(action==='tasks')output(await call('/tasks'));
 else if(action==='task'&&id)output(await call('/tasks/'+encodeURIComponent(id)));
 else if(action==='cancel'&&id)output(await call('/tasks/'+encodeURIComponent(id)+'/cancel','POST'));
 else if(action==='share'&&id)output(await call('/tasks/'+encodeURIComponent(id)+'/share','POST',await input()));
 else if(['verify','logout'].includes(action))output(await call('/'+action,'POST'));
 else if(action==='login')output(await call('/login/start','POST'));
 else if(action==='poll'&&id)output(await call('/login/poll','POST',{id}));
 else if(action==='cancel-login')output(await call('/login/cancel','POST',{id}));
 else throw new Error('INVALID_ARGUMENTS');
}
