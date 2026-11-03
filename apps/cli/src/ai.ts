import {readInput as input} from './input.js';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { readConnection, requestRuntime } from '../../runtime/src/connection.js';
import type { DataPaths } from '../../runtime/src/paths.js';
import type { ChatMessage, Conversation } from '../../runtime/src/ai/types.js';
export async function aiCommand(p: DataPaths, args: string[], json: boolean, output: (v: unknown) => void) {
  const connection = readConnection(p), [command, action, id] = args;
  const call = <T>(path: string, method = 'GET', body?: unknown) => requestRuntime<T>(connection, path, method, body);
  if (command === 'models') {
    if (action === 'set') output(await call('/v1/models','POST',await input()));
    else if (action === 'delete' && id) output(await call(`/v1/models/${encodeURIComponent(id)}`, 'DELETE'));
    else if (!action || action === 'list') output(await call('/v1/models'));
    else throw new Error('INVALID_ARGUMENTS');
  } else if (command === 'routes' || command === 'persona') {
    const path = command === 'routes' ? '/v1/model-routes' : '/v1/persona';
    if (action === 'set') output(await call(path,'PUT',await input()));
    else if (action === 'history' && command === 'persona') output(await call(path + '/history'));
    else if (!action || action === 'get') output(await call(path)); else throw new Error('INVALID_ARGUMENTS');
  } else if (command === 'sessions') {
    if (action === 'create') output(await call('/v1/conversations','POST',await input()));
    else if (action === 'tools' && id) output(await call(`/v1/conversations/${encodeURIComponent(id)}/tools`));
    else if (action === 'messages' && id) output(await call(`/v1/conversations/${encodeURIComponent(id)}/messages`));
    else if (!action || action === 'list') output(await call('/v1/conversations')); else throw new Error('INVALID_ARGUMENTS');
  } else if (command === 'cancel' && action) output(await call(`/v1/messages/${encodeURIComponent(action)}/cancel`, 'POST'));
  else if (command === 'chat') {
    const body = await input() as { conversationId?: string; modelId?: string; content: string; requestId?: string };
    const conversationId = body.conversationId ?? (await call<Conversation>('/v1/conversations','POST',{ modelId: body.modelId })).id;
    const socket = new WebSocket(`ws://127.0.0.1:${connection.port}/v1/events?conversationId=${encodeURIComponent(conversationId)}`, { headers: { authorization: `Bearer ${connection.token}` } });
    let socketError = false;
    socket.on('error', () => { socketError = true; });
    let messageId = '', previous = '';
    socket.on('message', raw => { const e = JSON.parse(raw.toString()); if(e.type==='tool'){if(json)output(e);else process.stdout.write(`\n[工具 ${e.name}: ${e.state}]\n`);return;} if (e.message?.id !== messageId) return; if (json) output(e); else { const text = e.message.content as string; if (!text.startsWith(previous)) process.stdout.write('\n[回复重新生成]\n'); process.stdout.write(text.startsWith(previous) ? text.slice(previous.length) : text); previous = text; } });
    try {
      await new Promise<void>((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
      const created = await call<ChatMessage>(`/v1/conversations/${conversationId}/messages`, 'POST', { content: body.content, requestId: body.requestId ?? randomUUID() });
      messageId = created.id;
      const cancel = () => { void call(`/v1/messages/${messageId}/cancel`, 'POST').catch(() => {}); };
      process.once('SIGINT', cancel);
      try {
        let message = created;
        while (['queued','running'].includes(message.status)) { await delay(200); message = await call(`/v1/messages/${messageId}`); }
        if (json) output({ conversationId, message, streamDisconnected: socketError });
        else { if (message.content !== previous) process.stdout.write(message.content.startsWith(previous) ? message.content.slice(previous.length) : '\n' + message.content); process.stdout.write('\n'); if (message.error) output({ error: message.error, conversationId }); }
        if (message.status !== 'completed') process.exitCode = 1;
      } finally { process.removeListener('SIGINT', cancel); }
    } finally { socket.close(); }
  } else throw new Error('INVALID_ARGUMENTS');
}
