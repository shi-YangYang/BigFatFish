import {expect,it,vi} from 'vitest';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {setTimeout as delay} from 'node:timers/promises';
import {paths} from '../../apps/runtime/src/paths.js';
import {startRuntime} from '../../apps/runtime/src/lifecycle.js';
import {requestRuntime} from '../../apps/runtime/src/connection.js';
import {fixtureModel} from '../fixtures/model.mjs';
import {onebotFixture} from '../fixtures/onebot.js';
import {StickerLibrary,validateStickerImage,type StickerInfo} from '../../apps/runtime/src/channels/stickers.js';
import {NetworkStickers,stickerURL,publicIPv4} from '../../apps/runtime/src/channels/sticker-network.js';
import {StickerTurn} from '../../apps/runtime/src/channels/sticker-turn.js';
import {migrate,migrations} from '../../apps/runtime/src/storage/database.js';
import {exportArchive,restoreArchive} from '../../apps/runtime/src/maintenance/archive.js';
import type {ChannelStatus} from '../../apps/runtime/src/channels/types.js';
import {DSHAdapter} from '../../apps/runtime/src/ai/dsh.js';
const png=()=>sharp({create:{width:32,height:32,channels:3,background:'#22789f'}}).png().toBuffer();
const wait=async<T>(read:()=>Promise<T>,done:(value:T)=>boolean)=>{let value=await read();for(let i=0;i<600&&!done(value);i++){await delay(25);value=await read();}expect(done(value),JSON.stringify(value)).toBe(true);return value;};
const model=(baseURL:string)=>({id:'model',label:'测试',provider:'openai',baseURL,model:'fixture',vision:true});
const incoming=(id:string)=>({post_type:'message',message_type:'private',self_id:'10001',user_id:'20002',message_id:id,message:[{type:'text',data:{text:'开心，发个表情'}}]});

it('validates/persists the local library, backups and old schema archives',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff-sticker-data-')),p=paths(join(root,'source')),rt=await startRuntime(p);let stopped=false;
 const call=<T>(route:string,method='GET',body?:unknown)=>requestRuntime<T>(rt.connection,route,method,body);
 try{
  const builtins=await call<StickerInfo[]>('/v1/channels/qq/stickers');expect(builtins).toHaveLength(3);expect(builtins.every(s=>s.builtin&&s.enabled)).toBe(true);expect(JSON.stringify(builtins)).not.toContain('data');
  const data=(await png()).toString('base64'),item=await call<StickerInfo>('/v1/channels/qq/stickers','POST',{name:'测试图片',description:'开心',data});
  expect(await call('/v1/channels/qq/stickers/'+item.id+'/image')).toMatchObject({data,mimeType:'image/png'});
  await expect(call('/v1/channels/qq/stickers','POST',{name:'假图',description:'',data:'aGVsbG8='})).rejects.toThrow();
  await expect(call('/v1/channels/qq/stickers','POST',{name:'大图',description:'',data:Buffer.alloc(2_000_001).toString('base64')})).rejects.toThrow();
  await expect(call('/v1/channels/qq/stickers/'+builtins[0]!.id,'DELETE')).rejects.toThrow('BUILTIN_STICKER');
  await call('/v1/channels/qq/stickers/'+item.id,'PUT',{enabled:false,revision:item.revision});
  await call('/v1/channels/qq/sticker-options','PUT',{networkEnabled:false,revision:'initial'});
  await rt.stop();stopped=true;
  const archive=join(root,'backup.json');await exportArchive(p,archive,{scopes:['plugins']});const restored=paths(join(root,'restored'));await restoreArchive(restored,archive);
  const db=new DatabaseSync(restored.database);const library=new StickerLibrary(db);expect(library.info(item.id)).toMatchObject({name:item.name,enabled:false});expect(library.options().networkEnabled).toBe(false);library.remove(item.id);expect(()=>library.image(item.id)).toThrow('STICKER_NOT_FOUND');db.close();
  // A valid schema-6 archive has no sticker tables. Its data restores without inventing rows.
  const envelope=JSON.parse(readFileSync(archive,'utf8')),payload=JSON.parse(Buffer.from(envelope.files[0].content,'base64').toString());payload.schema=6;delete payload.tables.qq_stickers;delete payload.tables.qq_sticker_options;const bytes=Buffer.from(JSON.stringify(payload));envelope.files[0]={path:'data.json',content:bytes.toString('base64'),size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};const legacy=join(root,'legacy.json');writeFileSync(legacy,JSON.stringify(envelope));const legacyP=paths(join(root,'legacy'));await restoreArchive(legacyP,legacy);const old=new DatabaseSync(legacyP.database);expect(new StickerLibrary(old).list()).toHaveLength(0);old.close();
  const migration=new DatabaseSync(':memory:');migrate(migration,migrations.slice(0,6));migrate(migration);expect(migration.prepare('PRAGMA user_version').get()?.user_version).toBe(7);migration.close();
 }finally{if(!stopped)await rt.stop();rmSync(root,{recursive:true,force:true});}
});

