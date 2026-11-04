import type { FastifyInstance } from 'fastify';
import { InputError,object } from '../ai/types.js';
import type { Channels } from './service.js';
export function registerChannels(app:FastifyInstance,channels:Channels,managedStart?:()=>unknown){
  app.get('/v1/channels/qq/sticker-options',async()=>channels.stickers.options());
  app.put('/v1/channels/qq/sticker-options',async req=>channels.stickers.saveOptions(req.body));
  app.get('/v1/channels/qq/stickers',async()=>channels.stickers.list());
  app.post('/v1/channels/qq/stickers',async req=>channels.stickers.add(req.body));
  app.get<{Params:{id:string}}>('/v1/channels/qq/stickers/:id/image',async req=>channels.stickers.image(req.params.id));
  app.put<{Params:{id:string}}>('/v1/channels/qq/stickers/:id',async req=>channels.stickers.update(req.params.id,req.body));
  app.delete<{Params:{id:string}}>('/v1/channels/qq/stickers/:id',async req=>channels.stickers.remove(req.params.id));
  app.get('/v1/channels/qq',async()=>channels.status());
  app.put('/v1/channels/qq',async req=>{if(object(req.body).mode==='managed')throw new InputError('QQ_MANAGED_CONFIGURATION_REQUIRED');return channels.save(req.body);});
  app.post('/v1/channels/qq/start',async()=>channels.status().config?.mode==='managed'&&managedStart?{...channels.status(),component:managedStart()}:channels.enable(true));
  app.post('/v1/channels/qq/stop',async()=>channels.enable(false));
  app.get('/v1/channels/qq/deliveries',async()=>channels.deliveries());
  app.post('/v1/channels/qq/send',{preHandler:async req=>{req.raw.socket.setTimeout(45000);},onSend:async(req,_reply,payload)=>{req.raw.socket.setTimeout(app.initialConfig.connectionTimeout??0);return payload;}},async req=>channels.send(req.body));
  app.get('/v1/channels/qq/audit',async()=>channels.auditLog());
  app.get('/v1/permissions/audit',async()=>channels.auditLog());
  const removed=async()=>{throw new InputError('QQ_APPROVAL_REMOVED',410);};
  app.get('/v1/permissions/approvals',removed);
  app.post('/v1/permissions/approvals',removed);
  app.post('/v1/permissions/approvals/:id',removed);
}
