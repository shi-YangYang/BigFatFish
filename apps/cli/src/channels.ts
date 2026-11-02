import { readConnection, requestRuntime } from '../../runtime/src/connection.js';
import type { DataPaths } from '../../runtime/src/paths.js';
async function input(){let text='';for await(const chunk of process.stdin){text+=chunk;if(text.length>65536)throw new Error('INPUT_TOO_LARGE');}return JSON.parse(text);}
export async function channelCommand(p:DataPaths,args:string[],output:(value:unknown)=>void){
 const [command,action='status',id]=args,c=readConnection(p),call=(url:string,method='GET',body?:unknown)=>requestRuntime(c,url,method,body);
 if(command==='channels'){
  if(action==='status')output(await call('/v1/channels/qq'));
  else if(action==='configure')output(await call('/v1/channels/qq','PUT',await input()));
  else if(action==='start'||action==='stop')output(await call('/v1/channels/qq/'+action,'POST'));
  else if(action==='deliveries')output(await call('/v1/channels/qq/deliveries'));
  else throw new Error('INVALID_ARGUMENTS');
 }else{
  if(action==='status'||action==='list')output(await call('/v1/permissions/approvals'));
  else if(action==='audit')output(await call('/v1/permissions/audit'));
  else if(action==='propose')output(await call('/v1/permissions/approvals','POST',await input()));
  else if(action==='decide'&&id)output(await call('/v1/permissions/approvals/'+encodeURIComponent(id),'POST',await input()));
  else throw new Error('INVALID_ARGUMENTS');
 }
}
