import {readInput as input} from '../io/input.js';
import { createRuntimeClient } from '../runtime/client.js';
import type { DataPaths } from '../../../runtime/src/paths.js';
export async function channelCommand(p:DataPaths,args:string[],output:(value:unknown)=>void){
 const [command, action = 'status'] = args;
 const { request: call } = createRuntimeClient(p);
 if(command==='channels'){
  if(action==='status')output(await call('/v1/channels/qq'));
  else if(action==='configure')output(await call('/v1/channels/qq','PUT',await input()));
  else if(action==='start'||action==='stop')output(await call('/v1/channels/qq/'+action,'POST'));
  else if(action==='send')output(await call('/v1/channels/qq/send','POST',await input(3_000_000)));
  else if(action==='audit')output(await call('/v1/channels/qq/audit'));
  else if(action==='deliveries')output(await call('/v1/channels/qq/deliveries'));
  else throw new Error('INVALID_ARGUMENTS');
 }else{
  if(action==='audit')output(await call('/v1/channels/qq/audit'));
  else throw new Error('QQ_APPROVAL_REMOVED: use channels send');
 }
}
