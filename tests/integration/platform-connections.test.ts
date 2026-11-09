import {afterEach,expect,it,vi} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {openDatabase} from '../../apps/runtime/src/storage/database.js';
import {paths,preparePaths} from '../../apps/runtime/src/paths.js';
import {Bilibili} from '../../apps/runtime/src/bilibili/service.js';
import {Douyin} from '../../apps/runtime/src/douyin/service.js';
import {TaskQueue} from '../../apps/runtime/src/tasks/queue.js';
import type {ChatService} from '../../apps/runtime/src/ai/chat.js';
import type {Channels} from '../../apps/runtime/src/channels/service.js';
import type {BrowserContext} from 'playwright-core';
import * as mcp from '../../apps/runtime/src/douyin/mcp.js';
import Fastify from 'fastify';
import {registerDouyin} from '../../apps/runtime/src/douyin/routes.js';
import type {Activities} from '../../apps/runtime/src/tasks/service.js';
import {InputError} from '../../apps/runtime/src/ai/types.js';
const credentials={sessdata:'fixture-session-123456789012345',bili_jct:'a'.repeat(32)};
const chat={config:{encryptSecret:(s:string)=>'encrypted:'+s,decryptSecret:(s:string)=>s.slice(10)}} as unknown as ChatService;
const until=async(test:()=>boolean)=>{for(let i=0;i<150&&!test();i++)await delay(25);expect(test()).toBe(true);};
function data(){const p=paths(mkdtempSync(join(tmpdir(),'bff-platform-connect-')));preparePaths(p);const db=openDatabase(p.database);return {p,db,clean:()=>{db.close();rmSync(p.root,{recursive:true,force:true});}};}
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
function biliNetwork(){let qrCalls=0;let holding=false;let release:()=>void=()=>{};let waiting=false;
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
  const url=String(input);if(url.includes('/nav')){if(holding){waiting=true;await new Promise<void>(r=>{release=r;});}return new Response(JSON.stringify({code:0,data:{isLogin:true,mid:12345,uname:'测试账号'}}));}
  if(url.includes('/generate')){qrCalls++;return new Response(JSON.stringify({code:0,data:{url:'https://passport.bilibili.com/fixture',qrcode_key:'fixture'}}));}
  if(url.includes('/poll'))return new Response(JSON.stringify({code:0,data:{code:0}}),{headers:[['set-cookie','SESSDATA='+credentials.sessdata+'; Path=/'],['set-cookie','bili_jct='+credentials.bili_jct+'; Path=/']]});
  throw Error('unexpected network');
 }));return {qrCalls:()=>qrCalls,hold:()=>{holding=true;},waiting:()=>waiting,release:()=>release()};
}
it('B站 connects from disabled through QR and verification, reuses credentials, and keeps anonymous access',async()=>{
 const d=data(),network=biliNetwork(),b=new Bilibili(d.db,chat,{} as Channels,d.p);await b.initialize();
 try{expect(()=>b.connect({revision:'',credentials:{}})).toThrow('BILI_INVALID_CREDENTIALS');expect(b.status().enabled).toBe(false);b.connect({revision:''});expect(()=>b.connect({revision:b.status().revision})).toThrow('BILI_BUSY');await until(()=>b.status().connection.phase==='online');expect(b.status()).toMatchObject({enabled:true,accountState:'verified',account:{mid:'12345'}});expect(b.status().hasCredentials).toBe(true);
 await b.disconnect();expect(b.status().enabled).toBe(false);b.connect({revision:b.status().revision});expect(b.status().accountState).toBe('unverified');await until(()=>b.status().connection.phase==='online');expect(network.qrCalls()).toBe(1);
 await b.logout();await b.configure({revision:b.status().revision,enabled:true});expect(b.status()).toMatchObject({enabled:true,accountState:'signed-out',hasCredentials:false});
 }finally{await b.close();d.clean();}
});
it('B站 cancellation during credential verification never writes late credentials or accepts stale restart',async()=>{
 const d=data(),network=biliNetwork(),b=new Bilibili(d.db,chat,{} as Channels,d.p);await b.initialize();network.hold();
 try{b.connect({revision:'',credentials});await until(network.waiting);const stopped=b.disconnect();network.release();await stopped;expect(b.status()).toMatchObject({enabled:false,hasCredentials:false,connection:{phase:'idle'}});
 // A bad revision cannot restart the previously cancelled intent.
 expect(()=>b.connect({revision:''})).toThrow('CHANNEL_VERSION_CONFLICT');
 }finally{network.release();await b.close();d.clean();}
});
function douyinFixture(d:ReturnType<typeof data>){
 const q=new TaskQueue(d.db),service=new Douyin(d.db,chat,q,d.p);let loggedIn=false,id='12345',hold=false,waiting=false,release:()=>void=()=>{};const calls:string[]=[];
 const context={pages:()=>[]} as unknown as BrowserContext;
 vi.spyOn(service.browser,'start').mockImplementation(async config=>{expect(config.headless).toBe(false);service.browser.context=context;});
 vi.spyOn(service.browser,'close').mockImplementation(async()=>{service.browser.context=undefined;});
 vi.spyOn(service.browser,'account').mockImplementation(async()=>({loggedIn,id}));
 vi.spyOn(mcp,'callMcp').mockImplementation(async options=>{calls.push(options.tool);if(hold){waiting=true;await new Promise<void>(r=>{release=r;});}return {ok:true,loggedIn,needLogin:!loggedIn};});
 return {service,q,calls,login:(value='12345')=>{loggedIn=true;id=value;},hold:()=>{hold=true;waiting=false;},waiting:()=>waiting,release:()=>release()};
}
it('抖音 configuration acknowledgement rejects invalid drafts and resolves only after settings are saved',async()=>{
 const d=data(),f=douyinFixture(d),app=Fastify();
 app.setErrorHandler((error,_request,reply)=>reply.code(error instanceof InputError?error.statusCode:500).send({error:error instanceof InputError?error.message:'INTERNAL_ERROR'}));
 registerDouyin(app,f.service,{} as Activities);
 try{
  const before=f.service.status();
  for(const [patch,error] of [
   [{pythonPath:'relative-python'},'INVALID_PYTHON_PATH'],
   [{executablePath:'relative-browser'},'INVALID_BROWSER_PATH'],
   [{accountId:'invalid-id'},'INVALID_ACCOUNT'],
  ] as const){
   const response=await app.inject({method:'POST',url:'/v1/douyin/connect',payload:{...before.config,headless:true,revision:before.revision,...patch}});
   expect(response.statusCode).toBe(400);expect(response.json()).toEqual({error});
   expect(f.service.status()).toMatchObject({config:before.config,revision:before.revision,connection:{phase:'error',error}});
   expect(d.db.prepare("SELECT config FROM plugin_config WHERE id='douyin'").get()).toBeUndefined();
  }
  expect(f.service.browser.start).not.toHaveBeenCalled();
  f.hold();
  const response=await app.inject({method:'POST',url:'/v1/douyin/connect',payload:{revision:before.revision,headless:true,accountId:'12345'}});
  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({config:{enabled:true,headless:true,accountId:'12345'}});
  const saved=d.db.prepare("SELECT config,revision FROM plugin_config WHERE id='douyin'").get()!;
  expect(saved.revision).toBe(response.json().revision);expect(JSON.parse(saved.config as string)).toEqual(response.json().config);
  await until(f.waiting);expect(f.service.status().connection.phase).toBe('connecting');
  const stopped=f.service.disconnect();f.release();await stopped;
 }finally{f.release();await app.close();await f.service.close();await f.q.close();d.clean();}
});
it.each(['disconnect','close'] as const)('抖音 configuration acknowledgement remains cancellable during %s',async operation=>{
 const d=data(),f=douyinFixture(d);let waiting=false,release=()=>{};
 const held=new Promise<void>(resolve=>{release=resolve;}),abort=f.q.abort.bind(f.q);
 vi.spyOn(f.q,'abort').mockImplementationOnce(async platform=>{waiting=true;await held;return abort(platform);});
 try{
  const acknowledgement=f.service.connect({revision:'',accountId:'12345'}).then(()=>null,error=>error);
  await until(()=>waiting);const stopped=f.service[operation]();release();await stopped;
  expect(await acknowledgement).toBeInstanceOf(Error);
  expect(f.service.status()).toMatchObject({config:{enabled:false,accountId:''},connection:{phase:'idle'}});
  expect(f.service.browser.start).not.toHaveBeenCalled();
 }finally{release();await f.service.close();await f.q.close();d.clean();}
});
it('抖音 opens visible login even with headless saved, checks automatically and binds only verified stable account',async()=>{
 const d=data(),f=douyinFixture(d);try{
 f.service.connect({revision:'',headless:true});expect(()=>f.service.connect({revision:f.service.status().revision})).toThrow('DOUYIN_CONNECTION_BUSY');await until(()=>f.service.status().connection.phase==='login');expect(f.service.status().config.accountId).toBe('');f.login();await until(()=>f.service.status().connection.phase==='online');
 expect(f.service.status()).toMatchObject({config:{enabled:true,accountId:'12345',headless:true},accountState:'verified'});expect(f.calls).toContain('douyin_login_poll');expect(f.calls.some(s=>['douyin_like','douyin_comment'].includes(s))).toBe(false);
 await f.service.disconnect();expect(f.service.status().config).toMatchObject({enabled:false,accountId:'12345'});
 }finally{await f.service.close();await f.q.close();d.clean();}
});
it('抖音 preserves existing binding on account mismatch and rejects raw login without stable evidence',async()=>{
 const d=data(),f=douyinFixture(d);try{
 f.login('67890');f.service.connect({revision:'',accountId:'12345'});await until(()=>f.service.status().connection.phase==='error');expect(f.service.status()).toMatchObject({config:{accountId:'12345'},accountState:'account-mismatch',connection:{error:'DOUYIN_ACCOUNT_CHANGED'}});
 await f.service.disconnect();f.login('');f.service.connect({revision:f.service.status().revision,accountId:''});await until(()=>f.service.status().connection.phase==='login');expect(f.service.status().config.accountId).toBe('');
 }finally{await f.service.close();await f.q.close();d.clean();}
});
it('抖音 disconnect and configuration replacement invalidate a pending first-account result',async()=>{
 const d=data(),f=douyinFixture(d);try{
 f.login();f.hold();f.service.connect({revision:''});await until(f.waiting);const stopped=f.service.disconnect();f.release();await stopped;expect(f.service.status()).toMatchObject({config:{enabled:false,accountId:''},connection:{phase:'idle'}});
 // Replace configuration while a new first-login result is actually held in flight.
 f.hold();f.service.connect({revision:f.service.status().revision});await until(f.waiting);
 const config=f.service.status();await f.service.configure({...config.config,revision:config.revision,enabled:false,accountId:'77777'});f.release();await f.service.stop();expect(f.service.status().config).toMatchObject({enabled:false,accountId:'77777'});
 }finally{f.release();await f.service.close();await f.q.close();d.clean();}
});
it('抖音 shutdown during login prevents account persistence and closes the owned browser',async()=>{
 const d=data(),f=douyinFixture(d);try{f.login();f.hold();f.service.connect({revision:''});await until(f.waiting);const closed=f.service.close();f.release();await closed;expect(f.service.status().config.accountId).toBe('');expect(f.service.browser.context).toBeUndefined();expect(()=>f.service.connect({revision:f.service.status().revision})).toThrow('RUNTIME_STOPPING');}finally{f.release();await f.service.close();await f.q.close();d.clean();}
});
