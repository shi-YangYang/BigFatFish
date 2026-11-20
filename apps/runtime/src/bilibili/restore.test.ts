import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach,expect,it,vi } from 'vitest';
import type { ChatService } from '../ai/chat/service.js';
import type { Channels } from '../channels/service.js';
import { paths } from '../storage/paths.js';
import { openDatabase } from '../storage/database.js';
import { Bilibili } from './service.js';

const credentials={sessdata:'fixture-session-for-resume-only',bili_jct:'a'.repeat(32)};
const account={mid:42,uname:'fixture',isLogin:true};
const json=(data:unknown,code=0)=>Response.json({code,data});
const cleanups:(()=>Promise<void>)[]=[];
afterEach(async()=>{while(cleanups.length)await cleanups.pop()!();vi.unstubAllGlobals();});

async function installed(){
  const root=mkdtempSync(join(tmpdir(),'bff-bili-resume-')),p=paths(root);
  const db=openDatabase(':memory:');
  const chat={config:{encryptSecret:()=>'<test-sealed-value>',decryptSecret:()=>JSON.stringify(credentials)}} as unknown as ChatService;
  const make=()=>new Bilibili(db,chat,{} as Channels,p);let service=make();
  cleanups.push(async()=>{await service.close();db.close();rmSync(root,{recursive:true,force:true});});
  let response:()=>Promise<Response>=async()=>json(account);const calls={verify:0,qr:0};
  vi.stubGlobal('fetch',async(url:string)=>{
    if(url==='https://api.bilibili.com/x/web-interface/nav'){calls.verify++;return response();}
    if(url==='https://passport.bilibili.com/x/passport-login/web/qrcode/generate'){calls.qr++;return json({url:'https://passport.bilibili.com/login',qrcode_key:'test'});}
    throw Error('unexpected fixture request');
  });
  await service.initialize();await service.configure({enabled:true,revision:''});await service.import(credentials);
  return {get service(){return service;},calls,setResponse(fn:()=>Promise<Response>){response=fn;},
    async restart(){await service.close();service=make();await service.initialize();service.restoreConnection();},
  };
}

it('restores the verified identity once without a challenge or config revision change; disconnect, guest mode and logout survive restarts',async()=>{
  const f=await installed(),revision=f.service.status().revision;await f.restart();f.service.restoreConnection();
  await vi.waitFor(()=>expect(f.service.status()).toMatchObject({connection:{phase:'online'},accountState:'verified',account:{mid:'42'},revision}));
  expect(f.calls).toEqual({verify:2,qr:0});
  await f.service.disconnect();await f.restart();
  expect(f.service.status()).toMatchObject({enabled:false,hasCredentials:true,connection:{phase:'idle'}});
  await f.service.configure({enabled:true,anonymous:true,revision:f.service.status().revision});await f.restart();
  expect(f.service.status()).toMatchObject({enabled:true,hasCredentials:true,accountState:'anonymous',connection:{phase:'idle'}});
  await f.service.logout();await f.restart();
  expect(f.service.status()).toMatchObject({hasCredentials:false,accountState:'signed-out',connection:{phase:'idle'}});
  expect(f.calls).toEqual({verify:2,qr:0});
});

it.each([
  ['expired',async()=>json({},-101),'login-required',undefined],
  ['logged out',async()=>json({isLogin:false}),'login-required',undefined],
  ['network',async()=>{throw Error('fixture network down');},'error','BILI_VERIFICATION_UNAVAILABLE'],
  ['throttled',async()=>new Response(null,{status:429}),'error','BILI_ACCESS_LIMITED'],
  ['identity changed',async()=>json({...account,mid:99}),'error','BILI_ACCOUNT_CHANGED'],
] as const)('preserves the saved session when %s; only explicit sign-in after confirmed expiry starts QR',async(_case,reply,phase,error)=>{
  const f=await installed();f.setResponse(reply);await f.restart();
  await vi.waitFor(()=>expect(f.service.status().connection.phase).toBe(phase));
  expect(f.service.status().connection.error).toBe(error);
  expect(f.service.status()).toMatchObject({enabled:true,hasCredentials:true,account:{mid:'42'}});expect(f.calls.qr).toBe(0);
  f.service.connect({revision:f.service.status().revision});
  await vi.waitFor(()=>expect(f.service.status().connection.phase).toBe(error?'error':'login'));
  expect(f.calls.qr).toBe(error?0:1);
});

it('discard late success when the user disconnects during restore',async()=>{
  const f=await installed();let finish!:(r:Response)=>void;
  f.setResponse(()=>new Promise(r=>{finish=r;}));await f.restart();await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));
  const stop=f.service.disconnect();finish(json(account));await stop;
  expect(f.service.status()).toMatchObject({enabled:false,hasCredentials:true,connection:{phase:'idle'},accountState:'unverified'});expect(f.calls.qr).toBe(0);
});
