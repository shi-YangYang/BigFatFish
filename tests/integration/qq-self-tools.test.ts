import {it,expect} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {WebSocketServer} from 'ws';
import {migrate,openDatabase} from '../../apps/runtime/src/storage/database.js';
import {loadQQ} from '../../apps/runtime/src/channels/plugin.js';
import {QQActionState} from '../../apps/runtime/src/channels/action-state.js';
import {interactionTools} from '../../apps/runtime/src/channels/interaction-tools.js';
import {selfTools} from '../../apps/runtime/src/channels/self-tools.js';
import {QQAutonomy} from '../../apps/runtime/src/channels/autonomy.js';
import {StickerLibrary} from '../../apps/runtime/src/channels/stickers.js';
import {paths,preparePaths} from '../../apps/runtime/src/paths.js';
import {ChatService} from '../../apps/runtime/src/ai/chat.js';
import {exportArchive,restoreArchive} from '../../apps/runtime/src/maintenance/archive.js';
import {fixtureModel} from '../fixtures/model.mjs';
const signal=new AbortController().signal;
const wait=async(test:()=>boolean)=>{for(let n=0;n<300;n++){if(test())return;await new Promise(r=>setTimeout(r,10));}throw new Error('WAIT_TIMEOUT');};
async function bot(){const server=new WebSocketServer({host:'127.0.0.1',port:0});await new Promise<void>(r=>server.once('listening',r));const requests:{action:string;params:Record<string,unknown>}[]=[];const control={reactionReject:false,post:'ok',profileMismatch:false,preflight:undefined as (()=>void)|undefined};let nickname='鱼',signature='原签名',space={name:'空间',description:'简介'};
 server.on('connection',ws=>ws.on('message',raw=>{const b=JSON.parse(String(raw));requests.push(b);let data:unknown=null;
 if(b.action==='set_msg_emoji_like')data={result:!control.reactionReject};
 if(b.action==='get_login_info')data={user_id:10001,nickname};
 if(b.action==='get_status'){control.preflight?.();data={online:true};}
 if(b.action==='get_version_info')data={app_name:'NapCat',app_version:'4.18.42'};
 if(b.action==='get_stranger_info')data={user_id:10001,nickname,long_nick:signature,email:'PRIVATE_EMAIL'};
 if(b.action==='set_qq_profile'){if(!control.profileMismatch){nickname=b.params.nickname;signature=b.params.personal_note;}data={result:0};}
 if(b.action==='get_friend_msg_history')data={messages:[{message_id:9,user_id:10001,sender:{user_id:10001},message:[{type:'text',data:{text:'鱼发的消息'}}]},{message_id:8,user_id:20002,sender:{user_id:20002},message:'主人消息'}]};
 if(b.action==='get_msg')data={message_id:b.params.message_id,user_id:b.params.message_id==='8'?20002:b.params.message_id==='777'?30003:10001,sender:{user_id:10001},message:'原文'};
 if(b.action==='send_qzone_msg')data=control.post==='ok'?{tid:'tid-'+requests.length,time:1}:{};
 if(b.action==='get_qzone_msg_list')data={total:2,msglist:[{tid:'private',content:'PRIVATE_OLD_POST',is_private:true,comments:['PRIVATE_COMMENT']},{tid:'unknown-scope',content:'UNKNOWN_SCOPE_OLD_POST',is_private:false}]};
 if(b.action==='get_qzone_profile')data=space;if(b.action==='set_qzone_profile')space={...space,...b.params};
 ws.send(JSON.stringify({status:'ok',retcode:0,echo:b.echo,data}));}));
 const loaded=await loadQQ(resolve('plugins/qq'));loaded.plugin.initialize({event:()=>{},status:()=>{}});loaded.plugin.start({url:`ws://127.0.0.1:${(server.address() as {port:number}).port}`,accountId:'10001',ownerId:'20002',groups:['40004'],enabled:true,replyEnabled:true,proactiveEnabled:false,token:''});await wait(()=>loaded.plugin.health().state==='online');
 return {plugin:loaded.plugin,requests,control,url:`ws://127.0.0.1:${(server.address() as {port:number}).port}`,event:(value:unknown)=>{for(const ws of server.clients)ws.send(JSON.stringify(value));},close:async()=>{loaded.plugin.dispose();for(const client of server.clients)client.terminate();await new Promise<void>(r=>server.close(()=>r()));}};}

