import type { FastifyInstance } from 'fastify';
import type { Bilibili } from './service.js';
export function registerBilibili(app:FastifyInstance,bili:Bilibili){
  app.get('/v1/bilibili',async()=>bili.status());app.put('/v1/bilibili',async req=>bili.configure(req.body));
  app.post('/v1/bilibili/import',async req=>bili.import(req.body));app.post('/v1/bilibili/verify',async()=>bili.verify());app.post('/v1/bilibili/logout',async()=>bili.logout());
  app.post<{Params:{action:string};Body:{id?:string}}>('/v1/bilibili/login/:action',async req=>bili.login(req.params.action,req.body?.id));
  app.post('/v1/bilibili/search',async req=>bili.search(req.body));app.post('/v1/bilibili/read',async req=>bili.read(req.body));
  app.get('/v1/bilibili/tasks',async()=>bili.tasks());app.post('/v1/bilibili/tasks',async req=>bili.watch(req.body));
  app.get<{Params:{id:string}}>('/v1/bilibili/tasks/:id',async req=>bili.task(req.params.id));
  app.post<{Params:{id:string}}>('/v1/bilibili/tasks/:id/cancel',async req=>bili.cancel(req.params.id));
  app.post<{Params:{id:string}}>('/v1/bilibili/tasks/:id/share',{preHandler:async req=>{req.raw.socket.setTimeout(45000);},onSend:async(req,_reply,payload)=>{req.raw.socket.setTimeout(app.initialConfig.connectionTimeout??0);return payload;}},async req=>bili.share(req.params.id,req.body));
}
