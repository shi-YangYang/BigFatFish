import { expect, it } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { paths } from '../../apps/runtime/src/paths.js';
import { readConnection, requestRuntime } from '../../apps/runtime/src/connection.js';
import type { ChatMessage, Conversation, Persona } from '../../apps/runtime/src/ai/types.js';
import { fixtureModel } from '../fixtures/model.mjs';
async function cli(root:string,args:string[],input?:unknown) {
 const child=spawn(process.execPath,[resolve('dist/cli/src/main.js'),...args,'--data-dir',root,'--json'],{stdio:['pipe','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',c=>{stdout+=c;});child.stderr.on('data',c=>{stderr+=c;});child.stdin.end(input?JSON.stringify(input):'');
 const code=await new Promise<number|null>((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});return{code,stdout,stderr};
}
it('runs real DSH through Runtime/CLI: streams, isolates sessions, resumes across processes, cancels and persists',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff ai integration ')),p=paths(root),fixture=await fixtureModel();let socket:WebSocket|undefined;
 try{
  expect((await cli(root,['start'])).code).toBe(0);let connection=readConnection(p);
  const call=<T>(url:string,method='GET',body?:unknown)=>requestRuntime<T>(connection,url,method,body);
  expect((await cli(root,['models','set'],{id:'fixture',label:'测试专用模型',provider:'openai',baseURL:fixture.url,model:'fixture-model',contextWindow:8192,maxTokens:512,timeoutMs:20000,vision:false,apiKey:'fixture-only-key'})).code).toBe(0);
  await call('/v1/model-routes','PUT',{chat:'fixture'});
  const persona=await call<Persona>('/v1/persona');await call('/v1/persona','PUT',{...persona,name:'栗子鱼'});
  const conversation=await call<Conversation>('/v1/conversations','POST',{});
  const events:ChatMessage[]=[];socket=new WebSocket(`ws://127.0.0.1:${connection.port}/v1/events?conversationId=${conversation.id}`,{headers:{authorization:`Bearer ${connection.token}`}});socket.on('message',b=>{const v=JSON.parse(b.toString());if(v.message)events.push(v.message);});await new Promise<void>((resolve,reject)=>{socket!.once('open',resolve);socket!.once('error',reject);});
  const wait=async(id:string)=>{let msg=await call<ChatMessage>('/v1/messages/'+id);for(let i=0;i<150&&['queued','running'].includes(msg.status);i++){await delay(100);msg=await call('/v1/messages/'+id);}return msg;};
  const first=await call<ChatMessage>(`/v1/conversations/${conversation.id}/messages`,'POST',{requestId:'first',content:'你好，记住蓝色标记'});
  expect((await call<ChatMessage>(`/v1/conversations/${conversation.id}/messages`,'POST',{requestId:'first',content:'你好，记住蓝色标记'})).id).toBe(first.id);
  const result=await wait(first.id);expect(result.status,result.error??'').toBe('completed');expect(result.content).toBe('测试模型回复');expect(events.some(e=>e.content==='测试')).toBe(true);
  expect(fixture.requests[0]?.body?.tools??[]).toHaveLength(0);expect(JSON.stringify(fixture.requests[0]?.body)).toContain('栗子鱼');
  socket.close();socket=undefined;
  expect((await cli(root,['restart'])).code).toBe(0);connection=readConnection(p);
  const second=await cli(root,['chat'],{conversationId:conversation.id,content:'继续谈蓝色标记',requestId:'second'});expect(second.code,second.stdout+second.stderr).toBe(0);
  expect(JSON.stringify(fixture.requests.at(-1)?.body?.messages)).toContain('你好，记住蓝色标记');expect(JSON.stringify(fixture.requests.at(-1)?.body?.messages)).toContain('测试模型回复');
  const other=await call<Conversation>('/v1/conversations','POST',{});
  const cancelled=await call<ChatMessage>(`/v1/conversations/${other.id}/messages`,'POST',{requestId:'cancel',content:'SLOW_NOW'});
  for(let i=0;i<80;i++){await delay(80);if((await call<ChatMessage>('/v1/messages/'+cancelled.id)).content)break;}
  await call('/v1/messages/'+cancelled.id+'/cancel','POST');expect((await wait(cancelled.id)).status).toBe('cancelled');
  const after=await call<ChatMessage>(`/v1/conversations/${other.id}/messages`,'POST',{requestId:'after',content:'继续'});expect((await wait(after.id)).status).toBe('completed');
  const fail=await call<Conversation>('/v1/conversations','POST',{});const failure=await call<ChatMessage>(`/v1/conversations/${fail.id}/messages`,'POST',{requestId:'fail',content:'FAIL_NOW'});expect((await wait(failure.id)).status).toBe('failed');
  const queried=JSON.stringify(await call('/v1/models'));expect(queried).not.toContain('fixture-only-key');expect(readFileSync(p.log,'utf8')).not.toContain('fixture-only-key');
  expect((await call<ChatMessage[]>(`/v1/conversations/${conversation.id}/messages`)).filter(m=>m.role==='assistant')).toHaveLength(2);
 }finally{socket?.close();await cli(root,['stop']);await fixture.close();rmSync(root,{recursive:true,force:true});}
},60000);
it('ignores legacy deadlines and handles queued cancellation and authenticated event isolation with the real engine',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff ai boundaries ')),p=paths(root),fixture=await fixtureModel();let socket:WebSocket|undefined;
 try{
  expect((await cli(root,['start'])).code).toBe(0);const c=readConnection(p);const call=<T>(url:string,method='GET',body?:unknown)=>requestRuntime<T>(c,url,method,body);
  const model={id:'slow',label:'边界测试',provider:'openai',baseURL:fixture.url,model:'fixture-model',contextWindow:8192,maxTokens:512,timeoutMs:1500,vision:false};await call('/v1/models','POST',model);
  const a=await call<Conversation>('/v1/conversations','POST',{modelId:'slow'}),b=await call<Conversation>('/v1/conversations','POST',{modelId:'slow'});
  const events:unknown[]=[];socket=new WebSocket(`ws://127.0.0.1:${c.port}/v1/events?conversationId=${b.id}`,{headers:{authorization:`Bearer ${c.token}`}});socket.on('message',raw=>events.push(JSON.parse(raw.toString())));await new Promise<void>((resolve,reject)=>{socket!.once('open',resolve);socket!.once('error',reject);});
  const first=await call<ChatMessage>(`/v1/conversations/${a.id}/messages`,'POST',{content:'SLOW_NOW',requestId:'slow'});
  const queued=await call<ChatMessage>(`/v1/conversations/${a.id}/messages`,'POST',{content:'不要发送这个请求',requestId:'queued'});await call(`/v1/messages/${queued.id}/cancel`,'POST');
  await delay(1800);expect((await call<ChatMessage>('/v1/messages/'+first.id)).status).toBe('running');
  await call(`/v1/messages/${first.id}/cancel`,'POST');
  let end=first;for(let i=0;i<70&&['queued','running'].includes(end.status);i++){await delay(100);end=await call('/v1/messages/'+first.id);}
  expect(end.status).toBe('cancelled');expect((await call<ChatMessage>('/v1/messages/'+queued.id)).status).toBe('cancelled');
  expect(events.map(e=>(e as {type:string}).type)).toEqual(['snapshot-start','snapshot-end','ready']);expect(JSON.stringify(fixture.requests)).not.toContain('不要发送这个请求');
  const refused=new WebSocket(`ws://127.0.0.1:${c.port}/v1/events?conversationId=${b.id}`,{headers:{authorization:'Bearer invalid'}});refused.on('error',()=>{});const status=await new Promise<number>(resolve=>{refused.on('unexpected-response',(_req,res)=>{resolve(res.statusCode!);res.resume();refused.terminate();});});expect(status).toBe(401);
  expect((await call<ChatMessage[]>(`/v1/conversations/${b.id}/messages`))).toHaveLength(0);
 }finally{socket?.close();await cli(root,['stop']);await fixture.close();rmSync(root,{recursive:true,force:true});}
},30000);
it('uses the real DeepSeek Messages provider against a local protocol fixture',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff messages ')),fixture=await fixtureModel();
 try{
  expect((await cli(root,['start'])).code).toBe(0);
  const configured=await cli(root,['models','set'],{id:'deepseek-fixture',label:'Messages 测试',provider:'deepseek',baseURL:fixture.url.replace('/v1','/anthropic'),model:'deepseek-v4-flash',contextWindow:8192,maxTokens:512,timeoutMs:10000,vision:false,apiKey:'fixture-messages-key'});expect(configured.code,configured.stdout).toBe(0);
  const result=await cli(root,['chat'],{modelId:'deepseek-fixture',content:'测试 Messages 接口'});expect(result.code,result.stdout+result.stderr).toBe(0);expect(result.stdout).toContain('Messages测试回复');
  expect(fixture.requests.some(r=>r.url.startsWith('/anthropic/')&&JSON.stringify(r.body).includes('测试 Messages 接口'))).toBe(true);
 }finally{await cli(root,['stop']);await fixture.close();rmSync(root,{recursive:true,force:true});}
},30000);
