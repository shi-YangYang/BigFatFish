import {expect,it} from 'vitest';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {startRuntime} from '../../apps/runtime/src/lifecycle.js';
import {paths} from '../../apps/runtime/src/paths.js';
import {requestRuntime} from '../../apps/runtime/src/connection.js';
import type {ChatMessage} from '../../apps/runtime/src/ai/types.js';
import type {ChannelStatus,SendResult} from '../../apps/runtime/src/channels/types.js';
import {onebotFixture} from '../fixtures/onebot.js';
import {DatabaseSync} from 'node:sqlite';
import type { QQMessageIssue } from '../../apps/runtime/src/channels/types.js';
type DeliveryRecord=SendResult&{error?:string|null};
const until=async<T>(read:()=>Promise<T>,done:(v:T)=>boolean)=>{let v=await read();for(let i=0;i<300&&!done(v);i++){await delay(50);v=await read();}expect(done(v),JSON.stringify(v)).toBe(true);return v;};
const event=(id:string)=>({post_type:'message',message_type:'private',self_id:'10001',user_id:'20002',message_id:id,message:[{type:'text',data:{text:'你好'}}]});
it('keeps real model failure causes through DSH, Chat and QQ without claiming permission rejection or resending',async()=>{
 let mode:number|'network'|'ok'|'hold'=502,requests=0;
 const model=createServer(async(req,res)=>{for await(const _ of req){}requests++;if(mode==='network'){req.socket.destroy();return;}if(mode==='hold')return;if(typeof mode==='number'){res.writeHead(mode).end('PRIVATE_PROVIDER_ERROR sk-fixture-never-expose');return;}res.writeHead(200,{'content-type':'text/event-stream'});res.write(`data: ${JSON.stringify({id:'reply',object:'chat.completion.chunk',model:'fixture',choices:[{index:0,delta:{role:'assistant',content:'回复成功'},finish_reason:null}]})}\n\n`);res.end(`data: ${JSON.stringify({id:'reply',object:'chat.completion.chunk',model:'fixture',choices:[{index:0,delta:{},finish_reason:'stop'}]})}\n\ndata: [DONE]\n\n`);});
 model.listen(0,'127.0.0.1');await once(model,'listening');
 const p=paths(mkdtempSync(join(tmpdir(),'bff-qq-errors-'))),bot=await onebotFixture(),runtime=await startRuntime(p);
 const call=<T>(route:string,method='GET',body?:unknown)=>requestRuntime<T>(runtime.connection,route,method,body);
 const deliveries=()=>call<DeliveryRecord[]>('/v1/channels/qq/deliveries');
 const terminal=async(id:string)=>(await until(deliveries,items=>items.some(v=>v.id.endsWith(':'+id)&&!['queued','generating','sending'].includes(v.status)))).find(v=>v.id.endsWith(':'+id))!;
 try{
  await call('/v1/models','POST',{id:'fixture',label:'fixture',provider:'openai',baseURL:`http://127.0.0.1:${(model.address() as {port:number}).port}/v1`,model:'fixture',apiKey:'fixture-key'});await call('/v1/model-routes','PUT',{chat:'fixture'});
  await call('/v1/channels/qq','PUT',{revision:'',url:bot.url,token:'fixture-token',accountId:'10001',ownerId:'20002',groups:[],enabled:true,replyEnabled:true,proactiveEnabled:true});
  await until(()=>call<ChannelStatus>('/v1/channels/qq'),s=>s.health.state==='online');
  for(const [i,setting,code] of [['1',502,'MODEL_HTTP_502'],['2',401,'MODEL_HTTP_401'],['3',429,'MODEL_HTTP_429'],['4','network','MODEL_NETWORK_ERROR']] as const){
   mode=setting;bot.event(event(i));const item=await terminal(i);expect(item).toMatchObject({status:'failed',error:code});
  }
  const conversations=await call<{id:string}[]>('/v1/conversations');
  const messages=(await Promise.all(conversations.map(c=>call<ChatMessage[]>('/v1/conversations/'+c.id+'/messages')))).flat();
  expect(messages.filter(m=>m.role==='assistant').map(m=>m.error)).toEqual(expect.arrayContaining(['MODEL_HTTP_502','MODEL_HTTP_401','MODEL_HTTP_429','MODEL_NETWORK_ERROR']));
  expect(JSON.stringify(messages)).not.toContain('PRIVATE_PROVIDER_ERROR');expect(JSON.stringify(await deliveries())).not.toContain('fixture-key');
  expect(bot.requests.filter(r=>r.action.startsWith('send_'))).toHaveLength(0);
  mode='ok';bot.event(event('5'));expect(await terminal('5')).toMatchObject({status:'sent',error:null});
  const direct=()=>call<SendResult>('/v1/channels/qq/send','POST',{target:{kind:'private',id:'20002'},segments:[{type:'text',data:{text:'fixture'}}]});
  bot.controls.send='reject';const rejected=await direct();expect(rejected.status).toBe('failed');expect((await deliveries()).find(v=>v.id===rejected.id)).toMatchObject({error:'ACTION_REJECTED'});
  bot.controls.send='async';const unknown=await direct();expect(unknown.status).toBe('unknown');
  const sentCount=bot.requests.filter(r=>r.action.startsWith('send_')).length;
  mode='hold';const before=requests;bot.event(event('6'));await until(async()=>requests,n=>n>before);bot.event(event('7'));await until(deliveries,items=>items.some(v=>v.id.endsWith(':7')&&v.status==='queued'));
  await call('/v1/channels/qq/stop','POST');expect(await terminal('6')).toMatchObject({status:'interrupted',error:'CANCELLED'});expect(await terminal('7')).toMatchObject({status:'blocked',error:'PERMISSION_REVOKED'});
  expect(bot.requests.filter(r=>r.action.startsWith('send_'))).toHaveLength(sentCount);
 }finally{await runtime.stop();await bot.close();model.closeAllConnections();await new Promise<void>(r=>model.close(()=>r()));rmSync(p.root,{recursive:true,force:true});}
},60000);
it('lists the 20 newest QQ problems by operation, even after a busy successful day', async () => {
  const p = paths(mkdtempSync(join(tmpdir(), 'bff-qq-issue-list-')));
  const runtime = await startRuntime(p);
  const db = new DatabaseSync(p.database);
  const insert = db.prepare('INSERT INTO channel_deliveries(id,target,author,segments,status,error,created_at) VALUES(?,?,?,?,?,?,?)');
  const audit = db.prepare('INSERT INTO audit(event,at) VALUES(?,?)');
  const at = (minute: number) => new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString();
  const add = (id: string, status: string, error: string | null, minute: number) =>
    insert.run(id, '{"kind":"private","id":"20002"}', '20002', 'PRIVATE_MESSAGE', status, error, at(minute));
  const issues = () => requestRuntime<QQMessageIssue[]>(runtime.connection, '/v1/channels/qq/message-issues');
  try {
    for (const [status, error] of [['skipped', null], ['sent', null], ['blocked', 'PERMISSION_REVOKED'], ['interrupted', 'CANCELLED'], ['blocked', 'OLD_UNRECOGNIZED_STATUS']] as const) {
      add('hidden-' + status + error, status, error, 200);
    }
    expect(await issues()).toEqual([]);

    for (let i = 1; i <= 22; i++) add('test-' + i, 'failed', 'ACTION_REJECTED', i);
    add('legacy', 'blocked', 'MODEL_RUN_FAILED', 23);
    add('turn', 'unknown', 'REPLY_PARTIALLY_SENT', 24);
    add('turn:output:0', 'sent', null, 25);
    add('turn:output:1', 'unknown', 'SEND_UNKNOWN', 26);
    add('uncertain', 'unknown', 'RUNTIME_RESTARTED', 27);
    // After restart the parent no longer records partial delivery. A confirmed
    // segment from the neighbouring operation must not count for this one.
    add('restart1', 'interrupted', 'RUNTIME_RESTARTED', 28);
    add('restart1:output:0', 'sent', null, 29);
    add('restart1:output:1', 'unknown', 'RUNTIME_RESTARTED', 30);
    add('restart', 'interrupted', 'RUNTIME_RESTARTED', 31);
    add('restart:output:0', 'unknown', 'RUNTIME_RESTARTED', 32);
    for (let i = 0; i < 120; i++) {
      add('success-' + i, 'sent', null, i + 30);
      audit.run('qq.send.sent:success-' + i, at(i + 30));
    }

    const result = await issues();
    expect(result).toHaveLength(20);
    expect(result.slice(0, 5).map(row => row.kind)).toEqual(['unknown', 'partial_unknown', 'unknown', 'partial_unknown', 'reply_failed']);
    expect(result[1]?.at).toBe(at(30));
    expect(result[3]).toMatchObject({ at: at(26), target: { kind: 'private', id: '20002' } });
    expect(result.slice(5).every(row => row.kind === 'send_failed')).toBe(true);
    expect(result.at(-1)?.at).toBe(at(8));
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_MESSAGE|:output:|MODEL_RUN_FAILED/);

    const raw = await requestRuntime<{event: string}[]>(runtime.connection, '/v1/channels/qq/audit');
    expect(raw).toHaveLength(100);
    expect(raw[0]?.event).toBe('qq.send.sent:success-119');
    expect(await requestRuntime(runtime.connection, '/v1/permissions/audit')).toEqual(raw);
  } finally {
    db.close();
    await runtime.stop();
    rmSync(p.root, { recursive: true, force: true });
  }
});
