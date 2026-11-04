import { createHash,randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { InputError } from '../../ai/types.js';
import { stableId } from '../protocol.js';
import type { QQContact } from './types.js';

/** Only this fixed set of read/config/login operations is exposed to the manager. */
export type NapCatAction='QQLogin/CheckLoginStatus'|'QQLogin/GetQQLoginInfo'|'QQLogin/RefreshQRcode'|'OB11Config/SetConfig';
export class NapCatClient {
 private credential='';
 constructor(private port:number,private token:string){}
 private async post(path:string,body:unknown,credential='') {
  const response=await fetch(`http://127.0.0.1:${this.port}/api/${path}`,{method:'POST',headers:{'content-type':'application/json',...(credential?{authorization:`Bearer ${credential}`}:{})},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(4000)});
  if(!response.ok)throw new InputError('QQ_COMPONENT_UNAVAILABLE',409);
  const reader=response.body!.getReader();let length=0;const chunks:Uint8Array[]=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>2_000_000)throw new InputError('QQ_COMPONENT_RESPONSE');chunks.push(value);}}finally{await reader.cancel();}
  try{return JSON.parse(Buffer.concat(chunks).toString()) as {code:number;message?:string;data:Record<string,unknown>};}catch{throw new InputError('QQ_COMPONENT_RESPONSE');}
 }
 async call(action:NapCatAction,body:unknown={}):Promise<Record<string,unknown>> {
  for(let attempt=0;attempt<2;attempt++){
   if(!this.credential){const login=await this.post('auth/login',{hash:createHash('sha256').update(this.token+'.napcat').digest('hex')});if(login.code!==0||typeof login.data?.Credential!=='string')throw new InputError('QQ_COMPONENT_AUTH');this.credential=login.data.Credential;}
   const response=await this.post(action,body,this.credential);
   if(response.code===0)return response.data??{};
   if(response.message==='Unauthorized'&&attempt===0){this.credential='';continue;}
   throw new InputError('QQ_COMPONENT_REQUEST_FAILED',409);
  }
  throw new InputError('QQ_COMPONENT_AUTH');
 }
}
export async function onebotRead(port:number,token:string,action:'get_login_info'|'get_status'|'get_friend_list'|'get_group_list'):Promise<unknown>{
 return new Promise((resolve,reject)=>{
  const echo=randomUUID(),socket=new WebSocket(`ws://127.0.0.1:${port}`,{headers:{authorization:`Bearer ${token}`},handshakeTimeout:4000,maxPayload:2_000_000,followRedirects:false});
  let done=false;const finish=(error?:Error,value?:unknown)=>{if(done)return;done=true;clearTimeout(timer);socket.terminate();if(error)reject(error);else resolve(value);};
  const timer=setTimeout(()=>finish(new InputError('QQ_COMPONENT_UNAVAILABLE',409)),4500);
  socket.on('open',()=>socket.send(JSON.stringify({action,params:{},echo})));
  socket.on('error',()=>finish(new InputError('QQ_COMPONENT_UNAVAILABLE',409)));
  socket.on('close',()=>finish(new InputError('QQ_COMPONENT_UNAVAILABLE',409)));
  socket.on('message',bytes=>{try{const value=JSON.parse(bytes.toString());if(value.echo!==echo)return;if(value.status!=='ok'||value.retcode!==0)throw new Error();finish(undefined,value.data);}catch{finish(new InputError('QQ_COMPONENT_RESPONSE'));}});
 });
}
export function contacts(value:unknown,kind:'friend'|'group'):QQContact[]{
 if(!Array.isArray(value)||value.length>10000)throw new InputError('QQ_COMPONENT_RESPONSE');
 return value.map(row=>({id:stableId(row?.[kind==='friend'?'user_id':'group_id']),name:String(row?.[kind==='friend'?'nickname':'group_name']??'').slice(0,100)}));
}