it('restricts network sources, decodes real image bytes and revokes pending local/network selections',async()=>{
 const db=new DatabaseSync(':memory:');migrate(db);const library=new StickerLibrary(db),image=await png(),local=await library.add({name:'开心',description:'笑',data:image.toString('base64')});
 const fetches:string[]=[];const network=new NetworkStickers(async(url,signal,catalog)=>{signal.throwIfAborted();fetches.push(url);return catalog?Buffer.from(JSON.stringify({gallery:{'DeepSeek娘':{images:[{name:'开心鱼',story:{zh:'开心地笑'},preview:'https://img.aigengtu.com/0_preview/meme/001.webp',original:'https://img.aigengtu.com/meme/001.webp'},{name:'开心色情',original:'https://img.aigengtu.com/meme/002.webp'},{name:'开心假图',original:'https://127.0.0.1/meme/003.png'}]}}})):sharp(image).webp().toBuffer();});
 try{
  for(const url of ['http://img.aigengtu.com/meme/001.png','https://evil.test/meme/001.png','https://img.aigengtu.com/other/001.png','https://img.aigengtu.com/meme/001.png?token=x','https://img.aigengtu.com/meme/../001.png'])expect(()=>stickerURL(url)).toThrow();
  for(const ip of ['127.0.0.1','169.254.169.254','10.0.0.1','100.64.0.1','192.168.1.1','172.31.1.1','::1'])expect(publicIPv4(ip)).toBe(false);expect(publicIPv4('8.8.8.8')).toBe(true);
  const control=new AbortController(),turn=new StickerTurn(library,()=>control.signal.throwIfAborted(),network),tool=async(name:string,args:unknown)=>{const t=turn.tools().find(t=>t.name===name)!,result=await t.execute(args,control.signal);t.onImageResult?.(result,true);return result;};
  await expect(tool('send_sticker',{id:local.id})).rejects.toThrow('STICKER_VIEW_REQUIRED');
  const found=await tool('search_stickers',{query:'开心'}) as {id:string}[];expect(found).toHaveLength(1);const id=found[0]!.id;
  const viewed=await tool('get_sticker_image',{id}) as {image:{data:string;mimeType:string}};expect(viewed.image.mimeType).toBe('image/png');expect((await sharp(Buffer.from(viewed.image.data,'base64')).metadata()).width).toBe(32);
  await tool('send_sticker',{id});expect(turn.segment()?.type).toBe('image');expect(fetches).toHaveLength(2);expect(fetches[1]).toBe('https://img.aigengtu.com/0_preview/meme/001.webp');
  library.saveOptions({networkEnabled:false,revision:'initial'});expect(()=>turn.segment()).toThrow('STICKER_CHANGED');
  const localTurn=new StickerTurn(library,()=>control.signal.throwIfAborted(),network),invoke=async(name:string,args:unknown)=>{const t=localTurn.tools().find(t=>t.name===name)!,result=await t.execute(args,control.signal);t.onImageResult?.(result,true);return result;};
  await invoke('get_sticker_image',{id:local.id});await invoke('send_sticker',{id:local.id});library.update(local.id,{revision:local.revision,enabled:false});expect(()=>localTurn.segment()).toThrow('STICKER_CHANGED');
  control.abort();await expect(invoke('list_stickers',{})).rejects.toThrow();
 }finally{db.close();}
});

