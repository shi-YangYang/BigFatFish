import {expect,it,vi} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import sharp from 'sharp';
import {migrate,migrations,openDatabase} from '../../apps/runtime/src/storage/database.js';
import {ConversationNotes} from '../../apps/runtime/src/memory/notes.js';
import {MemoryStore} from '../../apps/runtime/src/memory/store.js';
import {personaCards} from '../../apps/runtime/src/ai/persona-cards.js';
import {QQReplyTurn} from '../../apps/runtime/src/channels/reply-turn.js';
import {StickerTurn} from '../../apps/runtime/src/channels/sticker-turn.js';
import {StickerLibrary} from '../../apps/runtime/src/channels/stickers.js';
import {NetworkStickers} from '../../apps/runtime/src/channels/sticker-network.js';
import {DSHAdapter} from '../../apps/runtime/src/ai/dsh.js';
import {paths,preparePaths} from '../../apps/runtime/src/paths.js';
import {startRuntime} from '../../apps/runtime/src/lifecycle.js';
import {requestRuntime} from '../../apps/runtime/src/connection.js';
import {exportArchive,restoreArchive} from '../../apps/runtime/src/maintenance/archive.js';
import {fixtureModel} from '../fixtures/model.mjs';
import {onebotFixture} from '../fixtures/onebot.js';
import type {ChannelStatus} from '../../apps/runtime/src/channels/types.js';
const wait=async<T>(read:()=>Promise<T>,done:(v:T)=>boolean)=>{for(let n=0;n<500;n++){const v=await read();if(done(v))return v;await delay(20);}throw new Error('FIXTURE_TIMEOUT');};

it('preserves complete card fingerprints, scope provenance and schema7/8 archives',async()=>{
 expect(personaCards.map(c=>c.id)).toEqual(['daughter','tsundere']);
 for(const c of personaCards)expect(createHash('sha256').update(c.prompt).digest('hex')).toBe(c.sha256);
 expect(personaCards.map(c=>c.sha256)).toEqual(['531c50771109e1ac0e80c43b5ca04515de3416dd74cc27d778806e1e8ae7c9f6','6e231a9d2a041f8bf1c448290107c1ae5710ced192a9e99d1e48104b03d0632a']);
 const root=mkdtempSync(join(tmpdir(),'bff-card-notes-')),p=paths(join(root,'source'));preparePaths(p);const db=openDatabase(p.database),store=new MemoryStore(db),notes=new ConversationNotes(db),signal=new AbortController().signal;
 try{
  const privateMemory=store.create({kind:'fact',subject:'秘密',content:'秘密主人数据',importance:3});const shared=store.update(privateMemory.id,{version:privateMemory.version,visibility:'shared'});
  const checks:(()=>void)[]=[];
  const tool=(scope:string,observe=(c:()=>void)=>checks.push(c))=>Object.fromEntries(notes.tools(scope,{id:'incoming',author:'qq-user:2',text:'我喜欢海洋'},store,'group',()=>{},observe).map(t=>[t.name,t]));
  const a=tool('qq:1:group:2'),b=tool('qq:1:group:3');
  const note=await a.memory_append!.execute({content:'我喜欢海洋',quote:'喜欢海洋'},signal) as {id:string};
  expect(JSON.stringify(await b.memory_query!.execute({query:'海洋'},signal))).not.toContain(note.id);
  await expect(b.memory_remove!.execute({id:note.id},signal)).rejects.toThrow('MEMORY_NOTE_NOT_FOUND');
  await a.memory_query!.execute({query:'秘密'},signal);store.update(shared.id,{version:shared.version,visibility:'private'});expect(()=>checks.forEach(c=>c())).toThrow('MEMORY_SCOPE_CHANGED');
  expect(JSON.stringify(await b.memory_query!.execute({query:'秘密'},signal))).not.toContain('秘密主人数据');
  await expect(a.memory_append!.execute({content:'来自共享记忆的秘密',quote:'喜欢海洋'},signal)).rejects.toThrow('INVALID_MEMORY_SOURCE');
  db.close();const file=join(root,'notes.json');await exportArchive(p,file,{scopes:['memories']});const q=paths(join(root,'restored'));await restoreArchive(q,file);const restored=openDatabase(q.database);expect(restored.prepare('SELECT * FROM conversation_notes').get()).toMatchObject({id:note.id,scope:'qq:1:group:2',source_id:'incoming',quote:'喜欢海洋'});restored.close();
  const envelope=JSON.parse(readFileSync(file,'utf8')),payload=JSON.parse(Buffer.from(envelope.files[0].content,'base64').toString());payload.schema=7;delete payload.tables.conversation_notes;const bytes=Buffer.from(JSON.stringify(payload));envelope.files[0]={path:'data.json',size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),content:bytes.toString('base64')};const oldFile=join(root,'old.json');writeFileSync(oldFile,JSON.stringify(envelope));const oldP=paths(join(root,'old'));await restoreArchive(oldP,oldFile);const old=openDatabase(oldP.database);expect(old.prepare('SELECT * FROM conversation_notes').all()).toEqual([]);old.close();
  const upgrade=new DatabaseSync(':memory:');migrate(upgrade,migrations.slice(0,7));migrate(upgrade);expect(upgrade.prepare('PRAGMA user_version').get()!.user_version).toBe(8);upgrade.close();
 }finally{try{db.close();}catch{}rmSync(root,{recursive:true,force:true});}
});

