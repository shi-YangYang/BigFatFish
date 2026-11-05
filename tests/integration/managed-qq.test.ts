import { afterEach,expect,it,vi } from 'vitest';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { createHash } from 'node:crypto';
import { mkdtempSync,readFileSync,rmSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { paths } from '../../apps/runtime/src/paths.js';
import { startRuntime } from '../../apps/runtime/src/lifecycle.js';
import { requestRuntime } from '../../apps/runtime/src/connection.js';
import { ComponentPlatform } from '../../apps/runtime/src/channels/managed/platform.js';
import { NapCatClient } from '../../apps/runtime/src/channels/managed/client.js';
import type { ManagedState,ManagedQQStatus } from '../../apps/runtime/src/channels/managed/types.js';
import type { ChannelStatus } from '../../apps/runtime/src/channels/types.js';
const until=async<T>(read:()=>Promise<T>,test:(value:T)=>boolean)=>{let value=await read();for(let i=0;i<100&&!test(value);i++){await delay(50);value=await read();}expect(test(value),JSON.stringify(value)).toBe(true);return value;};
afterEach(()=>vi.restoreAllMocks());
it('WebUI authenticates and renews once, rejects logical failures without leaking upstream text',async()=>{
 let logins=0,calls=0;const server=createServer(async(req,res)=>{let data='';for await(const chunk of req)data+=chunk;res.setHeader('Content-Type','application/json');
  if(req.url==='/api/auth/login'){expect(JSON.parse(data).hash).toBe(createHash('sha256').update('test-token.napcat').digest('hex'));res.end(JSON.stringify({code:0,data:{Credential:`credential-${++logins}`}}));}
  else{calls++;expect(req.headers.authorization).toBe(`Bearer credential-${logins}`);res.end(JSON.stringify(calls===1?{code:-1,message:'Unauthorized'}:calls===2?{code:0,data:{isLogin:false}}:{code:-1,message:'private-upstream-token'}));}
 });await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 try{const client=new NapCatClient((server.address() as {port:number}).port,'test-token');expect(await client.call('QQLogin/CheckLoginStatus')).toEqual({isLogin:false});expect(logins).toBe(2);await expect(client.call('QQLogin/CheckLoginStatus')).rejects.toThrow('QQ_COMPONENT_REQUEST_FAILED');expect(logins).toBe(2);}finally{await new Promise<void>(r=>server.close(()=>r()));}
});
it('one-action connection prepares, logs in and resumes only the saved account and revision through real Runtime API',async()=>{
 const p=paths(mkdtempSync(join(tmpdir(),'bff-managed-qq-')));let account='',server:ReturnType<typeof createServer>|undefined,ws:WebSocketServer|undefined;let state:ManagedState|undefined;const calls:string[]=[];let statusGate:Promise<void>|undefined,statusRequested:(()=>void)|undefined;
 const install=vi.spyOn(ComponentPlatform.prototype,'install').mockRejectedValueOnce(new Error('fixture download unavailable')).mockImplementation(async()=>{await delay(20);});
 vi.spyOn(ComponentPlatform.prototype,'check').mockResolvedValue();
 vi.spyOn(ComponentPlatform.prototype,'start').mockImplementation(async function(this:ComponentPlatform){
  state=JSON.parse(readFileSync(join(this.directory,'manager.json'),'utf8'));
  expect(JSON.parse(readFileSync(join(this.directory,'work','config','onebot11.json'),'utf8')).enableLocalFile2Url).toBe(true);
  server=createServer(async(req,res)=>{let data='';for await(const chunk of req)data+=chunk;res.setHeader('Content-Type','application/json');
   if(req.url==='/api/auth/login'){expect(JSON.parse(data).hash).toBe(createHash('sha256').update(state!.webToken+'.napcat').digest('hex'));res.end(JSON.stringify({code:0,data:{Credential:'fixture-credential'}}));return;}
   expect(req.headers.authorization).toBe('Bearer fixture-credential');let result:unknown={};
   if(req.url?.endsWith('CheckLoginStatus'))result={isLogin:!!account,coreReady:!!account,loginPhase:'qrcode',qrcodeurl:'https://example.invalid/fixture-qr'};
   if(req.url?.endsWith('GetQQLoginInfo'))result={uin:account,nick:'测试QQ',online:true};
   if(req.url?.endsWith('SetConfig')){const config=JSON.parse(JSON.parse(data).config);expect(config.network.websocketServers[0].token).toBe(state!.botToken);expect(config.network.websocketClients).toEqual([]);expect(config.enableLocalFile2Url).toBe(true);}
   res.end(JSON.stringify({code:0,data:result}));
  });await new Promise<void>(r=>server!.listen(state!.webPort,'127.0.0.1',r));
  ws=new WebSocketServer({port:state!.botPort,host:'127.0.0.1'});await new Promise<void>(r=>ws!.once('listening',r));
  ws.on('connection',(socket,req)=>{expect(req.headers.authorization).toBe(`Bearer ${state!.botToken}`);socket.on('message',async raw=>{const request=JSON.parse(raw.toString());calls.push(request.action);if(request.action==='get_status'&&statusGate){statusRequested?.();await statusGate;}const data=request.action==='get_login_info'?{user_id:account}:request.action==='get_status'?{online:true}:request.action==='get_friend_list'?[{user_id:'20002',nickname:'主人'}]:request.action==='get_group_list'?[{group_id:'30003',group_name:'测试群'}]:{};socket.send(JSON.stringify({echo:request.echo,status:'ok',retcode:0,data}));});});
 });
 const stop=vi.spyOn(ComponentPlatform.prototype,'stop').mockImplementation(async()=>{if(ws){for(const client of ws.clients)client.terminate();await new Promise<void>(r=>ws!.close(()=>r()));ws=undefined;}if(server){await new Promise<void>(r=>server!.close(()=>r()));server=undefined;}});
 const runtime=await startRuntime(p);const call=<T>(route:string,method='GET',body?:unknown)=>requestRuntime<T>(runtime.connection,route,method,body),base='/v1/channels/qq/component',status=()=>call<ManagedQQStatus>(base);
 try{
  expect((await status()).phase).toBe('missing');await call(base+'/connect','POST');await until(status,s=>s.phase==='error'&&!s.busy);
  await call(base+'/connect','POST');const qr=await until(status,s=>s.phase==='login'&&!s.busy);expect(qr.qr).toMatch(/^data:image\/png;base64,/);expect(JSON.stringify(qr)).not.toContain(state!.webToken);expect((await call<ChannelStatus>('/v1/channels/qq')).config).toBeNull();
  expect(install).toHaveBeenCalledTimes(2);account='10001';await call(base+'/refresh','POST');await until(status,s=>s.phase==='online'&&!s.busy);const list=await call<{friends:unknown[];groups:unknown[]}>(base+'/contacts');expect(list.friends).toHaveLength(1);expect(list.groups).toHaveLength(1);
  const settings={accountId:account,ownerId:'20002',friendIds:['20003'],groupReplyMode:'all',groups:['30003'],replyEnabled:true,proactiveEnabled:false,revision:''};
  await expect(call(base+'/settings','PUT',{...settings,accountId:'99999'})).rejects.toThrow('QQ_ACCOUNT_CHANGED');
  await expect(call(base+'/settings','PUT',{...settings,ownerId:account})).rejects.toThrow('QQ_OWNER_IS_BOT');
  // Pause a first-time asynchronous save before health verification completes.
  let releaseStatus!:()=>void;statusGate=new Promise<void>(resolve=>{releaseStatus=resolve;});const enteredStatus=new Promise<void>(resolve=>{statusRequested=resolve;});
  await call(base+'/settings','PUT',settings);await enteredStatus;await call('/v1/channels/qq/stop','POST');releaseStatus();statusGate=undefined;
  await until(status,s=>!s.busy);expect((await call<ChannelStatus>('/v1/channels/qq')).config).toBeNull();expect((await status()).operationError).toBe('CANCELLED');
  await call(base+'/connect','POST');await until(status,s=>s.phase==='online'&&!s.busy);
  await call(base+'/settings','PUT',settings);await until(status,s=>!s.busy);const channel=await call<ChannelStatus>('/v1/channels/qq');expect(channel.config).toMatchObject({mode:'managed',accountId:'10001',ownerId:'20002',friendIds:['20003'],groupReplyMode:'all',groups:['30003'],enabled:true});expect(JSON.stringify(channel)).not.toContain(state!.botToken);
  await expect(call(base+'/settings','PUT',settings)).rejects.toThrow('CHANNEL_VERSION_CONFLICT');
  await expect(call('/v1/channels/qq','PUT',{...channel.config,revision:channel.revision})).rejects.toThrow('QQ_MANAGED_CONFIGURATION_REQUIRED');
  // An already logged-in paused account reconnects without a second settings save.
  await call('/v1/channels/qq/stop','POST');await call(base+'/connect','POST');await until(status,s=>s.phase==='online'&&!s.busy);
  expect((await call<ChannelStatus>('/v1/channels/qq')).config?.enabled).toBe(true);
  // Explicit pause while waiting for QR revokes pending automatic activation, even if already disabled.
  await call(base+'/stop','POST');await until(status,s=>s.phase==='ready'&&!s.busy);account='';
  await call(base+'/connect','POST');await until(status,s=>s.phase==='login'&&!s.busy);await call('/v1/channels/qq/stop','POST');
  account='10001';await call(base+'/refresh','POST');await until(status,s=>s.phase==='online'&&!s.busy);
  expect((await call<ChannelStatus>('/v1/channels/qq')).config?.enabled).toBe(false);
  await call(base+'/connect','POST');await until(status,s=>s.phase==='online'&&!s.busy);
  expect((await call<ChannelStatus>('/v1/channels/qq')).config?.enabled).toBe(true);
  // A replacement configuration during QR must not be overwritten by a late login.
  await call(base+'/stop','POST');await until(status,s=>s.phase==='ready'&&!s.busy);account='';
  await call(base+'/connect','POST');await until(status,s=>s.phase==='login'&&!s.busy);
  const beforeReplacement=await call<ChannelStatus>('/v1/channels/qq');
  await call('/v1/channels/qq','PUT',{...beforeReplacement.config,mode:'external',enabled:true,revision:beforeReplacement.revision});
  await expect(call(base+'/connect','POST')).rejects.toThrow('QQ_EXTERNAL_ACTIVE');
  account='10001';await call(base+'/refresh','POST');await until(status,s=>s.phase==='online'&&!s.busy);
  const replacement=await call<ChannelStatus>('/v1/channels/qq');expect(replacement.config?.mode).toBe('external');
  await call('/v1/channels/qq/stop','POST');
  const stopped=await call<ChannelStatus>('/v1/channels/qq');await call(base+'/settings','PUT',{...settings,revision:stopped.revision});await until(status,s=>!s.busy);
  account='40004';await call(base+'/refresh','POST');await until(status,s=>s.account?.id==='40004'&&!s.busy);expect((await call<ChannelStatus>('/v1/channels/qq')).config?.enabled).toBe(false);
  expect(calls.some(x=>x.startsWith('send_'))).toBe(false);
  await call(base+'/stop','POST');await until(status,s=>s.phase==='ready'&&!s.busy);expect(stop).toHaveBeenCalled();account='10001';await call('/v1/channels/qq/start','POST');await until(status,s=>s.phase==='online'&&!s.busy);expect((await call<ChannelStatus>('/v1/channels/qq')).config?.enabled).toBe(true);expect((await call<{state:string}>('/v1/status')).state).toBe('running');
 }finally{await runtime.stop();rmSync(p.root,{recursive:true,force:true});}
},25000);
it('stop cancels a pending install without late success and invalid component state does not prevent local Runtime',async()=>{
 const p=paths(mkdtempSync(join(tmpdir(),'bff-managed-cancel-')));vi.spyOn(ComponentPlatform.prototype,'install').mockImplementation(async signal=>{await delay(10000,undefined,{signal});});vi.spyOn(ComponentPlatform.prototype,'stop').mockResolvedValue();const start=vi.spyOn(ComponentPlatform.prototype,'start').mockResolvedValue();
 let runtime=await startRuntime(p);
 try{let call=<T>(route:string,method='GET')=>requestRuntime<T>(runtime.connection,route,method);const base='/v1/channels/qq/component';await call(base+'/connect','POST');await expect(call(base+'/connect','POST')).rejects.toThrow('QQ_COMPONENT_BUSY');await call(base+'/stop','POST');await until(()=>call<ManagedQQStatus>(base),s=>!s.busy);expect((await call<ManagedQQStatus>(base)).phase).toBe('missing');expect(start).not.toHaveBeenCalled();await runtime.stop();writeFileSync(join(p.data,'qq-component','manager.json'),'invalid');runtime=await startRuntime(p);call=<T>(route:string,method='GET')=>requestRuntime<T>(runtime.connection,route,method);expect((await call<ManagedQQStatus>(base)).error).toBe('QQ_COMPONENT_STATE_INVALID');expect((await call<{state:string}>('/v1/status')).state).toBe('running');}finally{await runtime.stop();rmSync(p.root,{recursive:true,force:true});}
});
it('Runtime shutdown during component creation waits and cleans the late-created resource',async()=>{
 const p=paths(mkdtempSync(join(tmpdir(),'bff-managed-start-cancel-')));
 vi.spyOn(ComponentPlatform.prototype,'install').mockResolvedValue();let started!:()=>void;const entering=new Promise<void>(r=>{started=r;});let release!:()=>void;const blocked=new Promise<void>(r=>{release=r;});let resource=false;
 vi.spyOn(ComponentPlatform.prototype,'start').mockImplementation(async()=>{started();await blocked;resource=true;});
 vi.spyOn(ComponentPlatform.prototype,'stop').mockImplementation(async()=>{resource=false;});
 const runtime=await startRuntime(p);const base='/v1/channels/qq/component',call=<T>(route:string,method='GET')=>requestRuntime<T>(runtime.connection,route,method);
 try{await call(base+'/connect','POST');await entering;const stopping=runtime.stop();await delay(20);release();await stopping;expect(resource).toBe(false);}finally{release();await runtime.stop();rmSync(p.root,{recursive:true,force:true});}
});
