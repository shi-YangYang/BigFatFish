import { expect, it } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { startRuntime } from '../../apps/runtime/src/lifecycle.js';
import { paths } from '../../apps/runtime/src/paths.js';
import { requestRuntime } from '../../apps/runtime/src/connection.js';
import type { ChatMessage, Conversation } from '../../apps/runtime/src/ai/types.js';
import type { Memory, MemoryTask, Diary } from '../../apps/runtime/src/memory/types.js';
import { fixtureModel } from '../fixtures/model.mjs';
it('real DSH extracts candidates, confirms and injects current memory across sessions; deletes without retained system blocks',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff-memory-')),p=paths(root),fixture=await fixtureModel();let runtime=await startRuntime(p);
 try{
  const call=<T>(route:string,method='GET',body?:unknown)=>requestRuntime<T>(runtime.connection,route,method,body);
  await call('/v1/models','POST',{id:'test',label:'测试',provider:'openai',baseURL:fixture.url,model:'fixture-model',contextWindow:32768,maxTokens:4096,timeoutMs:20000,vision:false});await call('/v1/model-routes','PUT',{chat:'test'});
  const wait=async<T extends {status:string}>(route:string)=>{let result=await call<T>(route);for(let i=0;i<200&&['queued','running'].includes(result.status);i++){await delay(100);result=await call<T>(route);}return result;};
  const a=await call<Conversation>('/v1/conversations','POST',{});
  const sent=await call<ChatMessage>(`/v1/conversations/${a.id}/messages`,'POST',{content:'我喜欢茉莉花茶',requestId:'1'});expect((await wait<ChatMessage>('/v1/messages/'+sent.id)).status).toBe('completed');
  const task=await call<MemoryTask>('/v1/memory-tasks/extract','POST',{conversationId:a.id,requestId:'extract-1'});
  const done=await wait<MemoryTask>('/v1/memory-tasks/'+task.id);expect(done.status,JSON.stringify({done,request:fixture.requests.at(-1)?.body})).toBe('completed');const candidate=(done.result as Memory[])[0]!;expect(candidate.status).toBe('candidate');
  const b=await call<Conversation>('/v1/conversations','POST',{});
  const chat=async(id:string,requestId:string)=>{const m=await call<ChatMessage>(`/v1/conversations/${id}/messages`,'POST',{content:'茶',requestId});expect((await wait<ChatMessage>('/v1/messages/'+m.id)).status).toBe('completed');return JSON.stringify(fixture.requests.at(-1)?.body);};
  expect(await chat(b.id,'before')).not.toContain('confirmed_memories');
  const confirmed=await call<Memory>(`/v1/memories/${candidate.id}`,'PUT',{version:candidate.version,status:'confirmed'});
  const c=await call<Conversation>('/v1/conversations','POST',{});expect(await chat(c.id,'confirmed')).toContain('主人喜欢茉莉花茶');expect(JSON.stringify(fixture.requests.at(-1)?.body)).toContain(candidate.sources[0]!.id);
  await call(`/v1/memories/${candidate.id}/delete`,'POST',{version:confirmed.version});
  const after=await chat(c.id,'deleted');expect(after).not.toContain('confirmed_memories');expect(after).not.toContain('主人喜欢茉莉花茶');
  expect((await call<ChatMessage[]>(`/v1/conversations/${a.id}/messages`))[0]!.content).toBe('我喜欢茉莉花茶');
  fixture.controls.memoryResponse='not json';
  const invalid=await call<MemoryTask>('/v1/memory-tasks/extract','POST',{conversationId:a.id,requestId:'invalid'});expect((await wait<MemoryTask>('/v1/memory-tasks/'+invalid.id)).error).toBe('INVALID_MODEL_OUTPUT');
  fixture.controls.memoryResponse=JSON.stringify({memories:[{kind:'fact',subject:'bad',content:'错误关联',importance:3,sources:[{type:'message',id:'wrong-message',quote:'伪造'}]}]});
  const wrong=await call<MemoryTask>('/v1/memory-tasks/extract','POST',{conversationId:a.id,requestId:'wrong'});expect((await wait<MemoryTask>('/v1/memory-tasks/'+wrong.id)).error).toBe('INVALID_MEMORY_SOURCE');
  fixture.controls.memoryResponse=undefined;fixture.controls.slowMemory=true;
  const slow=await call<MemoryTask>('/v1/memory-tasks/extract','POST',{conversationId:a.id,requestId:'cancel'});await delay(500);await call('/v1/memory-tasks/'+slow.id+'/cancel','POST');expect((await wait<MemoryTask>('/v1/memory-tasks/'+slow.id)).status).toBe('cancelled');fixture.controls.slowMemory=false;
  const date=new Date().toISOString().slice(0,10),d=await call<MemoryTask>('/v1/memory-tasks/diary','POST',{day:date,timezone:'UTC',requestId:'diary-1'}),diaryTask=await wait<MemoryTask>('/v1/memory-tasks/'+d.id);expect(diaryTask.status,JSON.stringify(diaryTask)).toBe('completed');const diary=diaryTask.result as Diary;expect(readFileSync(join(p.data,'diaries',diary.id+'.md'),'utf8')).toContain('今天完成了对话');
  await runtime.stop();runtime=await startRuntime(p);expect((await call<Diary[]>('/v1/diaries'))[0]!.id).toBe(diary.id);expect((await call<MemoryTask>('/v1/memory-tasks/extract','POST',{conversationId:a.id,requestId:'extract-1'})).id).toBe(task.id);
 }finally{await runtime.stop();await fixture.close();rmSync(root,{recursive:true,force:true});}
},60000);
