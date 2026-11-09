import { expect, it } from 'vitest';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { paths } from '../../apps/runtime/src/paths.js';
import { startRuntime } from '../../apps/runtime/src/lifecycle.js';
import { requestRuntime } from '../../apps/runtime/src/connection.js';
import { onebotFixture } from '../fixtures/onebot.js';

type Call={name:string;args:unknown};
type RequestBody={model:string;tools?:unknown[];messages:unknown[]};
it('settles native DSH final batches once, preserves image evidence, silence, errors and cancellation',async()=>{
 const p=paths(mkdtempSync(join(tmpdir(),'bff-terminal-reply-'))),bot=await onebotFixture();
 let batches:Call[][]=[],requests:RequestBody[]=[],unexpected=0,gate:Promise<void>|undefined,entered:(()=>void)|undefined;
 const model=createServer(async(req,res)=>{
  let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw) as RequestBody;
  if(!body.tools?.length){res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({choices:[{message:{role:'assistant',content:'{"items":[],"changed":false}'},finish_reason:'stop'}]}));return;}
  const index=requests.push(body)-1,calls=batches[index];entered?.();if(gate)await gate;
  if(!calls){unexpected++;res.writeHead(500).end('{}');return;}
  res.writeHead(200,{'content-type':'text/event-stream'});
  const emit=(delta:unknown,finish_reason:string|null=null)=>res.write(`data: ${JSON.stringify({id:'fixture',object:'chat.completion.chunk',model:body.model,choices:[{index:0,delta,finish_reason}]})}\n\n`);
  emit({role:'assistant'});emit({tool_calls:calls.map((call,i)=>({index:i,id:`call-${index}-${i}`,type:'function',function:{name:call.name,arguments:JSON.stringify(call.args)}}))});emit({},'tool_calls');res.end('data: [DONE]\n\n');
 });
 await new Promise<void>(resolve=>model.listen(0,'127.0.0.1',resolve));
 const runtime=await startRuntime(p),call=<T>(url:string,method='GET',body?:unknown)=>requestRuntime<T>(runtime.connection,url,method,body);
 const wait=async<T>(read:()=>Promise<T>,done:(value:T)=>boolean)=>{for(let n=0;n<600;n++){const value=await read();if(done(value))return value;await delay(20);}throw new Error('FIXTURE_TIMEOUT');};
 let id=0;
 const begin=(steps:Call[][])=>{batches=steps;requests=[];const messageId=String(++id);bot.event({post_type:'message',message_type:'private',self_id:'10001',user_id:'20002',message_id:messageId,message:[{type:'text',data:{text:'隔离最终提交测试 '+messageId}}]});return `10001:private:20002:${messageId}`;};
 const done=(key:string)=>wait(()=>call<{id:string;status:string}[]>('/v1/channels/qq/deliveries'),rows=>rows.some(row=>row.id===key&&!['queued','generating','sending'].includes(row.status))).then(rows=>rows.find(row=>row.id===key)!);
 const sends=()=>bot.requests.filter(r=>r.action.startsWith('send_'));
 let release=()=>{};
 try{
  await call('/v1/models','POST',{id:'fixture',provider:'openai',baseURL:`http://127.0.0.1:${(model.address() as {port:number}).port}/v1`,model:'fixture'});
  await call('/v1/model-routes','PUT',{chat:'fixture'});
  await call('/v1/channels/qq/sticker-options','PUT',{networkEnabled:false,revision:'initial'});
  await call('/v1/channels/qq','PUT',{url:bot.url,accountId:'10001',ownerId:'20002',groups:[],enabled:true,replyEnabled:true,proactiveEnabled:false,token:'fixture-token',revision:''});
  await wait(()=>call<{health:{state:string}}>('/v1/channels/qq'),s=>s.health.state==='online');
  expect(await done(begin([[{name:'send_message',args:{messages:['第一句','第二句']}}]]))).toMatchObject({status:'sent'});
  expect(requests).toHaveLength(1);expect(sends().map(r=>r.params.message)).toEqual([[{type:'text',data:{text:'第一句'}}],[{type:'text',data:{text:'第二句'}}]]);
  expect(await done(begin([[{name:'get_sticker_image',args:{id:'builtin-hello'}}],[{name:'send_message',args:{messages:['贴图一起发'] }},{name:'send_sticker',args:{id:'builtin-hello'}},{name:'send_poke',args:{}}]]))).toMatchObject({status:'sent'});
  expect(requests).toHaveLength(2);expect(JSON.stringify(requests[1]).match(/data:image[^,]{0,80},/g)).toEqual(expect.arrayContaining([expect.stringMatching(/;base64,$/)]));
  expect(sends().slice(2).map(r=>r.action)).toEqual(['send_private_msg','send_private_msg','send_poke']);expect(sends()[3]!.params.message).toEqual([{type:'image',data:{file:expect.stringMatching(/^base64:\/\//)}}]);
  const before=sends().length;
  expect(await done(begin([[{name:'send_message',args:{messages:['不能部分发送']}},{name:'send_sticker',args:{id:'not-viewed'}}]]))).toMatchObject({status:'failed'});
  expect(requests).toHaveLength(1);expect(sends()).toHaveLength(before);
  expect(await done(begin([[{name:'get_sticker_image',args:{id:'missing'}}],[{name:'send_message',args:{messages:['图片不可用，文字回复']}}]]))).toMatchObject({status:'sent'});
  expect(requests).toHaveLength(2);expect(sends()).toHaveLength(before+1);
  expect(await done(begin([[{name:'get_sticker_image',args:{id:'builtin-hello'}}],[{name:'send_sticker',args:{id:'builtin-hello'}}]]))).toMatchObject({status:'sent'});
  expect(requests).toHaveLength(2);expect(sends()).toHaveLength(before+2);
  expect(await done(begin([[{name:'skip_reply',args:{}}]]))).toMatchObject({status:'skipped'});
  expect(requests).toHaveLength(1);expect(sends()).toHaveLength(before+2);
  const permissionGate=bot.pauseNextLogin();
  const revoked=begin([[{name:'get_sticker_image',args:{id:'builtin-hello'}}],[{name:'send_sticker',args:{id:'builtin-hello'}}]]);
  await permissionGate.reached;const stickers=await call<{id:string;revision:string}[]>('/v1/channels/qq/stickers');
  await call('/v1/channels/qq/stickers/builtin-hello','PUT',{enabled:false,revision:stickers.find(s=>s.id==='builtin-hello')!.revision});permissionGate.release();
  expect(await done(revoked)).toMatchObject({status:'blocked'});expect(requests).toHaveLength(2);expect(sends()).toHaveLength(before+2);
  const ready=new Promise<void>(resolve=>{entered=resolve;});gate=new Promise<void>(resolve=>{release=resolve;});
  const cancelled=begin([[{name:'send_message',args:{messages:['取消后不发送']}}]]);await ready;
  await call('/v1/channels/qq/stop','POST');release();
  expect(await done(cancelled)).toMatchObject({status:'interrupted'});expect(sends()).toHaveLength(before+2);expect(unexpected).toBe(0);
 }finally{release();await runtime.stop();await bot.close();await new Promise<void>(resolve=>{model.close(()=>resolve());model.closeAllConnections();});rmSync(p.root,{recursive:true,force:true});}
},45000);
