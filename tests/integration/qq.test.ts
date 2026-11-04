import { expect, it } from 'vitest';
import { mkdtempSync, rmSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';
import { startRuntime } from '../../apps/runtime/src/lifecycle.js';
import { paths } from '../../apps/runtime/src/paths.js';
import { requestRuntime } from '../../apps/runtime/src/connection.js';
import type { ChannelStatus, SendResult } from '../../apps/runtime/src/channels/types.js';
import type { Memory } from '../../apps/runtime/src/memory/types.js';
import { fixtureModel } from '../fixtures/model.mjs';
import { onebotFixture } from '../fixtures/onebot.js';
const wait=async<T>(read:()=>Promise<T>,done:(v:T)=>boolean)=>{let result=await read();for(let i=0;i<300&&!done(result);i++){await delay(50);result=await read();}expect(done(result),JSON.stringify(result)).toBe(true);return result;};
const event=(id:string,kind='private',user='20002',group='30003',text='茶')=>({post_type:'message',message_type:kind,self_id:'10001',user_id:user,group_id:group,message_id:id,sender:{nickname:'主人'},message:[...(kind==='group'?[{type:'at',data:{qq:'10001'}}]:[]),{type:'text',data:{text}}]});
it('real DSH QQ channel: owner memory, group isolation, source identity, durable dedupe, revocation and direct delivery',async()=>{
 const p=paths(mkdtempSync(join(tmpdir(),'bff-qq-'))),bot=await onebotFixture(),model=await fixtureModel();let runtime=await startRuntime(p);
 try{
  const call=<T>(url:string,method='GET',body?:unknown)=>requestRuntime<T>(runtime.connection,url,method,body),status=()=>call<ChannelStatus>('/v1/channels/qq');
  const configure=async(patch:object={})=>{const s=await status();return call<ChannelStatus>('/v1/channels/qq','PUT',{url:bot.url,accountId:'10001',ownerId:'20002',groups:['30003'],groupReplyMode:'mention',enabled:true,replyEnabled:true,proactiveEnabled:true,...s.config,revision:s.revision,token:'fixture-token',...patch});};
  const online=()=>wait(status,s=>s.health.state==='online');
  const deliveries=()=>call<{id:string;status:string;error:string|null}[]>('/v1/channels/qq/deliveries');
  const terminal=(id:string)=>wait(deliveries,ds=>ds.some(d=>d.id.endsWith(':'+id)&&!['queued','generating','sending'].includes(d.status)));
  const sends=()=>bot.requests.filter(r=>r.action.startsWith('send_'));
  await call('/v1/models','POST',{id:'test',label:'QQ测试',provider:'openai',baseURL:model.url,model:'fixture-model',contextWindow:32768,maxTokens:1024,timeoutMs:20000,vision:false});await call('/v1/model-routes','PUT',{chat:'test'});
  const privateMemory=await call<Memory>('/v1/memories','POST',{kind:'fact',subject:'茶',content:'茶 PRIVATE_SECRET_MARKER',importance:5});
  const shared=await call<Memory>('/v1/memories','POST',{kind:'fact',subject:'茶',content:'茶 SHARED_MARKER',importance:4,allowConflict:true});await call('/v1/memories/'+shared.id,'PUT',{version:shared.version,visibility:'shared',allowConflict:true});
  await configure();await online();expect((await status()).hasToken).toBe(true);expect(JSON.stringify(await status())).not.toContain('fixture-token');
  bot.event(event('1'));await terminal('1');expect(JSON.stringify(model.requests.at(-1)?.body)).toContain('PRIVATE_SECRET_MARKER');expect(sends()).toHaveLength(1);expect(sends()[0]!.params.message).toEqual([{type:'reply',data:{id:'1'}},{type:'text',data:{text:'测试模型回复'}}]);
  bot.event(event('2','group','40004','30003','我喜欢茉莉花茶'));await terminal('2');const groupPrompt=JSON.stringify(model.requests.at(-1)?.body);expect(groupPrompt).not.toContain('PRIVATE_SECRET_MARKER');expect(groupPrompt).toContain('SHARED_MARKER');expect(groupPrompt).toContain('qq-user:40004');
  const sessions=await call<{id:string;title:string}[]>('/v1/conversations'),groupSession=sessions.find(s=>s.title.includes('群'))!;const task=await call<{id:string}>('/v1/memory-tasks/extract','POST',{conversationId:groupSession.id,requestId:'group-extract'});const extracted=await wait(()=>call<{status:string;result:Memory[]}>('/v1/memory-tasks/'+task.id),t=>!['queued','running'].includes(t.status));expect(extracted.result[0]!.subject).toContain('qquser40004');expect(extracted.result[0]!.content).not.toContain('主人');expect(extracted.result[0]!.status).toBe('candidate');expect(extracted.result[0]!.sources[0]!.author).toBe('qq-user:40004');
  bot.event(event('1'));bot.event(event('3','private','40004'));bot.event(event('4','group','40004','99999'));bot.event(event('5','private','10001'));bot.event({...event('6','group'),message:[{type:'text',data:{text:'@10001 主人'}}]});await delay(250);expect(sends()).toHaveLength(2);
  await configure({friendIds:['40004'],groupReplyMode:'all'});await online();
  bot.event(event('61','private','40004'));await terminal('61');const friendPrompt=JSON.stringify(model.requests.at(-1)?.body);expect(friendPrompt).not.toContain('PRIVATE_SECRET_MARKER');expect(friendPrompt).toContain('SHARED_MARKER');expect(friendPrompt).toContain('qq-user:40004');
  bot.event({...event('62','group','40004'),message:[{type:'text',data:{text:'茶'}}]});await terminal('62');
  expect((await status()).config).toMatchObject({ownerId:'20002',friendIds:['40004'],groupReplyMode:'all'});
  // Same public session cannot retain formerly shared memory.
  const sm=await call<Memory>('/v1/memories/'+shared.id);await call('/v1/memories/'+shared.id,'PUT',{version:sm.version,visibility:'private',allowConflict:true});bot.event(event('7','group','40004'));await terminal('7');expect(JSON.stringify(model.requests.at(-1)?.body)).not.toContain('SHARED_MARKER');
  // Old owner is now group participant; neither old DSH history nor private memory can cross.
  await configure({ownerId:'50005'});await online();bot.event(event('8','group','20002'));await terminal('8');expect(JSON.stringify(model.requests.at(-1)?.body)).not.toContain('PRIVATE_SECRET_MARKER');bot.event(event('9'));await delay(150);expect((await deliveries()).some(d=>d.id.endsWith(':9'))).toBe(false);
  // Revocation while generating cancels model work and blocks late send.
  const before=sends().length;bot.event(event('10','group','40004','30003','SLOW_NOW'));await wait(()=>Promise.resolve(model.requests),rs=>JSON.stringify(rs.at(-1)?.body).includes('SLOW_NOW'));await configure({groups:[]});await terminal('10');expect(sends()).toHaveLength(before);await online();
  const proposal={target:{kind:'private',id:'50005'},segments:[{type:'text',data:{text:'主动发送内容'}}]};
  for(const [path,method] of [['/v1/permissions/approvals','GET'],['/v1/permissions/approvals','POST'],['/v1/permissions/approvals/old','POST']])await expect(call(path!,method!,proposal)).rejects.toThrow('QQ_APPROVAL_REMOVED');
  const sent=await call<SendResult>('/v1/channels/qq/send','POST',proposal);expect(sent.status).toBe('sent');
  expect((await deliveries()).find(item=>item.id===sent.id)?.status).toBe('sent');
  await configure({proactiveEnabled:false});await expect(call('/v1/channels/qq/send','POST',proposal)).rejects.toThrow('PERMISSION_REVOKED');await online();
  // Old persisted pending approvals remain inert across restart.
  const db=new DatabaseSync(p.database);db.prepare("INSERT INTO approvals(id,plugin,payload,digest,revision,expires_at,status,created_at) VALUES('old-qq','qq',?,'digest','old',?,'pending',?)").run(JSON.stringify(proposal),Date.now()+300000,new Date().toISOString());db.close();
  // Restart persists de-duplication; old message 1 never re-executes even after owner role changes.
  await configure({ownerId:'20002'});await online();await runtime.stop();runtime=await startRuntime(p);await online();const n=sends().length;bot.event(event('1'));await delay(150);expect(sends()).toHaveLength(n);expect((await call<Memory>('/v1/memories/'+privateMemory.id)).visibility).toBe('private');
  expect(JSON.stringify(await call('/v1/permissions/audit'))).not.toContain('主动发送内容');
 }finally{await runtime.stop();await bot.close();await model.close();rmSync(p.root,{recursive:true,force:true});}
},90000);
it('protocol health, auth, retcode, reconnect, unknown delivery and missing platform-only master key',async()=>{
 const p=paths(mkdtempSync(join(tmpdir(),'bff-qq-protocol-'))),bot=await onebotFixture();const runtime=await startRuntime(p);
 try{
  const call=<T>(url:string,method='GET',body?:unknown)=>requestRuntime<T>(runtime.connection,url,method,body),status=()=>call<ChannelStatus>('/v1/channels/qq');
  const configure=async(patch:object={})=>{const s=await status();return call('/v1/channels/qq','PUT',{url:bot.url,accountId:'10001',ownerId:'20002',groups:[],enabled:true,replyEnabled:true,proactiveEnabled:true,revision:s.revision,token:'fixture-token',...patch});};
  bot.controls.online=false;await configure();await wait(status,s=>s.health.state==='not_logged_in');expect(bot.requests.some(r=>r.action==='get_version_info')).toBe(true);
  await configure({token:'wrong'});await wait(status,s=>s.health.error==='TOKEN_REJECTED');
  bot.controls.online=true;await configure({accountId:'88888'});await wait(status,s=>s.health.error==='ACCOUNT_MISMATCH');await configure();await wait(status,s=>s.health.state==='online');
  const send=()=>call<SendResult>('/v1/channels/qq/send','POST',{target:{kind:'private',id:'20002'},segments:[{type:'text',data:{text:'test'}}]});
  for(const [mode,result] of [['reject','failed'],['async','unknown'],['malformed','unknown'],['silent','unknown']]){bot.controls.send=mode!;expect((await send()).status).toBe(result);}
  const count=bot.requests.filter(r=>r.action.startsWith('send_')).length;bot.disconnect();await wait(status,s=>s.health.state==='reconnecting');await wait(status,s=>s.health.state==='online');expect(bot.requests.filter(r=>r.action.startsWith('send_'))).toHaveLength(count);
  bot.controls.send='ok';
  const png='base64://iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=';
  const media=await call<SendResult>('/v1/channels/qq/send','POST',{target:{kind:'private',id:'20002'},segments:[{type:'image',data:{file:png}}]});expect(media.status).toBe('sent');expect(bot.requests.filter(r=>r.action.startsWith('send_')).at(-1)!.params.message).toEqual([{type:'image',data:{file:png}}]);
  await expect(call('/v1/channels/qq/send','POST',{target:{kind:'private',id:'20002'},segments:[{type:'image',data:{file:'/etc/passwd'}}]})).rejects.toThrow('UNSAFE_MEDIA_REFERENCE');
  // Revoke during the per-send asynchronous account check.
  bot.controls.send='ok';bot.controls.healthDelay=200;const pending=send();await delay(40);await call('/v1/channels/qq/stop','POST');await pending;await delay(250);expect(bot.requests.filter(r=>r.action.startsWith('send_'))).toHaveLength(count+1);expect((await status()).health.state).toBe('stopped');
  await runtime.stop();unlinkSync(join(p.config,'master.key'));await expect(startRuntime(p)).rejects.toThrow('MASTER_KEY_MISSING');expect(existsSync(join(p.config,'master.key'))).toBe(false);
 }finally{await runtime.stop();await bot.close();rmSync(p.root,{recursive:true,force:true});}
},60000);
