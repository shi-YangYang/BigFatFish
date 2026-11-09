import {it,expect,vi} from 'vitest';
import {Plugins} from '../../apps/runtime/src/plugins/service.js';
import {QQClient} from '../../apps/runtime/src/channels/onebot/client.js';
import {mkdtempSync,mkdirSync,writeFileSync,existsSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {paths,preparePaths} from '../../apps/runtime/src/paths.js';
import {openDatabase} from '../../apps/runtime/src/storage/database.js';
import {Configuration} from '../../apps/runtime/src/ai/configuration.js';
import {startRuntime} from '../../apps/runtime/src/lifecycle.js';
import {requestRuntime} from '../../apps/runtime/src/connection.js';
import {exportArchive,restoreArchive} from '../../apps/runtime/src/maintenance/archive.js';
import {hash,type Bundle} from '../../apps/runtime/src/plugins/package.js';
import type {ChannelStatus} from '../../apps/runtime/src/channels/types.js';
import {onebotFixture} from '../fixtures/onebot.js';
const wait=async(check:()=>Promise<boolean>)=>{for(let n=0;n<150;n++){if(await check())return;await delay(20);}throw new Error('WAIT_TIMEOUT');};
const legacyBundle=():Bundle=>({format:'bigfatfish-plugin',manifest:{protocol:1,id:'qq',name:'QQ',version:'0.1.0',author:'fixture',license:'MIT',source:'fixture',runtime:'^0.1.0',platforms:[process.platform],kind:'platform',permissions:['channel.qq'],entry:'index.mjs',dependencies:[],extensions:['Channel'],configSchema:{type:'object',properties:{}},tools:[]},files:[{path:'index.mjs',data:Buffer.from('throw Error("OLD_CODE_EXECUTED")').toString('base64'),sha256:hash('throw Error("OLD_CODE_EXECUTED")')}]});

it.each(['absent','enabled','disabled','removed','revoked','malformed'] as const)('owns QQ without executing legacy %s code and transfers stop intent once',async mode=>{
 const p=paths(mkdtempSync(join(tmpdir(),'bff-builtin-qq-'))),bot=await onebotFixture();preparePaths(p);
 const db=openDatabase(p.database),config=new Configuration(db,p),secret=config.encryptSecret(bot.controls.token),directory=join(p.data,'plugins','qq','old'),marker=join(directory,'executed');mkdirSync(directory,{recursive:true});writeFileSync(join(directory,'index.mjs'),`import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(marker)},'bad');throw Error('OLD_CODE_EXECUTED');`);
 const saved={url:new URL(bot.url).href,accountId:'10001',ownerId:'20002',friendIds:['20003'],groups:['40004'],enabled:true,replyEnabled:true,proactiveEnabled:true};
 db.prepare("INSERT INTO plugin_config VALUES('qq',?,?,?)").run(JSON.stringify(saved),secret,'original');
 const state={manifest:legacyBundle().manifest,directory,enabled:mode!=='disabled',installed:mode!=='removed',granted:mode==='revoked'?[]:['channel.qq'],config:{},storage:{},generation:'old'};
 if(mode!=='absent')db.prepare("INSERT INTO plugin_config VALUES('sdk:qq',?,NULL,'old')").run(mode==='malformed'?'{':JSON.stringify(state));
 db.close();let runtime=await startRuntime(p);
 const call=<T>(url:string,method='GET',body?:unknown)=>requestRuntime<T>(runtime.connection,url,method,body);
 try{
  expect((await call<{id:string}[]>('/v1/plugins')).some(p=>p.id==='qq')).toBe(false);
  const initial=await call<ChannelStatus>('/v1/channels/qq'),enabled=mode==='enabled'||mode==='absent';
  expect(initial).toMatchObject({builtin:true,hasToken:true,config:{...saved,enabled}});
  if(enabled)await wait(async()=>(await call<ChannelStatus>('/v1/channels/qq')).health.state==='online');else {expect(initial.health.state).toBe('stopped');expect(bot.requests).toHaveLength(0);}
  for(const route of ['inspect','install','update'])await expect(call('/v1/plugins/'+route,'POST',legacyBundle())).rejects.toThrow('QQ_BUILTIN');
  for(const route of ['enable','disable','call'])await expect(call('/v1/plugins/qq/'+route,'POST',{granted:['channel.qq'],config:{},name:'bad'})).rejects.toThrow('QQ_BUILTIN');
  await expect(call('/v1/plugins/qq','DELETE')).rejects.toThrow('QQ_BUILTIN');
  await call('/v1/channels/qq/start','POST');await wait(async()=>(await call<ChannelStatus>('/v1/channels/qq')).health.state==='online');
  expect(await call('/v1/channels/qq/send','POST',{target:{kind:'private',id:'20002'},segments:[{type:'text',data:{text:'内置链路'}}]})).toMatchObject({status:'sent'});
  await runtime.stop();const persisted=openDatabase(p.database);expect(persisted.prepare("SELECT secret FROM plugin_config WHERE id='qq'").get()?.secret).toBe(secret);persisted.close();
  runtime=await startRuntime(p);await wait(async()=>(await call<ChannelStatus>('/v1/channels/qq')).health.state==='online');
  expect(existsSync(marker)).toBe(false);expect(readFileSync(join(directory,'index.mjs'),'utf8')).toContain('OLD_CODE_EXECUTED');
  if(mode==='enabled'){
   await runtime.stop();const archive=join(p.root,'old-config.bff');await exportArchive(p,archive,{scopes:['plugins']});await restoreArchive(p,archive);runtime=await startRuntime(p);
   expect(await call('/v1/channels/qq')).toMatchObject({builtin:true,config:{...saved,enabled:false},health:{state:'stopped'}});expect((await call<{id:string}[]>('/v1/plugins')).some(p=>p.id==='qq')).toBe(false);
  }
 }finally{await runtime.stop();await bot.close();rmSync(p.root,{recursive:true,force:true});}
},15000);

it('reads media bytes through the built-in client and revokes pending reads',async()=>{
 const bot=await onebotFixture(),client=new QQClient();let revoked=false;
 const guard=()=>{if(revoked)throw new Error('REVOKED');};
 client.initialize({event:()=>{},status:()=>{}});client.start({url:bot.url,token:bot.controls.token,accountId:'10001',ownerId:'20002',groups:[],enabled:true,replyEnabled:true,proactiveEnabled:false});
 try{
  await wait(async()=>client.health().state==='online');bot.controls.inlineMedia=true;bot.controls.media=Buffer.from('fixture-bytes').toString('base64');
  expect(await client.media('image','a'.repeat(32),guard)).toBe(bot.controls.media);
  expect(await client.media('record','a'.repeat(32),guard)).toBe(bot.controls.media);
  expect(bot.requests.find(r=>r.action==='get_record')?.params).toEqual({file:'a'.repeat(32),out_format:'wav'});
  const gate=bot.pauseNextMedia(),pending=client.media('image','a'.repeat(32),guard);await gate.reached;revoked=true;gate.release();await expect(pending).rejects.toThrow('REVOKED');
  await expect(client.media('image','/etc/passwd',()=>{})).rejects.toThrow('MEDIA_REFERENCE_UNSUPPORTED');
 }finally{client.dispose();await bot.close();}
});

it('revokes built-in QQ immediately while unrelated extension shutdown is blocked',async()=>{
 const p=paths(mkdtempSync(join(tmpdir(),'bff-qq-shutdown-'))),bot=await onebotFixture(),runtime=await startRuntime(p);
 const call=<T>(url:string,method='GET',body?:unknown)=>requestRuntime<T>(runtime.connection,url,method,body);
 let release!:()=>void,entered!:()=>void;
 const blocked=new Promise<void>(r=>{release=r;}),reached=new Promise<void>(r=>{entered=r;});
 const original=Plugins.prototype.close;
 const closingExtension=vi.spyOn(Plugins.prototype,'close').mockImplementation(async function(this:Plugins){entered();await blocked;await original.call(this);});
 try{
  await call('/v1/channels/qq','PUT',{url:bot.url,token:bot.controls.token,accountId:'10001',ownerId:'20002',groups:[],enabled:true,replyEnabled:true,proactiveEnabled:true,revision:''});
  await wait(async()=>(await call<ChannelStatus>('/v1/channels/qq')).health.state==='online');
  const gate=bot.pauseNextLogin(),body={target:{kind:'private',id:'20002'},segments:[{type:'text',data:{text:'must not send'}}]};
  const pending=call('/v1/channels/qq/send','POST',body);await gate.reached;
  const stopping=runtime.stop();await reached;
  expect((await call<ChannelStatus>('/v1/channels/qq')).health.state).toBe('stopped');
  await expect(call('/v1/channels/qq/send','POST',body)).rejects.toThrow('PERMISSION_REVOKED');
  await expect(call('/v1/channels/qq/start','POST')).rejects.toThrow('RUNTIME_STOPPING');
  gate.release();await pending;expect(bot.requests.filter(r=>r.action.startsWith('send_'))).toHaveLength(0);
  release();await stopping;
 }finally{release();closingExtension.mockRestore();await runtime.stop();await bot.close();rmSync(p.root,{recursive:true,force:true});}
},10000);
