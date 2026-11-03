import {transcribe,synthesize} from './media.js';
import type { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import type { ChatService } from './chat.js';
import type { ChatEvent } from './types.js';
export async function registerAi(app: FastifyInstance, chat: ChatService) {
  await app.register(websocket, { options: { maxPayload: 1024 } });
  app.post('/v1/media/transcribe',async req=>transcribe(chat.config,req.body as {data:string;mimeType:string},AbortSignal.timeout(60000)));
  app.post('/v1/media/synthesize',async req=>synthesize(chat.config,req.body,AbortSignal.timeout(60000)));
  app.get('/v1/models', async () => chat.config.models());
  app.post('/v1/models', async req => chat.config.saveModel(req.body));
  app.delete<{ Params: { id: string } }>('/v1/models/:id', async req => chat.config.deleteModel(req.params.id));
  app.get('/v1/model-routes', async () => chat.config.routes());
  app.put('/v1/model-routes', async req => chat.config.saveRoutes(req.body));
  app.get('/v1/persona', async () => chat.config.persona());
  app.put('/v1/persona', async req => chat.config.savePersona(req.body));
  app.get('/v1/persona/history', async () => chat.config.history());
  app.get<{Params:{id:string}}>('/v1/conversations/:id/tools',async req=>chat.tools(req.params.id));
  app.get('/v1/conversations', async () => chat.conversations());
  app.post('/v1/conversations', async req => chat.create(req.body));
  app.get<{ Params: { id: string } }>('/v1/conversations/:id/messages', async req => chat.messages(req.params.id));
  app.post<{ Params: { id: string } }>('/v1/conversations/:id/messages', async req => chat.send(req.params.id, req.body));
  app.post<{ Params: { id: string } }>('/v1/messages/:id/cancel', async req => chat.cancel(req.params.id));
  app.get<{ Params: { id: string } }>('/v1/messages/:id', async req => chat.message(req.params.id));
  app.get<{ Querystring: { conversationId: string } }>('/v1/events', { websocket: true, schema: { querystring: { type: 'object', required: ['conversationId'], properties: { conversationId: { type: 'string', maxLength: 100 } }, additionalProperties: false } } }, (socket, req) => {
    try { chat.conversation(req.query.conversationId); } catch { socket.close(1008); return; }
    const listener = (event: ChatEvent) => { if (event.conversationId !== req.query.conversationId) return; if (socket.bufferedAmount > 1048576) { socket.close(1013); return; } socket.send(JSON.stringify(event)); };
    chat.events.on('tool',listener);chat.events.on('message', listener); socket.on('close', () => {chat.events.off('message', listener);chat.events.off('tool',listener);}); socket.on('error', () => {chat.events.off('message', listener);chat.events.off('tool',listener);});
    socket.send(JSON.stringify({ type: 'ready', conversationId: req.query.conversationId }));
  });
}