it('real DSH sees actual tool image pixels and sends one image with the QQ text',async()=>{
 const p=paths(mkdtempSync(join(tmpdir(),'bff-sticker-dsh-'))),fixture=await fixtureModel(),bot=await onebotFixture(),runtime=await startRuntime(p);
 const call=<T>(route:string,method='GET',body?:unknown)=>requestRuntime<T>(runtime.connection,route,method,body);
 try{
  await call('/v1/models','POST',model(fixture.url));await call('/v1/model-routes','PUT',{chat:'model'});
  const data=(await png()).toString('base64'),item=await call<StickerInfo>('/v1/channels/qq/stickers','POST',{name:'开心',description:'开心聊天',data});fixture.controls.sticker=item.id;
  await call('/v1/channels/qq/sticker-options','PUT',{networkEnabled:false,revision:'initial'});
  await call('/v1/channels/qq','PUT',{url:bot.url,accountId:'10001',ownerId:'20002',groups:[],enabled:true,replyEnabled:true,proactiveEnabled:false,token:'fixture-token',revision:''});await wait(()=>call<ChannelStatus>('/v1/channels/qq'),s=>s.health.state==='online');
  bot.event(incoming('1'));const deliveries=await wait(()=>call<{id:string;status:string;error:string}[]>('/v1/channels/qq/deliveries'),ds=>ds.some(d=>d.id.endsWith(':1')&&!['queued','generating','sending'].includes(d.status)));expect(deliveries[0]).toMatchObject({status:'sent'});
  const sends=bot.requests.filter(r=>r.action.startsWith('send_'));expect(sends).toHaveLength(1);expect(sends[0]!.params.message).toEqual([{type:'reply',data:{id:'1'}},{type:'text',data:{text:'好耶，给你看看我的表情！'}},{type:'image',data:{file:'base64://'+data}}]);
  expect(JSON.stringify(fixture.requests)).toContain('data:image/png;base64,');expect(JSON.stringify(fixture.requests)).toContain('queued_for_reply');
  fixture.controls.sticker=undefined;bot.event(incoming('2'));await wait(()=>call<{id:string;status:string}[]>('/v1/channels/qq/deliveries'),ds=>ds.some(d=>d.id.endsWith(':2')&&d.status==='sent'));expect(JSON.stringify(bot.requests.filter(r=>r.action.startsWith('send_')).at(-1)!.params.message)).not.toContain('base64://');
  bot.controls.send='disconnect';bot.event(incoming('3'));await wait(()=>call<{id:string;status:string}[]>('/v1/channels/qq/deliveries'),ds=>ds.some(d=>d.id.endsWith(':3')&&d.status==='unknown'));await delay(100);expect(bot.requests.filter(r=>r.action.startsWith('send_'))).toHaveLength(3);
 }finally{await runtime.stop();await bot.close();await fixture.close();rmSync(p.root,{recursive:true,force:true});}
},45000);

it('blocks a selected image revoked during the final QQ health request',async()=>{
 let selected='';const engine=vi.spyOn(DSHAdapter.prototype,'run').mockImplementation(async input=>{const view=input.tools!.find(t=>t.name==='get_sticker_image')!,result=await view.execute({id:selected},input.signal);view.onImageResult?.(result,true);await input.tools!.find(t=>t.name==='send_sticker')!.execute({id:selected},input.signal);input.onText('开心');return '开心';});
 const p=paths(mkdtempSync(join(tmpdir(),'bff-sticker-race-'))),bot=await onebotFixture(),runtime=await startRuntime(p);const call=<T>(r:string,m='GET',b?:unknown)=>requestRuntime<T>(runtime.connection,r,m,b);
 try{
  await call('/v1/models','POST',model('http://127.0.0.1:1/v1'));await call('/v1/model-routes','PUT',{chat:'model'});const item=await call<StickerInfo>('/v1/channels/qq/stickers','POST',{name:'开心',description:'',data:(await png()).toString('base64')});selected=item.id;
  await call('/v1/channels/qq','PUT',{url:bot.url,accountId:'10001',ownerId:'20002',groups:[],enabled:true,replyEnabled:true,proactiveEnabled:false,token:'fixture-token',revision:''});await wait(()=>call<ChannelStatus>('/v1/channels/qq'),s=>s.health.state==='online');
  const gate=bot.pauseNextLogin();bot.event(incoming('1'));await gate.reached;await call('/v1/channels/qq/stickers/'+item.id,'DELETE');gate.release();const rows=await wait(()=>call<{status:string;error:string}[]>('/v1/channels/qq/deliveries'),ds=>ds.some(d=>d.status==='blocked'));expect(rows[0]!.error).toBe('STICKER_NOT_FOUND');expect(bot.requests.filter(r=>r.action.startsWith('send_'))).toHaveLength(0);
 }finally{await runtime.stop();await bot.close();engine.mockRestore();rmSync(p.root,{recursive:true,force:true});}
});

