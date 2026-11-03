import {readBundle} from '../../apps/runtime/src/plugins/service.js';
import { it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';
import { paths } from '../../apps/runtime/src/paths.js';
import { startRuntime } from '../../apps/runtime/src/lifecycle.js';
import { requestRuntime } from '../../apps/runtime/src/connection.js';
import type { VideoTask } from '../../apps/runtime/src/bilibili/service.js';
import { onebotFixture } from '../fixtures/onebot.js';
import { fixtureModel } from '../fixtures/model.mjs';
const ffmpeg=process.env.BFF_TEST_FFMPEG;
it.skipIf(!ffmpeg)('real upstream → DSH image request → candidate/activity/diary; Runtime API/CLI/auth/disable/idempotency/restart',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff p4 integration ')),p=paths(root),fixture=await fixtureModel(),bot=await onebotFixture(),originalPath=process.env.PATH,originalFetch=globalThis.fetch;
 process.env.PATH=resolve(ffmpeg!,'..')+':'+originalPath;
 const video=join(root,'fixture.mp4');expect(spawnSync(ffmpeg!,['-y','-f','lavfi','-i','color=c=blue:s=320x180:r=10','-t','9','-c:v','mpeg4',video]).status).toBe(0);
 const secret='fixture-session-1234567890',csrf='a'.repeat(32);
 vi.stubGlobal('fetch',async(input:Parameters<typeof fetch>[0],options?:RequestInit)=>{
  const u=new URL(String(input));if(u.hostname.endsWith('bilibili.com')){
   const data=u.pathname.endsWith('/generate')?{url:'https://passport.bilibili.com/login?fixture=1',qrcode_key:'fixture-key'}:u.pathname.endsWith('/poll')?{code:0}:{isLogin:true,mid:123,uname:'测试账号'};
   return new Response(JSON.stringify({code:0,data}),{headers:{'content-type':'application/json',...(u.pathname.endsWith('/poll')?{'set-cookie':`SESSDATA=${secret}; Path=/`}:{})}});
  }return originalFetch(input,options);
 });
 const adapters={bilibili:{preload:resolve('tests/fixtures/bilibili-network.mjs'),env:{BFF_FIXTURE_VIDEO:video}}};let runtime=await startRuntime(p,0,adapters);
 const call=<T>(url:string,method='GET',body?:unknown)=>requestRuntime<T>(runtime.connection,url,method,body);
 const cli=async(args:string[])=>{const child=spawn(process.execPath,[resolve('dist/cli/src/main.js'),'bilibili',...args,'--json','--data-dir',root],{stdio:['ignore','pipe','pipe']});let out='';child.stdout.on('data',b=>out+=b);await new Promise(r=>child.once('close',r));return JSON.parse(out);};
 try{
  const installed=readBundle('dist/runtime/plugin-catalog/bilibili.bff-plugin');await call('/v1/plugins/install','POST',installed);await call('/v1/plugins/bilibili/enable','POST',{granted:installed.manifest.permissions,config:{}});
  const model={id:'fixture',label:'视觉夹具',provider:'openai',baseURL:fixture.url,model:'fixture-model',contextWindow:32768,maxTokens:1024,timeoutMs:30000,vision:true};await call('/v1/models','POST',model);await call('/v1/model-routes','PUT',{chat:'fixture',vision:'fixture',memory:'fixture'});
  await call('/v1/bilibili','PUT',{revision:'',enabled:true});
  await expect(call('/v1/bilibili/import','POST',{sessdata:'invalid',bili_jct:csrf})).rejects.toThrow('BILI_INVALID_CREDENTIALS');
  await call('/v1/bilibili/import','POST',{sessdata:secret,bili_jct:csrf});expect(JSON.stringify(await call('/v1/bilibili'))).not.toContain(secret);
  const qr=await call<{id:string;image:string}>('/v1/bilibili/login/start','POST');expect(qr.image).toMatch(/^data:image\/png;base64,/);expect((await call<{status:string}>('/v1/bilibili/login/cancel','POST',{id:qr.id})).status).toBe('cancelled');
  expect((await cli(['status'])).accountState).toBe('verified');installed.manifest.version='0.1.1';await call('/v1/plugins/update','POST',installed);expect((await call<{text:string}>('/v1/bilibili/search','POST',{query:'鱼'})).text).toContain('BV1234567890');
  const initial=await call<VideoTask>('/v1/bilibili/tasks','POST',{bvid:'BV1234567890',requestId:'first'});
  const wait=async(id:string)=>{let t=await call<VideoTask>('/v1/bilibili/tasks/'+id);for(let i=0;i<800&&['queued','running','understanding'].includes(t.status);i++){await delay(100);t=await call('/v1/bilibili/tasks/'+id);}return t;};
  const task=await wait(initial.id);expect(task.status,JSON.stringify(task)).toBe('completed');expect(task.result?.evidence.frames).toBe(9);expect(task.result?.summary).toContain('海洋');
  const imageRequest=fixture.requests.find(r=>JSON.stringify(r.body).includes('BFF_VIDEO_UNDERSTAND'));expect(JSON.stringify(imageRequest)).toContain('data:image/jpeg;base64,');expect(imageRequest?.body.tools??[]).toHaveLength(0);
  expect((await call<VideoTask>('/v1/bilibili/tasks','POST',{bvid:'BV1234567890',requestId:'again'})).id).toBe(task.id);
  expect((await cli(['tasks']))[0].status).toBe('completed');
  const memories=await call<{id:string;status:string;kind:string}[]>('/v1/memories');expect(memories.find(m=>m.kind==='interest')?.status).toBe('candidate');
  const timeline=await call<{id:string;kind:string}[]>('/v1/life/timeline');expect(timeline.filter(t=>t.kind==='bilibili.watched')).toHaveLength(1);
  await expect(call(`/v1/bilibili/tasks/${task.id}/share`,'POST',{target:{kind:'private',id:'100'}})).rejects.toThrow('CHANNEL_NOT_CONFIGURED');
  await call('/v1/channels/qq','PUT',{revision:'',url:bot.url,token:bot.controls.token,accountId:'10001',ownerId:'20002',groups:['30003'],enabled:true,replyEnabled:true,proactiveEnabled:true});
  for(let i=0;i<60;i++){if((await call<{health:{state:string}}>('/v1/channels/qq')).health.state==='online')break;await delay(50);}
  const approval=await call<{id:string;digest:string;payload:{segments:{data:{text:string}}[]}}>(`/v1/bilibili/tasks/${task.id}/share`,'POST',{target:{kind:'private',id:'20002'}});
  expect(JSON.stringify(approval.payload)).toContain(task.result!.evidence.url);expect(JSON.stringify(approval.payload)).toContain(task.result!.evidence.title);expect(bot.requests.filter(r=>r.action.startsWith('send_'))).toHaveLength(0);
  await call('/v1/permissions/approvals/'+approval.id,'POST',{digest:approval.digest,decision:'approve'});
  for(let i=0;i<60&&!bot.requests.some(r=>r.action.startsWith('send_'));i++)await delay(50);
  expect(bot.requests.filter(r=>r.action.startsWith('send_'))).toHaveLength(1);
  const rejected=await call<{id:string;digest:string}>(`/v1/bilibili/tasks/${task.id}/share`,'POST',{target:{kind:'group',id:'30003'}});await call('/v1/permissions/approvals/'+rejected.id,'POST',{digest:rejected.digest,decision:'reject'});expect(bot.requests.filter(r=>r.action.startsWith('send_'))).toHaveLength(1);
  await expect(call('/v1/bilibili/tasks','POST',{bvid:'BV1234567899',requestId:'again'})).rejects.toThrow('IDEMPOTENCY_CONFLICT');
  const diary=await call<{id:string}>('/v1/memory-tasks/diary','POST',{day:new Date().toISOString().slice(0,10),timezone:'UTC',requestId:'diary'});
  let diaryTask:{status:string;error?:string}={status:'queued'};for(let i=0;i<150&&['queued','running'].includes(diaryTask.status);i++){await delay(100);diaryTask=await call('/v1/memory-tasks/'+diary.id);}expect(diaryTask.status,diaryTask.error).toBe('completed');expect(JSON.stringify(await call('/v1/diaries'))).toContain('bilibili:');
  expect(readdirSync(join(p.runtime,'bilibili'))).toEqual([]);expect(readFileSync(p.database).includes(Buffer.from(secret))).toBe(false);
  const next=await call<VideoTask>('/v1/bilibili/tasks','POST',{bvid:'BV1234567891',requestId:'cancel'});await call(`/v1/bilibili/tasks/${next.id}/cancel`,'POST');expect((await wait(next.id)).status).toBe('cancelled');
  const running=await call<VideoTask>('/v1/bilibili/tasks','POST',{bvid:'BV1234567892',requestId:'disable'});const status=await call<{revision:string}>('/v1/bilibili');await call('/v1/bilibili','PUT',{revision:status.revision,enabled:false});expect((await wait(running.id)).status).toBe('cancelled');
  await runtime.stop();const db=new DatabaseSync(p.database);db.prepare("INSERT INTO video_tasks(id,request_id,bvid,status,created_at) VALUES('restart','restart','BV1234567899','running','2026-11-03')").run();db.close();runtime=await startRuntime(p,0,adapters);expect((await call<VideoTask>('/v1/bilibili/tasks/restart')).status).toBe('interrupted');expect((await cli(['tasks'])).find((t:VideoTask)=>t.id===task.id).status).toBe('completed');
 }finally{await runtime.stop();vi.unstubAllGlobals();process.env.PATH=originalPath;await fixture.close();await bot.close();rmSync(root,{recursive:true,force:true});}
},150000);
