import { once } from 'node:events';
import type { FastifyInstance } from 'fastify';
import type { ChatService } from './chat.js';
const querystring = { type: 'object', required: ['conversationId'], properties: { conversationId: { type: 'string', maxLength: 100 } }, additionalProperties: false };
const LIMIT = 8_388_608;
/** Capture history and register live updates in one synchronous turn, then drain
 * bounded history batches with backpressure before forwarding queued live events. */
function subscribe(chat: ChatService, id: string, send: (event: unknown) => Promise<void>, disconnect: () => void) {
  chat.conversation(id);
  const messages = chat.messages(id), tools = chat.tools(id);
  let closed = false, loading = true, queuedBytes = 0, pending: unknown[] = [], tail = Promise.resolve();
  const close = () => { closed = true; pending = []; chat.events.off('message', listener); chat.events.off('tool', listener); };
  const fail = () => { close(); disconnect(); };
  const write = async (event: unknown) => { if (!closed) await send(event); };
  const listener = (event: { conversationId: string }) => {
    if (closed || event.conversationId !== id) return;
    const size = Buffer.byteLength(JSON.stringify(event)); queuedBytes += size;
    if (queuedBytes > LIMIT) { fail(); return; }
    if (loading) pending.push(event);
    else tail = tail.then(() => write(event)).then(() => { queuedBytes -= size; }).catch(fail);
  };
  chat.events.on('message', listener); chat.events.on('tool', listener);
  tail = (async () => {
    await write({ type: 'snapshot-start', conversationId: id });
    for (let i = 0; i < messages.length && !closed; i++) await write({ type: 'snapshot-message', conversationId: id, message: messages[i] });
    await write({ type: 'snapshot-end', conversationId: id, tools });
    while (pending.length && !closed) { const batch = pending; pending = []; for (const event of batch) { await write(event); queuedBytes -= Buffer.byteLength(JSON.stringify(event)); } }
    loading = false;
    await write({ type: 'ready', conversationId: id });
  })().catch(fail);
  return close;
}
export function registerChatEvents(app: FastifyInstance, chat: ChatService) {
  app.get<{ Querystring: { conversationId: string } }>('/v1/events', { websocket: true, schema: { querystring } }, (socket, req) => {
    let close = () => {};
    const send = (event: unknown) => new Promise<void>((resolve, reject) => {
      const data = JSON.stringify(event); if (Buffer.byteLength(data) > LIMIT || socket.bufferedAmount > LIMIT) { reject(new Error('STREAM_TOO_LARGE')); return; }
      socket.send(data, error => error ? reject(error) : resolve());
    });
    try { close = subscribe(chat, req.query.conversationId, send, () => socket.close(1013)); } catch { socket.close(1008); }
    socket.on('close', () => close()); socket.on('error', () => close());
  });
  app.get<{ Querystring: { conversationId: string } }>('/v1/events/stream', { schema: { querystring } }, (req, reply) => {
    chat.conversation(req.query.conversationId); req.raw.socket.setTimeout(0); reply.hijack();
    reply.raw.writeHead(200, { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    const cancelled = new AbortController();
    const send = async (event: unknown) => { const data = JSON.stringify(event); if (Buffer.byteLength(data) > LIMIT) throw new Error('STREAM_TOO_LARGE'); if (!reply.raw.write(data + '\n')) await once(reply.raw, 'drain', { signal: cancelled.signal }); };
    const close = subscribe(chat, req.query.conversationId, send, () => reply.raw.destroy());
    const heartbeat = setInterval(() => { if (reply.raw.writableLength === 0) void send({ type: 'heartbeat' }).catch(() => reply.raw.destroy()); }, 15000); heartbeat.unref();
    reply.raw.once('close', () => { cancelled.abort(); clearInterval(heartbeat); close(); });
  });
}
