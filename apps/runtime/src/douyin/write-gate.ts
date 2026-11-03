import type { Request, Response } from 'playwright-core';
import { InputError } from '../ai/types.js';

// This is a deliberately explicit wire contract, not permission to send arbitrary
// traffic while a tool is running. Unknown/binary protocols require an adapter.
// Endpoint families are from the fixed Python upstream's _is_digg_url and
// _is_comment_publish_url. Other tools retain automation, but their network
// schemas have not been verified and are intentionally not authorized here.
const paths:Record<string,string[]>={
 douyin_like:['/aweme/v1/web/commit/item/digg/'],
 douyin_comment:['/aweme/v1/web/comment/publish/'],
};
export const writeCapabilities={douyin_like:'bounded-http',douyin_comment:'bounded-http',douyin_chat_send:'protocol-unverified',douyin_share_video:'protocol-unverified',douyin_publish:'protocol-unverified'};
function reject():never{throw new InputError('ACTION_REQUEST_MISMATCH',403);}
function record(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))return reject();return v as Record<string,unknown>;}
export class WriteGate{
 private consumed=false;private armed=false;
 private requests=new Set<Request>();private pending=new Set<Promise<void>>();
 receipt?:Record<string,unknown>;submitted=false;denied=false;error='';
 constructor(readonly tool:string,readonly args:Record<string,unknown>,private check:()=>Promise<void>){}
 async arm(){if(this.armed)reject();await this.check();this.armed=true;}
 async authorize(req:Request){
  try{
   if(!paths[this.tool])throw new InputError('ACTION_PROTOCOL_UNSUPPORTED',409);
   const url=new URL(req.url());if(url.protocol!=='https:'||url.port||url.username||url.password||req.method()!=='POST')reject();
   if(url.hostname!=='www.douyin.com'||!paths[this.tool]?.includes(url.pathname)||!this.armed||this.consumed)reject();
   const raw=req.postDataBuffer();if(!raw||raw.length>32768)reject();
   const contentType=req.headers()['content-type']??'';let body:Record<string,unknown>;
   if(['application/x-www-form-urlencoded','text/plain'].includes(contentType.split(';')[0]??'')){const entries=[...new URLSearchParams(raw.toString('utf8'))];if(new Set(entries.map(([k])=>k)).size!==entries.length)reject();body=Object.fromEntries(entries);}
   else reject();
   const a=this.args;let expected:Record<string,unknown>;
   switch(this.tool){
    case 'douyin_like':expected={aweme_id:a.aweme_id,type:a.undo?'0':'1'};break;
    case 'douyin_comment':expected={aweme_id:a.aweme_id,text:a.text,reply_id:a.reply_cid};break;
    default:return reject();
   }
   // Only transport metadata belongs in the query. Action fields cannot be
   // duplicated there and override the inspected body at the server.
   for(const [key] of url.searchParams)if(!['aid','device_platform','msToken','a_bogus','verifyFp','webid'].includes(key))reject();
   if(Object.keys(body).some(k=>!(k in expected))||Object.entries(expected).some(([k,v])=>String(body[k]??'')!==String(v)))reject();
   await this.check();if(this.consumed||!this.armed)reject();this.consumed=true;this.submitted=true;this.requests.add(req);
  }catch(e){this.denied=true;this.error=e instanceof InputError?e.message:'ACTION_REQUEST_MISMATCH';throw e;}
 }
 response(response:Response){if(!this.requests.has(response.request()))return;this.requests.delete(response.request());const p=this.readReceipt(response).catch(()=>{});this.pending.add(p);void p.finally(()=>this.pending.delete(p));}
 private async readReceipt(response:Response){
  if(!response.ok())return;const buffer=await response.body();if(buffer.length>65536)return;const data=record(JSON.parse(buffer.toString('utf8')));if(data.status_code!==0)return;
  const obj=record(data.comment??data.data??data);
  const a=this.args;
  const echoed:Record<string,unknown>={aweme_id:a.aweme_id,text:a.text,receiver_id:a.peer_id,title:a.title,tags:a.tags};
  for(const [key,value] of Object.entries(echoed))if(obj[key]!==undefined&&String(obj[key])!==String(value??''))return;
  if(this.tool==='douyin_comment'){
   if(obj.aweme_id!==a.aweme_id||obj.text!==a.text)return;
   // The fixed upstream exposes both parent names. Empty and 0 mean a
   // top-level comment; every present alias must agree, including top-level.
   const parents=['reply_id','reply_to_reply_id'].filter(key=>Object.hasOwn(obj,key)).map(key=>obj[key]);
   const normalize=(v:unknown)=>v===''||v==='0'||v===0?'':typeof v==='string'?v:undefined;
   const parent=normalize(a.reply_cid);
   if(!parents.length||parent===undefined||parents.some(value=>normalize(value)!==parent))return;
  }
  const identity=this.tool==='douyin_like'?String(a.aweme_id):obj.cid;
  if(typeof identity!=='string'||!identity)return;
  this.receipt={ok:true,verified:true,platformId:identity,...(this.tool==='douyin_like'?{aweme_id:a.aweme_id,liked:!a.undo}:{cid:identity,aweme_id:a.aweme_id,text:a.text})};
 }
 async settle(){await Promise.all(this.pending);}
}
