import { expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import websocket from '@fastify/websocket';
import { paths, preparePaths } from '../../apps/runtime/src/paths.js';
import { createServer } from '../../apps/runtime/src/server.js';
import { registerChatEvents } from '../../apps/runtime/src/ai/events.js';
import type { ChatService } from '../../apps/runtime/src/ai/chat.js';
import { mergeChatMessage } from '../../apps/desktop/src/chat-messages.js';

it('streams history larger than one frame with ordered live messages and cleans subscriptions', async () => {
 const root = mkdtempSync(join(tmpdir(),'bff events ')), p = paths(root); preparePaths(p);
 const connection = {version:1 as const,port:0,token:'a'.repeat(64),instanceId:'fixture',pid:process.pid,startedAt:new Date().toISOString()};
 const events = new EventEmitter(); const messages = Array.from({length:2500},(_,i)=>({id:String(i),content:'鱼'.repeat(1500),status:'completed',conversationId:'test'}));
 const chat = {events,conversation:()=>({}),messages:()=>messages,tools:()=>[]} as unknown as ChatService;
 const app = createServer(p,connection,()=>{}); await app.register(websocket); registerChatEvents(app,chat);
 await app.listen({port:0,host:'127.0.0.1'}); connection.port = (app.server.address() as {port:number}).port;
 const url = `http://127.0.0.1:${connection.port}/v1/events/stream?conversationId=test`;
 const abort = new AbortController();
 try {
  expect((await fetch(url)).status).toBe(401);
  expect((await fetch(url,{headers:{authorization:`Bearer ${connection.token}`,origin:'https://evil.invalid'}})).status).toBe(403);
  const response = await fetch(url,{headers:{authorization:`Bearer ${connection.token}`},signal:abort.signal}); expect(response.status).toBe(200);
  const reader = response.body!.getReader(), decoder = new TextDecoder(); let pending = '', seen = 0, ready = false, live = false, emitted = false;
  while (!ready) {
   const part = await reader.read(); expect(part.done).toBe(false); pending += decoder.decode(part.value,{stream:true});
   if (!emitted) { emitted=true; events.emit('message',{type:'message',conversationId:'test',message:{id:'new',content:'实时片段',status:'running'}}); events.emit('message',{type:'message',conversationId:'other',message:{id:'foreign'}}); }
   let index; while ((index=pending.indexOf('\n'))>=0) { const event=JSON.parse(pending.slice(0,index)); pending=pending.slice(index+1); if(event.type==='snapshot-message')seen++; if(event.type==='message'){expect(event.message.id).toBe('new');expect(seen).toBe(2500);live=true;} if(event.type==='ready')ready=true; }
  }
  expect(seen).toBe(2500); expect(live).toBe(true); await reader.cancel(); abort.abort();
  await new Promise(r=>setTimeout(r,30)); expect(events.listenerCount('message')).toBe(0);
 } finally { abort.abort(); await app.close(); rmSync(root,{recursive:true,force:true}); }
});
it('never downgrades a terminal message with a delayed running event', () => {
 const final = {id:'one',content:'完成',status:'completed'} as never;
 expect(mergeChatMessage([final],{id:'one',content:'旧片段',status:'running'} as never)).toEqual([final]);
});
