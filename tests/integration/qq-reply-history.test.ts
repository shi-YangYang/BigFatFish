import {expect,it,vi} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {paths,preparePaths} from '../../apps/runtime/src/paths.js';
import {openDatabase} from '../../apps/runtime/src/storage/database.js';
import {ChatService} from '../../apps/runtime/src/ai/chat.js';
import {DSHAdapter} from '../../apps/runtime/src/ai/dsh.js';
import type {EngineInput} from '../../apps/runtime/src/ai/engine.js';
import {Channels} from '../../apps/runtime/src/channels/service.js';
import {onebotFixture} from '../fixtures/onebot.js';

const until=async<T>(read:()=>T,done:(value:T)=>boolean)=>{for(let i=0;i<200;i++){const value=read();if(done(value))return value;await delay(10);}throw new Error('FIXTURE_TIMEOUT');};
const tool=(input:EngineInput,name:string,args:unknown)=>input.tools!.find(t=>t.name===name)!.execute(args,input.signal);
async function fixture(){
 const p=paths(mkdtempSync(join(tmpdir(),'bff-reply-history-')));preparePaths(p);
 const db=openDatabase(p.database),chat=new ChatService(db,p),channels=new Channels(db,chat),bot=await onebotFixture();
 chat.config.saveModel({id:'fixture',provider:'openai',baseURL:'https://unused.invalid/v1',model:'fixture'});chat.config.saveRoutes({chat:'fixture'});
 await channels.initialize();channels.save({url:bot.url,accountId:'10001',ownerId:'20002',friendIds:[],groups:[],enabled:true,replyEnabled:true,proactiveEnabled:false,token:'fixture-token',revision:''});
 await until(()=>channels.status().health.state,state=>state==='online');
 let sequence=0;
 const begin=(text:string)=>{const id=String(++sequence);bot.event({post_type:'message',message_type:'private',self_id:'10001',user_id:'20002',message_id:id,message:[{type:'text',data:{text}}]});return `10001:private:20002:${id}`;};
 const done=async(id:string)=>{
  const delivery=await until(()=>channels.deliveries().find(d=>d.id===id),d=>!!d&&!['queued','generating','sending'].includes(String(d.status)));
  const conversation=chat.conversations().find(c=>c.readOnly)!;
  return {delivery,message:chat.messages(conversation.id).filter(m=>m.role==='assistant').at(-1)!};
 };
 return {db,chat,channels,bot,begin,done,close:async()=>{await channels.close();await chat.close();db.close();await bot.close();rmSync(p.root,{recursive:true,force:true});}};
}

it.each(['','这是不会发送的总结'])('stores selected split replies instead of engine final %j',async final=>{
 const f=await fixture();
 const spy=vi.spyOn(DSHAdapter.prototype,'run').mockImplementation(async input=>{
  await tool(input,'send_message',{messages:['第一句','第二句']});
  if(final)input.onText(final);
  return final;
 });
 try{
  const result=await f.done(f.begin('你好'));
  expect(result.delivery).toMatchObject({status:'sent'});
  expect(result.message).toMatchObject({status:'completed',content:'第一句\n第二句'});
  expect(f.bot.requests.filter(r=>r.action.startsWith('send_')).map(r=>r.params.message)).toEqual([
   [{type:'text',data:{text:'第一句'}}],[{type:'text',data:{text:'第二句'}}],
  ]);
  // The restore path must also read the selected body, not the discarded final.
  f.db.prepare("UPDATE agent_sessions SET initialized=0,context_hash='restored' WHERE conversation_id=?").run(result.message.conversationId);
  spy.mockImplementationOnce(async input=>{expect(input.prompt).toContain('第一句\\n第二句');expect(input.prompt).not.toContain('这是不会发送的总结');return '接着聊';});
  expect((await f.done(f.begin('继续'))).message.content).toBe('接着聊');
 }finally{spy.mockRestore();await f.close();}
});

