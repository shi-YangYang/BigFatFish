import { expect,it } from 'vitest';
import type { Request, Response } from 'playwright-core';
import { WriteGate } from './write-gate.js';
const args={aweme_id:'1234567890123456789',text:'海洋',reply_cid:''};
const request=(body='aweme_id=1234567890123456789&text=%E6%B5%B7%E6%B4%8B&reply_id=',type='application/x-www-form-urlencoded',path='/aweme/v1/web/comment/publish/')=>({url:()=>`https://www.douyin.com${path}`,method:()=> 'POST',postDataBuffer:()=>Buffer.from(body),headers:()=>({'content-type':type})}) as unknown as Request;
it('rejects ambiguous encodings, repeated fields, query overrides and unrecognized protocols',async()=>{
 for(const req of [request(JSON.stringify(args),'application/json'),request('aweme_id=1234567890123456789&text=海洋&text=OTHER'),request(undefined,undefined,'/aweme/v1/web/comment/publish/?text=OTHER'),request(undefined,undefined,'/other-action')]){const gate=new WriteGate('douyin_comment',args,async()=>{});await gate.arm();await expect(gate.authorize(req)).rejects.toThrow();expect(gate.submitted).toBe(false);}
 for(const tool of ['douyin_chat_send','douyin_share_video','douyin_publish']){const gate=new WriteGate(tool,args,async()=>{});await gate.arm();await expect(gate.authorize(request())).rejects.toThrow('ACTION_PROTOCOL_UNSUPPORTED');expect(gate.submitted).toBe(false);}
});
it('checks revocation after asynchronous waits and atomically consumes concurrent submissions',async()=>{
 let revoked=false,release!:()=>void;let wait=false;const gate=new WriteGate('douyin_comment',args,async()=>{if(wait)await new Promise<void>(r=>release=r);if(revoked)throw new Error('revoked');});await gate.arm();wait=true;const pending=gate.authorize(request());revoked=true;release();await expect(pending).rejects.toThrow('revoked');expect(gate.submitted).toBe(false);
 const concurrent=new WriteGate('douyin_comment',args,async()=>{await Promise.resolve();});await concurrent.arm();const results=await Promise.allSettled([concurrent.authorize(request()),concurrent.authorize(request())]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
});

it('requires matching, unambiguous parent aliases and exact comment identity',async()=>{
 const cases:[string,Record<string,unknown>,boolean][]=[
  ['',{reply_id:''},true],['',{reply_to_reply_id:'0'},true],['',{reply_id:'',reply_to_reply_id:0},true],
  ['',{reply_to_reply_id:'OTHER'},false],['',{reply_id:'',reply_to_reply_id:'OTHER'},false],['',{},false],
  ['parent',{reply_to_reply_id:'parent'},true],['parent',{reply_id:'parent',reply_to_reply_id:'parent'},true],
  ['parent',{reply_id:'parent',reply_to_reply_id:'OTHER'},false],['parent',{reply_id:''},false],['parent',{},false],
  ['',{reply_id:null},false],['',{reply_id:'',aweme_id:undefined},false],['',{reply_id:'',text:undefined},false],
 ];
 for(const [parent,fields,verified] of cases){
  const gate=new WriteGate('douyin_comment',{...args,reply_cid:parent},async()=>{});
  const req=request(`aweme_id=${args.aweme_id}&text=海洋&reply_id=${parent}`);await gate.arm();await gate.authorize(req);
  gate.response({request:()=>req,ok:()=>true,body:async()=>Buffer.from(JSON.stringify({status_code:0,comment:{cid:'new',aweme_id:args.aweme_id,text:args.text,...fields}}))} as unknown as Response);
  await gate.settle();expect(!!gate.receipt,JSON.stringify({parent,fields})).toBe(verified);
 }
});
