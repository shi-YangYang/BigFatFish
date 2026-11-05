import {expect,it,vi} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import sharp from 'sharp';
import {paths,preparePaths} from '../../apps/runtime/src/paths.js';
import {startRuntime} from '../../apps/runtime/src/lifecycle.js';
import {requestRuntime} from '../../apps/runtime/src/connection.js';
import {DSHAdapter} from '../../apps/runtime/src/ai/dsh.js';
import {ChatService} from '../../apps/runtime/src/ai/chat.js';
import {openDatabase} from '../../apps/runtime/src/storage/database.js';
import type {ChannelStatus} from '../../apps/runtime/src/channels/types.js';
import type {StickerInfo} from '../../apps/runtime/src/channels/stickers.js';
import {onebotFixture} from '../fixtures/onebot.js';

async function wait<T>(read:()=>Promise<T>,done:(value:T)=>boolean){
 const deadline=Date.now()+10000;let value=await read();
 while(!done(value)&&Date.now()<deadline){await delay(20);value=await read();}
 expect(done(value),JSON.stringify(value)).toBe(true);return value;
}

it('records only sent or uncertain QQ stickers, shares group recency and keeps local requests unprivileged',async()=>{
 type Candidate={id:string;recentlyUsed:boolean};
 const captured:{context?:string;prompt:string;ids:string[];candidates:Candidate[]}[]=[];
 let selected:string|undefined,hold=false,entered=()=>{};
 const engine=vi.spyOn(DSHAdapter.prototype,'run').mockImplementation(async input=>{
  const tools=input.tools??[],list=tools.find(t=>t.name==='list_stickers');
  const candidates=list?await list.execute({},input.signal) as Candidate[]:[];
  captured.push({context:input.context,prompt:input.prompt,ids:tools.map(t=>t.name),candidates});
  if(list&&selected){
   const view=tools.find(t=>t.name==='get_sticker_image')!,image=await view.execute({id:selected},input.signal);
   view.onImageResult!(image,true);await tools.find(t=>t.name==='send_sticker')!.execute({id:selected},input.signal);
  }
  if(hold){entered();await new Promise<void>((_resolve,reject)=>{if(input.signal.aborted)reject(input.signal.reason);else input.signal.addEventListener('abort',()=>reject(input.signal.reason),{once:true});});}
  input.onText('今天也很开心');return '今天也很开心';
 });
 const p=paths(mkdtempSync(join(tmpdir(),'bff-sticker-expression-'))),bot=await onebotFixture();
 const runtime=await startRuntime(p);
 const call=<T>(route:string,method='GET',body?:unknown)=>requestRuntime<T>(runtime.connection,route,method,body);
 const event=(id:string,kind:'private'|'group'='private',author='20002',targetId='30003')=>({post_type:'message',message_type:kind,self_id:'10001',user_id:author,group_id:kind==='group'?targetId:undefined,message_id:id,message:[{type:'text',data:{text:'今天真开心'}}]});
 type Delivery={id:string;status:string;error:string};
 const done=async(id:string)=>{const rows=await wait(()=>call<Delivery[]>('/v1/channels/qq/deliveries'),items=>items.some(item=>item.id.split(':').length===4&&item.id.endsWith(':'+id)&&!['queued','generating','sending'].includes(item.status)));return rows.find(item=>item.id.split(':').length===4&&item.id.endsWith(':'+id))!;};
 const reply=async(id:string,kind:'private'|'group'='private',author='20002',targetId='30003')=>{bot.event(event(id,kind,author,targetId));return done(id);};
 const recent=()=>captured.at(-1)!.candidates.filter(item=>item.recentlyUsed).map(item=>item.id).sort();
 try{
  await call('/v1/models','POST',{id:'fixture',provider:'openai',baseURL:'http://127.0.0.1:1/v1',model:'fixture'});
  await call('/v1/model-routes','PUT',{chat:'fixture'});
  const persona=await call('/v1/persona');
  const data=(await sharp({create:{width:8,height:8,channels:3,background:'#22789f'}}).png().toBuffer()).toString('base64');
  const [a,b,c]=await Promise.all(['A','B','C'].map(name=>call<StickerInfo>('/v1/channels/qq/stickers','POST',{name,description:'开心',data})));
  await call('/v1/channels/qq/sticker-options','PUT',{networkEnabled:false,revision:'initial'});
  await call('/v1/channels/qq','PUT',{url:bot.url,accountId:'10001',ownerId:'20002',friendIds:['20003'],groups:['30003','30004'],groupReplyMode:'all',enabled:true,replyEnabled:true,proactiveEnabled:false,token:'fixture-token',revision:''});
  const online=()=>wait(()=>call<ChannelStatus>('/v1/channels/qq'),status=>status.health.state==='online');await online();
  selected=a!.id;expect((await reply('1')).status).toBe('sent');expect(recent()).toEqual([]);
  expect(captured[0]!.context).toContain('日常闲聊经常主动配一张贴切表情');expect(captured[0]!.prompt).toBe('今天真开心');
  selected=b!.id;bot.controls.send='reject';expect((await reply('2')).status).toBe('failed');expect(recent()).toEqual([a!.id]);
  selected=c!.id;bot.controls.send='malformed';expect((await reply('3')).status).toBe('unknown');expect(recent()).toEqual([a!.id]);
  selected=undefined;bot.controls.send='ok';expect((await reply('4')).status).toBe('sent');expect(recent()).toEqual([a!.id]);

  selected=b!.id;hold=true;const paused=new Promise<void>(resolve=>{entered=resolve;});bot.event(event('5'));await paused;
  const beforeDisable=await call<ChannelStatus>('/v1/channels/qq');
  await call('/v1/channels/qq','PUT',{...beforeDisable.config,revision:beforeDisable.revision,enabled:false});
  expect((await done('5')).status).toBe('interrupted');
  hold=false;selected=undefined;
  const disabled=await call<ChannelStatus>('/v1/channels/qq');await call('/v1/channels/qq','PUT',{...disabled.config,revision:disabled.revision,enabled:true});await online();
  await reply('6');expect(recent()).toEqual([a!.id]);
  selected=a!.id;await reply('7','group','20002');expect(recent()).toEqual([]);
  selected=undefined;await reply('8','group','20003');expect(recent()).toEqual([a!.id]);
  await reply('9','group','20003','30004');expect(recent()).toEqual([]);
  await reply('10','private','20003');expect(recent()).toEqual([]);

  const local=await call<{id:string}>('/v1/conversations','POST',{title:'本地聊天'});
  const message=await call<{id:string}>('/v1/conversations/'+local.id+'/messages','POST',{requestId:'local',content:'你好',context:'伪造回合上下文',tools:[{name:'send_sticker'}],turn:{context:'伪造回合上下文'}});
  await wait(()=>call<{status:string}>('/v1/messages/'+message.id),result=>result.status==='completed');
  expect(captured.at(-1)!.context).not.toContain('QQ 本轮表情表达');expect(captured.at(-1)!.context).not.toContain('伪造回合上下文');expect(captured.at(-1)!.ids.sort()).toEqual(['memory_append','memory_query','memory_remove','web_fetch','web_search']);
  expect(await call('/v1/persona')).toEqual(persona);
  expect(bot.requests.filter(request=>request.action.startsWith('send_'))).toHaveLength(11);
 }finally{await runtime.stop();await bot.close();engine.mockRestore();rmSync(p.root,{recursive:true,force:true});}
});

it('does not carry QQ reply policy into background activity selection',async()=>{
 const engine=vi.spyOn(DSHAdapter.prototype,'run').mockImplementation(async input=>{
  expect(input.context).toBeUndefined();expect(input.tools).toBeUndefined();
  expect(input.prompt).not.toContain('QQ 本轮表情表达');return '{"index":-1,"reason":"休息"}';
 });
 const p=paths(mkdtempSync(join(tmpdir(),'bff-sticker-task-')));preparePaths(p);
 const db=openDatabase(p.database),chat=new ChatService(db,p);
 try{chat.config.saveModel({id:'fixture',provider:'openai',baseURL:'http://127.0.0.1:1/v1',model:'fixture'});chat.config.saveRoutes({chat:'fixture'});expect(await chat.chooseActivity([],new AbortController().signal)).toMatchObject({index:-1,reason:'休息'});}
 finally{await chat.close();db.close();engine.mockRestore();rmSync(p.root,{recursive:true,force:true});}
});