it('keeps silence, image and poke text empty while ordinary chat keeps its final',async()=>{
 const f=await fixture();
 const spy=vi.spyOn(DSHAdapter.prototype,'run');
 try{
  spy.mockImplementationOnce(async input=>{await tool(input,'skip_reply',{});return '不要记录这句静默说明';});
  const quiet=await f.done(f.begin('静默'));expect(quiet.delivery).toMatchObject({status:'skipped'});expect(quiet.message).toMatchObject({status:'completed',content:''});
  expect(f.bot.requests.filter(r=>r.action.startsWith('send_'))).toHaveLength(0);
  spy.mockImplementationOnce(async input=>{
   const view=input.tools!.find(t=>t.name==='get_sticker_image')!,image=await view.execute({id:'builtin-hello'},input.signal);view.onImageResult!(image,true);
   await tool(input,'send_sticker',{id:'builtin-hello'});return '';
  });
  const image=await f.done(f.begin('图片'));expect(image.delivery).toMatchObject({status:'sent'});expect(image.message).toMatchObject({status:'completed',content:''});
  expect(f.bot.requests.filter(r=>r.action.startsWith('send_')).at(-1)!.params.message).toEqual([{type:'image',data:{file:expect.stringMatching(/^base64:\/\//)}}]);
  spy.mockImplementationOnce(async input=>{await tool(input,'send_poke',{});return '';});
  const poke=await f.done(f.begin('拍拍'));expect(poke.delivery).toMatchObject({status:'sent'});expect(poke.message).toMatchObject({status:'completed',content:''});
  expect(f.bot.requests.filter(r=>r.action.startsWith('send_')).map(r=>r.action)).toEqual(['send_private_msg','send_poke']);
  spy.mockImplementationOnce(async()=> '普通聊天原文');
  const c=f.chat.create({}),m=f.chat.send(c.id,{requestId:'ordinary',content:'你好'});
  expect(await until(()=>f.chat.message(m.id),m=>!['queued','running'].includes(m.status))).toMatchObject({status:'completed',content:'普通聊天原文'});
 }finally{spy.mockRestore();await f.close();}
});

it('separates canonical generated text from failed, unknown and cancelled delivery',async()=>{
 const f=await fixture();const spy=vi.spyOn(DSHAdapter.prototype,'run');
 try{
  spy.mockImplementationOnce(async input=>{await tool(input,'send_message',{messages:['不得发送']});throw new Error('MODEL_RUN_FAILED');});
  const failed=await f.done(f.begin('生成失败'));expect(failed.delivery).toMatchObject({status:'failed'});expect(failed.message).toMatchObject({status:'failed',content:''});
  expect(f.bot.requests.filter(r=>r.action.startsWith('send_'))).toHaveLength(0);
  f.bot.controls.send='malformed';
  spy.mockImplementationOnce(async input=>{await tool(input,'send_message',{messages:['生成成功','但未确认送达']});return '未发送的总结';});
  const unknown=await f.done(f.begin('协议未知'));expect(unknown.delivery).toMatchObject({status:'unknown'});expect(unknown.message).toMatchObject({status:'completed',content:'生成成功\n但未确认送达'});
  expect(f.bot.requests.filter(r=>r.action.startsWith('send_'))).toHaveLength(1);
  let entered!:()=>void;const ready=new Promise<void>(resolve=>{entered=resolve;});
  spy.mockImplementationOnce(async input=>{await tool(input,'send_message',{messages:['取消后不得发送']});entered();await new Promise<void>(resolve=>input.signal.addEventListener('abort',()=>resolve(),{once:true}));return '';});
  const id=f.begin('取消');await ready;f.channels.enable(false);
  const cancelled=await f.done(id);expect(cancelled.delivery).toMatchObject({status:'interrupted'});expect(cancelled.message).toMatchObject({status:'cancelled',content:''});
  expect(f.bot.requests.filter(r=>r.action.startsWith('send_'))).toHaveLength(1);
 }finally{spy.mockRestore();await f.close();}
});
