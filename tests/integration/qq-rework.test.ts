import { expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';
import { DSHAdapter } from '../../apps/runtime/src/ai/dsh.js';
import { SecretStore } from '../../apps/runtime/src/ai/secrets.js';
import type { ChatMessage } from '../../apps/runtime/src/ai/types.js';
import { startRuntime } from '../../apps/runtime/src/lifecycle.js';
import { paths } from '../../apps/runtime/src/paths.js';
import { requestRuntime } from '../../apps/runtime/src/connection.js';
import type { Approval, ChannelStatus } from '../../apps/runtime/src/channels/types.js';
import type { Memory } from '../../apps/runtime/src/memory/types.js';
import { onebotFixture } from '../fixtures/onebot.js';

const marker = 'SHARED_DELIVERY_MARKER';
const model = {id:'test',label:'测试',provider:'openai',baseURL:'http://127.0.0.1:1/v1',model:'fixture',contextWindow:32768,maxTokens:1024,timeoutMs:10000,vision:false};
const wait = async <T>(read:()=>Promise<T>,done:(v:T)=>boolean) => {
  let value = await read();
  for(let i=0;i<200&&!done(value);i++){await delay(10);value=await read();}
  expect(done(value),JSON.stringify(value)).toBe(true);return value;
};
type Delivery = {id:string;status:string;error:string|null;messageId:string|null};
const event = (id:string,kind='group') => ({post_type:'message',message_type:kind,self_id:'10001',user_id:'20002',group_id:'30003',message_id:id,message:[...(kind==='group'?[{type:'at',data:{qq:'10001'}}]:[]),{type:'text',data:{text:'茶'}}]});

it('binds the actual generated memory scope through the final asynchronous health check',async()=>{
  const usedContexts:string[]=[];
  const engine=vi.spyOn(DSHAdapter.prototype,'run').mockImplementation(async input=>{
    usedContexts.push(input.context??'');input.onSessionReady();
    const reply=input.context?.includes(marker)?`引用 ${marker}`:'普通回复';input.onText(reply);return reply;
  });
  const p=paths(mkdtempSync(join(tmpdir(),'bff-qq-scope-'))),bot=await onebotFixture(),runtime=await startRuntime(p);
  try {
    const call=<T>(url:string,method='GET',body?:unknown)=>requestRuntime<T>(runtime.connection,url,method,body);
    await call('/v1/models','POST',model);await call('/v1/model-routes','PUT',{chat:'test'});
    const memory=await call<Memory>('/v1/memories','POST',{kind:'fact',subject:'茶',content:`茶 ${marker}`,importance:5});
    const visibility=async(value:string)=>{const current=await call<Memory>('/v1/memories/'+memory.id);await call('/v1/memories/'+memory.id,'PUT',{version:current.version,visibility:value});};
    await visibility('shared');
    await call('/v1/channels/qq','PUT',{url:bot.url,accountId:'10001',ownerId:'20002',groups:['30003'],enabled:true,replyEnabled:true,proactiveEnabled:true,token:'fixture-token',revision:''});
    await wait(()=>call<ChannelStatus>('/v1/channels/qq'),s=>s.health.state==='online');
    const sends=()=>bot.requests.filter(r=>r.action.startsWith('send_'));
    const terminal=async(id:string)=>{const rows=await wait(()=>call<Delivery[]>('/v1/channels/qq/deliveries'),ds=>ds.some(d=>(d.id===id||d.id.endsWith(':'+id))&&!['queued','generating','sending'].includes(d.status)));return rows.find(d=>(d.id===id||d.id.endsWith(':'+id)))!;};
    const pending=async(id:string,kind='group')=>{
      const gate=bot.pauseNextLogin();bot.event(event(id,kind));await gate.reached;
      const conversations=await call<{id:string}[]>('/v1/conversations');
      const messages=(await Promise.all(conversations.map(c=>call<ChatMessage[]>('/v1/conversations/'+c.id+'/messages')))).flat();
      expect(messages.some(m=>m.role==='assistant'&&m.status==='completed'&&m.content.includes(marker))).toBe(true);
      expect(usedContexts.at(-1)).toContain(marker);
      expect((await call<Delivery[]>('/v1/channels/qq/deliveries')).find(d=>d.id.endsWith(':'+id))?.status).toBe('sending');
      return gate;
    };
    // Successful control: the same fully generated response can pass unchanged.
    const first=await pending('1');expect(sends()).toHaveLength(0);first.release();
    expect((await terminal('1')).status).toBe('sent');expect(JSON.stringify(sends()[0]!.params.message)).toContain(marker);
    // Exact former leak: generation finished, health is suspended, no send_* yet.
    const revoked=await pending('2');expect(sends()).toHaveLength(1);
    await visibility('private');expect(sends()).toHaveLength(1);revoked.release();
    expect(await terminal('2')).toMatchObject({status:'blocked',error:'MEMORY_SCOPE_CHANGED',messageId:null});
    expect(sends()).toHaveLength(1);
    // A later generation starts with the new scope; it cannot reuse the old output.
    bot.event(event('3'));expect((await terminal('3')).status).toBe('sent');
    expect(usedContexts.at(-1)).not.toContain(marker);expect(JSON.stringify(sends().at(-1)!.params.message)).not.toContain(marker);
    // Owner access is independent of sharing with a group.
    await visibility('shared');const owner=await pending('4','private');await visibility('private');owner.release();
    expect((await terminal('4')).status).toBe('sent');expect(JSON.stringify(sends().at(-1)!.params.message)).toContain(marker);
    // Explicitly approved text has its own authority; it is not model-generated.
    const approval=await call<Approval>('/v1/permissions/approvals','POST',{target:{kind:'group',id:'30003'},segments:[{type:'text',data:{text:marker}}]});
    const proactive=bot.pauseNextLogin();await call('/v1/permissions/approvals/'+approval.id,'POST',{decision:'approve',digest:approval.digest});await proactive.reached;
    await visibility('shared');proactive.release();expect((await terminal(approval.id)).status).toBe('sent');
    expect(sends()).toHaveLength(4);
  } finally {await runtime.stop();await bot.close();engine.mockRestore();rmSync(p.root,{recursive:true,force:true});}
});

it('rejects invalid header tokens atomically and keeps Runtime repairable with an old encrypted invalid token',async()=>{
  const engine=vi.spyOn(DSHAdapter.prototype,'run').mockImplementation(async input=>{input.onSessionReady();input.onText('本地聊天可用');return '本地聊天可用';});
  const p=paths(mkdtempSync(join(tmpdir(),'bff-qq-token-'))),bot=await onebotFixture();let runtime=await startRuntime(p);
  try {
    const call=<T>(url:string,method='GET',body?:unknown)=>requestRuntime<T>(runtime.connection,url,method,body);
    const config={url:bot.url,accountId:'10001',ownerId:'20002',groups:[],enabled:true,replyEnabled:true,proactiveEnabled:false};
    const before=await call<ChannelStatus>('/v1/channels/qq','PUT',{...config,token:'fixture-token',revision:''});
    await wait(()=>call<ChannelStatus>('/v1/channels/qq'),s=>s.health.state==='online');
    const socket=[...bot.clients][0],key=readFileSync(join(p.config,'master.key'));
    const readRow=()=>{const db=new DatabaseSync(p.database);try{return db.prepare("SELECT * FROM plugin_config WHERE id='qq'").get();}finally{db.close();}};
    const oldRow=readRow();
    for(const token of ['中文凭据','emoji🐟','bad\r\nheader','bad\u0000token']){
      await expect(call('/v1/channels/qq','PUT',{...config,ownerId:'99999',token,revision:before.revision})).rejects.toThrow('INVALID_TOKEN');
      expect(readRow()).toEqual(oldRow);expect(readFileSync(join(p.config,'master.key'))).toEqual(key);
      expect(await call<ChannelStatus>('/v1/channels/qq')).toMatchObject({revision:before.revision,config:before.config,health:{state:'online'}});
      expect([...bot.clients]).toEqual([socket]);
    }
    await call('/v1/models','POST',model);await call('/v1/model-routes','PUT',{chat:'test'});
    await runtime.stop();
    // Seed an actually encrypted legacy value, bypassing only the fixed save API.
    const secret=new SecretStore(p,true).encrypt('中文凭据'),db=new DatabaseSync(p.database);
    try{db.prepare("UPDATE plugin_config SET secret=? WHERE id='qq'").run(secret);}finally{db.close();}
    runtime=await startRuntime(p);
    expect(await call('/v1/status')).toMatchObject({state:'running'});
    expect(await call('/v1/channels/qq')).toMatchObject({hasToken:true,health:{state:'error',error:'INVALID_TOKEN'}});
    const conversation=await call<{id:string}>('/v1/conversations','POST',{});
    const reply=await call<ChatMessage>('/v1/conversations/'+conversation.id+'/messages','POST',{requestId:'local',content:'你好'});
    expect(await wait(()=>call<ChatMessage>('/v1/messages/'+reply.id),m=>!['queued','running'].includes(m.status))).toMatchObject({status:'completed',content:'本地聊天可用'});
    const stopped=await call<ChannelStatus>('/v1/channels/qq/stop','POST');
    expect(stopped).toMatchObject({config:{enabled:false},health:{state:'stopped'}});
    expect(readRow()?.secret).toBe(secret);
    await expect(call('/v1/channels/qq/start','POST')).rejects.toThrow('INVALID_TOKEN');
    expect(await call('/v1/channels/qq')).toEqual(stopped);
    await call('/v1/channels/qq','PUT',{...config,revision:stopped.revision,token:'fixture-token'});
    await wait(()=>call<ChannelStatus>('/v1/channels/qq'),s=>s.health.state==='online');
    expect(readFileSync(join(p.config,'master.key'))).toEqual(key);
  } finally {await runtime.stop();await bot.close();engine.mockRestore();rmSync(p.root,{recursive:true,force:true});}
});
