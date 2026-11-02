import type { FastifyInstance } from 'fastify';
import type { LifeService } from './life.js';
export function registerLife(app: FastifyInstance, life: LifeService) {
  app.get('/v1/life/updates',async()=>life.updates());
  app.get('/v1/life',async()=>life.overview());
  app.get('/v1/life/timeline',async()=>life.memories.timeline());
  app.post('/v1/life/source',async req=>life.source(req.body));
  app.get('/v1/life/moods',async()=>life.moods());
  app.get('/v1/memories',async()=>life.memories.list());
  app.post('/v1/memories/search',async req=>life.memories.list(req.body));
  app.post('/v1/memories',async req=>life.memories.create(req.body));
  app.post('/v1/memories/export',async req=>life.export(req.body));
  app.get<{Params:{id:string}}>('/v1/memories/:id',async req=>life.memories.get(req.params.id));
  app.put<{Params:{id:string}}>('/v1/memories/:id',async req=>life.memories.update(req.params.id,req.body));
  app.post<{Params:{id:string}}>('/v1/memories/:id/merge',async req=>life.memories.merge(req.params.id,req.body));
  app.post<{Params:{id:string}}>('/v1/memories/:id/delete',async req=>life.memories.delete(req.params.id,req.body));
  app.post('/v1/memory-tasks/extract',async req=>life.start('extract',req.body));
  app.post('/v1/memory-tasks/diary',async req=>life.start('diary',req.body));
  app.get('/v1/memory-tasks',async()=>life.tasks());
  app.get<{Params:{id:string}}>('/v1/memory-tasks/:id',async req=>life.task(req.params.id));
  app.post<{Params:{id:string}}>('/v1/memory-tasks/:id/cancel',async req=>life.cancel(req.params.id));
  app.get('/v1/diaries',async()=>life.diaries());
  app.post<{Params:{id:string}}>('/v1/diaries/:id/rebuild',async req=>life.rebuild(req.params.id));
}
