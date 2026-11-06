import { discoverModels, testModelConnection, MODEL_CONNECTION_TIMEOUT_MS } from './model-connection.js';
import {transcribe,synthesize} from './media.js';
import type { FastifyInstance, RouteShorthandOptions } from 'fastify';
import websocket from '@fastify/websocket';
import type { ChatService } from './chat.js';
import { registerChatEvents } from './events.js';
export async function registerAi(app: FastifyInstance, chat: ChatService) {
  await app.register(websocket, { options: { maxPayload: 1024 } });
  app.post('/v1/media/transcribe',async req=>transcribe(chat.config,req.body as {data:string;mimeType:string},AbortSignal.timeout(60000)));
  app.post('/v1/media/synthesize',async req=>synthesize(chat.config,req.body,AbortSignal.timeout(60000)));
  const modelConnectionTransport: RouteShorthandOptions = {
    // Extend only the authenticated handler wait, after the request body is read.
    preHandler: async req => { req.raw.socket.setTimeout?.(MODEL_CONNECTION_TIMEOUT_MS + 1000); },
    // Restore before writing either success or error; Node retains its normal
    // response/keep-alive lifecycle and later requests do not inherit the exception.
    onSend: async (req, _reply, payload) => {
      req.raw.socket.setTimeout?.(app.initialConfig.connectionTimeout ?? 0);
      return payload;
    },
  };
  app.post('/v1/models/discover', modelConnectionTransport, async req => discoverModels(chat.config, req.body));
  app.post('/v1/models/test', modelConnectionTransport, async req => testModelConnection(chat.config, req.body));
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
  app.get('/v1/conversations/local', async () => chat.conversations('local'));
  app.post('/v1/conversations', async req => chat.create(req.body));
  app.get<{ Params: { id: string } }>('/v1/conversations/:id/messages', async req => chat.messages(req.params.id));
  app.post<{ Params: { id: string } }>('/v1/conversations/:id/messages', async req => chat.send(req.params.id, req.body));
  app.post<{ Params: { id: string } }>('/v1/messages/:id/cancel', async req => chat.cancel(req.params.id));
  app.get<{ Params: { id: string } }>('/v1/messages/:id', async req => chat.message(req.params.id));
  registerChatEvents(app, chat);
}