it('binds real OneBot interactions to the current chat, own messages and private image evidence',async()=>{
 const b=await bot(),db=new DatabaseSync(':memory:');migrate(db);const state=new QQActionState(db),library=new StickerLibrary(db);await library.initialize();let revoked=false;const guard=()=>{if(revoked)throw new Error('PERMISSION_REVOKED');};
 const tools=Object.fromEntries(interactionTools(db,b.plugin,state,'10001',{kind:'private',id:'20002'},'20002','1','777',guard).map(t=>[t.name,t]));
 try{await tools.get_recent_messages!.execute({},signal);expect(b.requests.find(r=>r.action==='get_friend_msg_history')?.params).toMatchObject({user_id:'20002',count:20,disable_get_url:true});await expect(tools.get_message!.execute({id:'777'},signal)).rejects.toThrow('QQ_MESSAGE_SCOPE');await expect(tools.get_message!.execute({id:'555'},signal)).rejects.toThrow('QQ_MESSAGE_SCOPE');await expect(tools.recall_message!.execute({id:'8'},signal)).rejects.toThrow('QQ_RECALL_NOT_OWN');await tools.recall_message!.execute({id:'9'},signal);await tools.recall_message!.execute({id:'9'},signal);expect(b.requests.filter(r=>r.action==='delete_msg')).toHaveLength(1);await tools.send_like!.execute({},signal);await tools.set_message_reaction!.execute({id:'8',emojiId:'76'},signal);expect(b.requests.find(r=>r.action==='send_like')?.params).toEqual({user_id:'20002',times:1});
 const own=Object.fromEntries(selfTools('owner',b.plugin,state,state.options('10001'),library,guard).map(t=>[t.name,t]));expect(JSON.stringify(await own.get_qq_profile!.execute({},signal))).not.toContain('PRIVATE_EMAIL');await own.set_qq_profile!.execute({nickname:'新鱼'},signal);expect(b.requests.find(r=>r.action==='set_qq_profile')?.params).toEqual({nickname:'新鱼',personal_note:'原签名'});await expect(own.set_qq_avatar!.execute({image:'file:///secret'},signal)).rejects.toThrow('STICKER_VIEW_REQUIRED');const image=await own.get_avatar_image!.execute({id:'builtin-hello'},signal);await expect(own.set_qq_avatar!.execute({image:'builtin-hello'},signal)).rejects.toThrow('STICKER_VIEW_REQUIRED');own.get_avatar_image!.onImageResult!(image,true);await own.set_qq_avatar!.execute({image:'builtin-hello'},signal);expect(b.requests.find(r=>r.action==='set_qq_avatar')?.params.file).toMatch(/^base64:\/\//);await own.publish_qzone_post!.execute({content:'今天也在摇尾巴',image:'builtin-hello'},signal);expect(b.requests.find(r=>r.action==='send_qzone_msg')?.params.ugc_right).toBe(4);
 b.control.post='missing';await expect(own.publish_qzone_post!.execute({content:'回执缺失'},signal)).rejects.toThrow('QQ_POST_UNCONFIRMED');const sends=b.requests.filter(r=>r.action==='send_qzone_msg').length;await expect(own.publish_qzone_post!.execute({content:'回执缺失'},signal)).rejects.toThrow('QQ_POST_UNCONFIRMED');expect(b.requests.filter(r=>r.action==='send_qzone_msg')).toHaveLength(sends);expect(state.issues()[0]?.status).toBe('unknown');
 const group=Object.fromEntries(interactionTools(db,b.plugin,state,'10001',{kind:'group',id:'40004'},'20002','10',undefined,guard).map(t=>[t.name,t]));for(const card of ['A','A','B','A'])await group.set_group_card!.execute({card},signal);expect(b.requests.filter(r=>r.action==='set_group_card').map(r=>r.params.card)).toEqual(['A','B','A']);
 b.control.reactionReject=true;await expect(tools.set_message_reaction!.execute({id:'8',emojiId:'78'},signal)).rejects.toThrow('ACTION_REJECTED');
 b.control.preflight=()=>{revoked=true;};const before=b.requests.filter(r=>r.action==='set_msg_emoji_like').length;await expect(tools.set_message_reaction!.execute({id:'8',emojiId:'77'},signal)).rejects.toThrow();expect(b.requests.filter(r=>r.action==='set_msg_emoji_like')).toHaveLength(before);
 }finally{db.close();await b.close();}
},15000);

it('persists unknown writes, allows A-B-A changes, bounds autonomous decisions and cancels before writes',async()=>{
 const db=new DatabaseSync(':memory:');migrate(db);let now=new Date(2026,10,7,1).getTime(),count=0;const state=new QQActionState(db,()=>now);const write=(v:string)=>state.write('10001','group_card',{card:v},'group:1',3,()=>{},async()=>({v,n:++count}));
 try{await write('A');await write('B');await write('A');expect(count).toBe(3);await expect(write('C')).rejects.toThrow('QQ_ACTION_DAILY_LIMIT');await expect(state.write('10001','post','x','self',2,()=>{},async()=>{throw new Error('SEND_UNKNOWN');})).rejects.toThrow();const restarted=new QQActionState(db,()=>now);await expect(restarted.write('10001','post','x','self',2,()=>{},async()=>{count++;})).rejects.toThrow('QQ_ACTION_UNCONFIRMED');expect(count).toBe(3);
 let decisions=0;const auto=new QQAutonomy(state,()=>({accountId:'10001',options:state.options('10001'),guard:()=>{},run:async()=>{decisions++;}}));await auto.tick();for(let i=0;i<7;i++){now+=3600000;await auto.tick();}expect(decisions).toBe(6);const current=decisions;db.prepare("INSERT INTO settings VALUES('activities.paused','true')").run();now+=3600000;await auto.tick();expect(decisions).toBe(current);await auto.close();
 let release!:()=>void,wrote=false;db.prepare("DELETE FROM settings WHERE key='activities.paused'").run();db.prepare('DELETE FROM qq_self_clock').run();const pending=new QQAutonomy(state,()=>({accountId:'10001',options:state.options('10001'),guard:()=>{},run:async s=>{await new Promise<void>(r=>{release=r;});s.throwIfAborted();wrote=true;}}));await pending.tick();now+=3600000;const running=pending.tick();await Promise.resolve();pending.cancel();release();await running;expect(wrote).toBe(false);await pending.close();
 }finally{db.close();}
});

it('runs real DSH autonomous tools without old post bodies, retains owner reads, and pauses restored options',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff-self-tools-')),p=paths(join(root,'source'));preparePaths(p);const db=openDatabase(p.database),model=await fixtureModel(),b=await bot(),chat=new ChatService(db,p),library=new StickerLibrary(db);await library.initialize();const state=new QQActionState(db);const autonomous=selfTools('autonomous',b.plugin,state,state.options('10001'),library,()=>{});
 try{chat.config.saveModel({id:'fixture',provider:'openai',baseURL:model.url,model:'fixture'});chat.config.saveRoutes({chat:'fixture'});db.prepare("INSERT INTO daily_diaries VALUES('private','2026-01-01','UTC','PRIVATE_DIARY','[]',1,'fixture','now','ready')").run();expect(autonomous.map(t=>t.name)).not.toContain('get_qzone_posts');
 model.controls.replyTools=[{name:'get_qq_profile',args:{}},{name:'publish_qzone_post',args:{content:'这是一条隔离测试动态'}}];await chat.liveQQ(autonomous,signal);
 expect(b.requests.find(r=>r.action==='send_qzone_msg')?.params.ugc_right).toBe(4);
 expect(b.requests.filter(r=>r.action==='get_qzone_msg_list')).toHaveLength(0);
 expect(model.requests.length).toBeGreaterThan(1);
 for(const request of model.requests){const names=request.body.tools.map((t:{function:{name:string}})=>t.function.name);expect(names).not.toContain('get_qzone_posts');expect(names).toContain('publish_qzone_post');}
 const sent=JSON.stringify(model.requests);for(const marker of ['PRIVATE_OLD_POST','UNKNOWN_SCOPE_OLD_POST','PRIVATE_DIARY','PRIVATE_COMMENT','PRIVATE_EMAIL'])expect(sent).not.toContain(marker);
 const owner=selfTools('owner',b.plugin,state,state.options('10001'),library,()=>{}),readPosts=owner.find(t=>t.name==='get_qzone_posts');expect(readPosts).toBeDefined();
 const posts=await readPosts!.execute({},signal);expect(posts).toMatchObject([{id:'private',content:'PRIVATE_OLD_POST'},{id:'unknown-scope',content:'UNKNOWN_SCOPE_OLD_POST'}]);expect(JSON.stringify(posts)).not.toContain('PRIVATE_COMMENT');
 expect(b.requests.filter(r=>r.action==='get_qzone_msg_list')).toHaveLength(1);expect(b.requests.find(r=>r.action==='get_qzone_msg_list')?.params).toEqual({target_uin:'10001',pos:0,num:10});
 state.save('10001',{...state.options('10001'),profile:true,posts:true});await chat.close();db.close();const file=join(root,'archive.json');await exportArchive(p,file,{scopes:['plugins']});const q=paths(join(root,'restored'));await restoreArchive(q,file);const restored=openDatabase(q.database);const options=new QQActionState(restored).options('10001');expect(options).toMatchObject({profile:false,posts:false});expect(new QQActionState(restored).options('99999').posts).toBe(false);restored.close();
 const envelope=JSON.parse(readFileSync(file,'utf8')),payload=JSON.parse(Buffer.from(envelope.files[0].content,'base64').toString());payload.schema=13;delete payload.tables.qq_self_options;delete payload.tables.qq_operations;const bytes=Buffer.from(JSON.stringify(payload));envelope.files[0]={path:'data.json',size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),content:bytes.toString('base64')};const legacy=join(root,'legacy.json');writeFileSync(legacy,JSON.stringify(envelope));const r=paths(join(root,'old'));await restoreArchive(r,legacy);const legacyDb=openDatabase(r.database);expect(new QQActionState(legacyDb).options('10001').profile).toBe(false);legacyDb.close();
 }finally{try{await chat.close();}catch{}try{db.close();}catch{}await b.close();await model.close();rmSync(root,{recursive:true,force:true});}
},20000);