it('bounds concurrent uploads and refuses a corrupt raster before persistence',async()=>{
 const db=new DatabaseSync(':memory:');migrate(db);const library=new StickerLibrary(db),bytes=await png();
 try{const corrupt=Buffer.from(bytes);corrupt[corrupt.length-20]=corrupt[corrupt.length-20]!^255;await expect(library.add({name:'坏图',description:'',data:corrupt.toString('base64')})).rejects.toThrow();expect(library.list()).toHaveLength(0);
 const results=await Promise.allSettled(Array.from({length:50},(_,i)=>library.add({name:'图片'+i,description:'',data:bytes.toString('base64')})));expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(48);expect(results.filter(r=>r.status==='rejected')).toHaveLength(2);expect(library.list()).toHaveLength(48);
 }finally{db.close();}
});

it('reserves the per-turn image budget before parallel downloads resolve',async()=>{
 const db=new DatabaseSync(':memory:');migrate(db);const library=new StickerLibrary(db);let release!:()=>void;const gate=new Promise<void>(r=>{release=r;});
 const network=new NetworkStickers();vi.spyOn(network,'search').mockResolvedValue(Array.from({length:4},(_,i)=>({id:'web-'+i,name:'开心',description:'',url:'https://img.aigengtu.com/0_preview/meme/001.webp'})));const image=(await png()).toString('base64');const load=vi.spyOn(network,'image').mockImplementation(async()=>{await gate;return {data:image,mimeType:'image/png',bytes:Buffer.from(image,'base64').length};});
 try{const turn=new StickerTurn(library,()=>{},network),tools=turn.tools(),signal=new AbortController().signal;await tools.find(t=>t.name==='search_stickers')!.execute({query:'开心'},signal);const view=(id:string)=>tools.find(t=>t.name==='get_sticker_image')!.execute({id},signal);const pending=['web-0','web-1','web-2'].map(view);await expect(view('web-3')).rejects.toThrow('STICKER_VIEW_LIMIT');await expect(view('web-0')).rejects.toThrow('STICKER_VIEW_BUSY');expect(load).toHaveBeenCalledTimes(3);release();await Promise.all(pending);}finally{release();db.close();vi.restoreAllMocks();}
});

it('rejects corrupt or oversized raster archives before replacing the destination',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff-sticker-restore-integrity-')),p=paths(join(root,'source')),q=paths(join(root,'destination'));
 const source=await startRuntime(p),target=await startRuntime(q);
 try{
  const valid=await png(),item=await requestRuntime<StickerInfo>(source.connection,'/v1/channels/qq/stickers','POST',{name:'完整图片',description:'',data:valid.toString('base64')});
  await source.stop();await target.stop();const before=readFileSync(q.database),archive=join(root,'valid.json');await exportArchive(p,archive,{scopes:['plugins']});
  const corrupt=Buffer.from(valid);corrupt[corrupt.length-20]=corrupt[corrupt.length-20]!^255;
  const oversized=await sharp({create:{width:4097,height:1,channels:3,background:'blue'}}).png().toBuffer();
  for(const [index,image] of [corrupt,oversized].entries()){
   await expect(validateStickerImage(image.toString('base64'))).rejects.toThrow('INVALID_STICKER_IMAGE');
   const envelope=JSON.parse(readFileSync(archive,'utf8')),payload=JSON.parse(Buffer.from(envelope.files[0].content,'base64').toString()),row=payload.tables.qq_stickers.find((r:{id:string})=>r.id===item.id);row.data=image.toString('base64');row.bytes=image.length;
   const bytes=Buffer.from(JSON.stringify(payload));envelope.files[0]={path:'data.json',content:bytes.toString('base64'),size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};const bad=join(root,'bad-'+index+'.json');writeFileSync(bad,JSON.stringify(envelope));
   await expect(restoreArchive(q,bad)).rejects.toThrow('INVALID_STICKER_IMAGE');expect(readFileSync(q.database)).toEqual(before);
  }
  // The failed staging validation releases the instance lock and leaves a usable destination.
  await restoreArchive(q,archive);const restored=new DatabaseSync(q.database);expect(new StickerLibrary(restored).image(item.id).data).toBe(valid.toString('base64'));restored.close();
 }finally{await source.stop();await target.stop();rmSync(root,{recursive:true,force:true});}
});

