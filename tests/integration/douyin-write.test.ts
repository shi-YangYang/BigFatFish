import { expect,it } from 'vitest';
import { createServer } from 'node:http';
import { mkdtempSync,rmSync } from 'node:fs';import { join } from 'node:path';import { tmpdir } from 'node:os';import { setTimeout as delay } from 'node:timers/promises';
import { startRuntime } from '../../apps/runtime/src/lifecycle.js';import { paths } from '../../apps/runtime/src/paths.js';import { requestRuntime } from '../../apps/runtime/src/connection.js';import type { ActivityTask } from '../../apps/runtime/src/tasks/queue.js';import type { StoredApproval } from '../../apps/runtime/src/permissions/store.js';
const python=process.env.BFF_TEST_PYTHON;
it.skipIf(!python)('real Runtime/Chrome/Python binds actual like/comment target, content, endpoint and one submission',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff-write-'));const sent:Record<string,string>[]=[];let scenario='good',tool='douyin_like';const id='1234567890123456789';
 const runtime=await startRuntime(paths(root),0,{douyin:async c=>{
  await c.addCookies([{name:'uid_tt',value:'12345',domain:'.douyin.com',path:'/'},{name:'sessionid',value:'fixture',domain:'.douyin.com',path:'/'}]);
  await c.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());
   if(req.method()==='POST'){const body=Object.fromEntries(new URLSearchParams(req.postData()??''));sent.push(body);const receipt=tool==='douyin_like'?{status_code:0}:{status_code:0,comment:{cid:'new-comment',aweme_id:id,text:scenario==='bad-receipt'?'WRONG':'海洋',...(scenario==='wrong-parent'?{reply_to_reply_id:'UNAPPROVED-PARENT'}:scenario==='conflicting-parent'?{reply_id:'',reply_to_reply_id:'UNAPPROVED-PARENT'}:scenario==='missing-parent'?{}:{reply_id:''})}};await route.fulfill({contentType:'application/json',body:JSON.stringify(receipt)});return;}
   if(url.pathname.includes('/comment/list/')){await route.fulfill({contentType:'application/json',body:'{"status_code":0,"comments":[]}'});return;}
   const endpoint=tool==='douyin_like'?'/aweme/v1/web/commit/item/digg/':'/aweme/v1/web/comment/publish/';
   const body=tool==='douyin_like'?`aweme_id=${scenario==='wrong-target'?'9999999999999999999':id}&type=1`:`aweme_id=${scenario==='wrong-target'?'9999999999999999999':id}&text=${scenario==='wrong-content'?'UNAPPROVED':'海洋'}&reply_id=`;
   const script=`async function send(){${scenario==='not-sent'?'return;':''}try{await fetch('${endpoint}',{method:'POST',body:${JSON.stringify(body)}});${scenario==='duplicate'?`await fetch('${endpoint}',{method:'POST',body:${JSON.stringify(body)}});`:''}${scenario==='extra'?`await fetch('/aweme/v1/web/comment/publish/',{method:'POST',body:'aweme_id=${id}&text=UNAPPROVED&reply_id='});`:''}document.querySelector('button').setAttribute('data-e2e-state','digged')}catch{}}`;
   await route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><img data-e2e="user-avatar"><button data-e2e="video-player-digg" data-e2e-state="no-digged" onclick="send()">点赞</button><div data-e2e="comment-list">全部评论</div><div class="public-DraftEditor-content" contenteditable="true" onkeydown="if(event.key==='Enter'){event.preventDefault();send()}"></div><script>${script}</script>`});
  });
 }});
 const call=<T>(url:string,method='GET',body?:unknown)=>requestRuntime<T>(runtime.connection,url,method,body);
 const wait=async(id:string)=>{for(let i=0;i<700;i++){const t=(await call<{tasks:ActivityTask[]}>('/v1/activities')).tasks.find(t=>t.id===id)!;if(!['queued','running'].includes(t.status))return t;await delay(100);}throw new Error('timeout');};
 try{
  await call('/v1/douyin','PUT',{enabled:true,headless:true,pythonPath:python,accountId:'12345',executablePath:'',revision:''});
  for(tool of ['douyin_like','douyin_comment'])for(scenario of ['good','wrong-target',...(tool==='douyin_comment'?['wrong-content','bad-receipt','wrong-parent','conflicting-parent','missing-parent']:['extra']),'duplicate','not-sent']){
   const before=sent.length;const a=await call<StoredApproval>('/v1/douyin/approvals','POST',{tool,args:tool==='douyin_like'?{aweme_id:id}:{aweme_id:id,text:'海洋'}});const t=await call<ActivityTask>(`/v1/douyin/approvals/${a.id}/decide`,'POST',{digest:a.digest,decision:'approve'});const done=await wait(t.id);
   expect(sent.length-before,`${tool} ${scenario} ${JSON.stringify(done)}`).toBe(['wrong-target','wrong-content','not-sent'].includes(scenario)?0:1);
   expect(done.status,`${tool} ${scenario} ${JSON.stringify(done)}`).toBe(scenario==='good'?'completed':['wrong-target','wrong-content'].includes(scenario)?'revoked':'unknown');
  }
 }finally{await runtime.stop();rmSync(root,{recursive:true,force:true});}
},200000);

it.skipIf(!python)('Runtime marks a redirected approved write unknown with zero follow-up requests',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff-runtime-redirect-'));let first=0,extra=0;
 const receiver=createServer((_req,res)=>{extra++;res.end('{"status_code":0}');});
 await new Promise<void>(r=>receiver.listen(0,'127.0.0.1',r));const target=`http://127.0.0.1:${(receiver.address() as {port:number}).port}/UNAPPROVED`;
 const runtime=await startRuntime(paths(root),0,{douyin:async context=>{
  await context.addCookies([{name:'uid_tt',value:'12345',domain:'.douyin.com',path:'/'},{name:'sessionid',value:'fixture',domain:'.douyin.com',path:'/'}]);
  await context.route('**/*',async route=>{
   if(route.request().method()==='POST'){first++;await route.fulfill({status:307,headers:{location:target},body:''});return;}
   await route.fulfill({contentType:'text/html',body:'<img data-e2e="user-avatar"><button data-e2e="video-player-digg" data-e2e-state="no-digged" onclick="fetch(\'/aweme/v1/web/commit/item/digg/\',{method:\'POST\',body:\'aweme_id=1234567890123456789&type=1\'}).catch(()=>{})">点赞</button>'});
  });
 }});
 const call=<T>(url:string,method='GET',body?:unknown)=>requestRuntime<T>(runtime.connection,url,method,body);
 try{
  await call('/v1/douyin','PUT',{enabled:true,headless:true,pythonPath:python,accountId:'12345',executablePath:'',revision:''});
  const a=await call<StoredApproval>('/v1/douyin/approvals','POST',{tool:'douyin_like',args:{aweme_id:'1234567890123456789'}});
  const task=await call<ActivityTask>(`/v1/douyin/approvals/${a.id}/decide`,'POST',{digest:a.digest,decision:'approve'});
  await expect.poll(async()=>{
   const current=(await call<{tasks:ActivityTask[]}>('/v1/activities')).tasks.find(t=>t.id===task.id)!;
   return current.status;
  },{timeout:60000}).toBe('unknown');
  expect(first).toBe(1);expect(extra).toBe(0);
 }finally{await runtime.stop();await new Promise<void>(r=>receiver.close(()=>r()));rmSync(root,{recursive:true,force:true});}
},65000);