it('registers global tools only for the verified owner and triggers autonomous work through the running Runtime',async()=>{
 const {startRuntime}=await import('../../apps/runtime/src/lifecycle.js'),{requestRuntime}=await import('../../apps/runtime/src/connection.js');
 const p=paths(mkdtempSync(join(tmpdir(),'bff-self-runtime-'))),model=await fixtureModel(),b=await bot(),runtime=await startRuntime(p),db=new DatabaseSync(p.database);
 const call=<T>(url:string,method='GET',body?:unknown)=>requestRuntime<T>(runtime.connection,url,method,body);
 try{await call('/v1/models','POST',{id:'fixture',provider:'openai',baseURL:model.url,model:'fixture'});await call('/v1/model-routes','PUT',{chat:'fixture'});await call('/v1/channels/qq','PUT',{url:b.url,accountId:'10001',ownerId:'20002',friendIds:['30003'],groups:['40004'],enabled:true,replyEnabled:true,proactiveEnabled:false,revision:''});await wait(()=>db.prepare("SELECT config FROM plugin_config WHERE id='qq'").get()!==undefined);await new Promise(r=>setTimeout(r,50));
 model.controls.replyTools=[{name:'skip_reply',args:{}}];
 for(const [id,user,group] of [['1','20002',false],['2','30003',false],['3','20002',true]] as const){b.event({post_type:'message',message_type:group?'group':'private',self_id:'10001',user_id:user,...(group?{group_id:'40004'}:{}),message_id:id,message:[{type:'text',data:{text:'TOOLS_REGISTRATION_'+id}}]});await wait(()=>!!db.prepare("SELECT 1 FROM channel_deliveries WHERE id=? AND status NOT IN ('queued','generating','sending')").get(`10001:${group?'group:40004':'private:'+user}:${id}`));const request=model.requests.find(r=>r.body?.messages?.some((m:{role:string;content:unknown})=>m.role==='user'&&JSON.stringify(m.content).includes('TOOLS_REGISTRATION_'+id)));const names=request?.body.tools.map((t:{function:{name:string}})=>t.function.name);expect(names).toContain('get_recent_messages');expect(names.includes('publish_qzone_post')).toBe(id==='1');expect(names.includes('set_group_card')).toBe(group);}
 // Advance the persisted due slot, while retaining the production 30-second timer.
 model.controls.replyTools=[{name:'publish_qzone_post',args:{content:'由后台自主触发的隔离动态'}}];db.prepare("INSERT INTO qq_self_clock VALUES('10001',0,'2000-01-01',0) ON CONFLICT(account_id) DO UPDATE SET next_at=0").run();
 for(let i=0;i<350;i++){if(b.requests.some(r=>r.action==='send_qzone_msg'))break;await new Promise(r=>setTimeout(r,100));}expect(b.requests.some(r=>r.action==='send_qzone_msg')).toBe(true);const opts=await call<Record<string,unknown>>('/v1/channels/qq/self-options');await call('/v1/channels/qq/self-options','PUT',{...opts,profile:false,posts:false});expect(await call('/v1/channels/qq/self-options')).toMatchObject({profile:false,posts:false});
 }finally{db.close();await runtime.stop();await b.close();await model.close();rmSync(p.root,{recursive:true,force:true});}
},45000);