it('does not authorize send when the real DSH attachment decoder rejects a tool image',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff-sticker-present-')),p=paths(root),fixture=await fixtureModel(),runtime=await startRuntime(p);await runtime.stop();
 const db=new DatabaseSync(p.database),library=new StickerLibrary(db),adapter=new DSHAdapter(p);
 try{
  const valid=await png(),item=await library.add({name:'开心',description:'',data:valid.toString('base64')});library.saveOptions({networkEnabled:false,revision:'initial'});fixture.controls.sticker=item.id;
  const turn=new StickerTurn(library,()=>{},new NetworkStickers()),tools=turn.tools(),view=tools.find(t=>t.name==='get_sticker_image')!,original=view.execute;
  const corrupt=Buffer.from(valid);corrupt[corrupt.length-20]=corrupt[corrupt.length-20]!^255;
  // Fault injection occurs after library retrieval: it exercises DSH's actual saveImage failure,
  // rather than pretending a tool execute rejection is the same as downstream presentation failure.
  view.execute=async(args,signal)=>{const result=await original(args,signal) as {image:{data:string}};result.image.data=corrupt.toString('base64');return result;};
  const presented=vi.fn(view.onImageResult);view.onImageResult=presented;
  const events:{name:string;state:string}[]=[];
  const {defaultPersona}=await import('../../apps/runtime/src/ai/configuration.js');
  await adapter.run({sessionId:'failed-image',resume:false,conversationId:'failed-image',prompt:'开心，发个表情',persona:defaultPersona,model:{id:'model',label:'测试',provider:'openai',baseURL:fixture.url,model:'fixture'},key:'',signal:new AbortController().signal,tools,onTool:e=>events.push(e),onText:()=>{},onSessionReady:()=>{}});
  expect(presented).toHaveBeenCalledWith(expect.anything(),false);expect(presented.mock.calls.some(([,ok])=>ok)).toBe(false);
  expect(events).toContainEqual({name:'get_sticker_image',state:'failed'});expect(events).toContainEqual({name:'send_sticker',state:'failed'});
  expect(JSON.stringify(fixture.requests)).not.toContain('data:image/png;base64,');expect(JSON.stringify(fixture.requests)).not.toContain('queued_for_reply');
  await expect(tools.find(t=>t.name==='send_sticker')!.execute({id:item.id},new AbortController().signal)).rejects.toThrow('STICKER_VIEW_REQUIRED');expect(turn.segment()).toBeUndefined();
  // A missing receipt also cannot grant eligibility; a late failed receipt revokes a selection.
  const good=await original({id:item.id},new AbortController().signal);await expect(tools.find(t=>t.name==='send_sticker')!.execute({id:item.id},new AbortController().signal)).rejects.toThrow('STICKER_VIEW_REQUIRED');
  view.onImageResult!(good,true);await tools.find(t=>t.name==='send_sticker')!.execute({id:item.id},new AbortController().signal);view.onImageResult!(good,false);expect(()=>turn.segment()).toThrow('STICKER_VIEW_REQUIRED');
 }finally{await adapter.close();db.close();await fixture.close();rmSync(root,{recursive:true,force:true});}
},30000);
