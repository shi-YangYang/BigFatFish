import type { FastifyInstance } from 'fastify';
import type { Channels } from './service.js';
export function registerChannels(app:FastifyInstance,channels:Channels){
  app.get('/v1/channels/qq',async()=>channels.status());
  app.put('/v1/channels/qq',async req=>channels.save(req.body));
  app.post('/v1/channels/qq/start',async()=>channels.enable(true));
  app.post('/v1/channels/qq/stop',async()=>channels.enable(false));
  app.get('/v1/channels/qq/deliveries',async()=>channels.deliveries());
  app.get('/v1/permissions/audit',async()=>channels.auditLog());
  app.get('/v1/permissions/approvals',async()=>channels.approvals());
  app.post('/v1/permissions/approvals',async req=>channels.propose(req.body));
  app.post<{Params:{id:string}}>('/v1/permissions/approvals/:id',async req=>channels.decide(req.params.id,req.body));
}