it('requires actual image presentation, bounds split replies and scopes pokes',async()=>{
 const db=new DatabaseSync(':memory:');migrate(db);const library=new StickerLibrary(db),signal=new AbortController().signal,data=(await sharp({create:{width:8,height:8,channels:3,background:'blue'}}).png().toBuffer()).toString('base64');let allowed=true;
 const turn=new QQReplyTurn(new StickerTurn(library,()=>{},new NetworkStickers()),library,'20002',['abcd'],async()=>data,()=>{if(!allowed)throw new Error('REVOKED');},true);const tools=Object.fromEntries(turn.tools().map(t=>[t.name,t]));
 try{const image=await tools.get_message_images!.execute({index:1},signal);await expect(tools.collect_sticker!.execute({index:1,name:'海洋',note:'海洋'},signal)).rejects.toThrow('STICKER_VIEW_REQUIRED');tools.get_message_images!.onImageResult!(image,true);const collected=await tools.collect_sticker!.execute({index:1,name:'海洋',note:'海洋'},signal) as {id:string};const picture=await tools.get_sticker_image!.execute({id:collected.id},signal);tools.get_sticker_image!.onImageResult!(picture,true);await tools.sticker_note!.execute({id:collected.id,note:'开心'},signal);await tools.send_sticker!.execute({id:collected.id},signal);
 await tools.send_message!.execute({messages:['你好','再见','你好']},signal);await tools.send_message!.execute({messages:['你好']},signal);await expect(tools.send_poke!.execute({targetUserId:'99999'},signal)).rejects.toThrow('POKE_TARGET_DENIED');await tools.send_poke!.execute({},signal);expect(turn.output('重复的总结').filter(action=>!(action.kind==='message'&&action.stickerId))).toEqual([{kind:'message',parts:[{type:'text',data:{text:'你好'}}]},{kind:'message',parts:[{type:'text',data:{text:'再见'}}]},{kind:'poke',userId:'20002'}]);await expect(tools.skip_reply!.execute({},signal)).rejects.toThrow('REPLY_ALREADY_QUEUED');allowed=false;expect(()=>turn.output('')).toThrow('REVOKED');
 }finally{db.close();}
});

it('real DSH queues split messages and poke once, permits explicit silence and stops unknown delivery',async()=>{
 const p=paths(mkdtempSync(join(tmpdir(),'bff-source-tools-'))),model=await fixtureModel(),bot=await onebotFixture(),rt=await startRuntime(p);const call=<T>(route:string,method='GET',body?:unknown)=>requestRuntime<T>(rt.connection,route,method,body);
 const incoming=(id:string)=>({post_type:'message',message_type:'private',self_id:'10001',user_id:'20002',message_id:id,message:[{type:'text',data:{text:'你好'}}]});
 type Delivery={id:string;status:string;error:string};const done=(id:string)=>wait(()=>call<Delivery[]>('/v1/channels/qq/deliveries'),rows=>rows.some(r=>r.id===`10001:private:20002:${id}`&&!['queued','generating','sending'].includes(r.status)));
 try{
 await call('/v1/models','POST',{id:'fixture',provider:'openai',baseURL:model.url,model:'fixture'});await call('/v1/model-routes','PUT',{chat:'fixture'});await call('/v1/channels/qq','PUT',{url:bot.url,accountId:'10001',ownerId:'20002',friendIds:[],groups:[],enabled:true,replyEnabled:true,proactiveEnabled:false,token:'fixture-token',revision:''});await wait(()=>call<ChannelStatus>('/v1/channels/qq'),s=>s.health.state==='online');
 model.controls.replyTools=[{name:'send_message',args:{messages:['第一句','第二句']}},{name:'send_poke',args:{}}];bot.event(incoming('1'));const first=(await done('1')).find(r=>r.id==='10001:private:20002:1')!;expect(first.status,JSON.stringify({first,tools:model.requests.map(r=>r.body?.tools?.map((t:any)=>t.function.name)),requests:model.requests.map(r=>r.body?.messages?.at(-1))})).toBe('sent');const sent=bot.requests.filter(r=>r.action.startsWith('send_'));expect(sent.map(r=>r.action)).toEqual(['send_private_msg','send_private_msg','send_poke']);expect(sent[0]!.params.message).toEqual([{type:'text',data:{text:'第一句'}}]);expect(sent[2]!.params).toEqual({user_id:'20002'});
 // New request still calls the desired tool despite old tools in resumed history.
 model.controls.replyTools=[{name:'skip_reply',args:{}}];bot.event(incoming('2'));expect((await done('2')).find(r=>r.id==='10001:private:20002:2')!.status).toBe('skipped');expect(bot.requests.filter(r=>r.action.startsWith('send_'))).toHaveLength(3);
 model.controls.replyTools=[{name:'send_message',args:{messages:['不得发送']}},{name:'send_poke',args:{targetUserId:'99999'}}];bot.event(incoming('4'));expect((await done('4')).find(r=>r.id==='10001:private:20002:4')!.status).toBe('failed');expect(bot.requests.filter(r=>r.action.startsWith('send_'))).toHaveLength(3);
 const spy=vi.spyOn(DSHAdapter.prototype,'run').mockImplementation(async input=>{await input.tools!.find(t=>t.name==='send_message')!.execute({messages:['A','B']},input.signal);return '';});try{bot.controls.send='malformed';bot.event(incoming('3'));expect((await done('3')).find(r=>r.id==='10001:private:20002:3')!.status).toBe('unknown');expect(bot.requests.filter(r=>r.action.startsWith('send_'))).toHaveLength(4);}finally{spy.mockRestore();}
 }finally{await rt.stop();await model.close();await bot.close();rmSync(p.root,{recursive:true,force:true});}
},60000);
