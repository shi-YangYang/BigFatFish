import type { FastifyInstance } from 'fastify';
import type { Douyin } from './service.js';
import type { Activities } from '../tasks/service.js';
export function registerDouyin(app:FastifyInstance,d:Douyin,a:Activities){
 app.get('/v1/douyin',async()=>d.status());app.put('/v1/douyin',async r=>d.configure(r.body));app.get('/v1/douyin/browsers',async()=>d.discover());app.post('/v1/douyin/close',async()=>d.stop());
 app.post('/v1/douyin/read',async r=>d.read(r.body));app.post('/v1/douyin/watch',async r=>d.watch(r.body));app.post('/v1/douyin/attachments',{bodyLimit:24_000_100},async r=>d.attachment(r.body));
 app.get('/v1/douyin/approvals',async()=>d.approvals.list());app.post('/v1/douyin/approvals',async r=>d.propose(r.body));app.post<{Params:{id:string}}>('/v1/douyin/approvals/:id/decide',async r=>d.decide(r.params.id,r.body));app.post<{Params:{id:string}}>('/v1/douyin/approvals/:id/revoke',async r=>d.revoke(r.params.id));
 app.get('/v1/activities/audit',async()=>a.audit());app.get('/v1/activities',async()=>a.status());app.post<{Body:{paused:boolean}}>('/v1/activities/pause',async r=>a.pause(r.body?.paused));app.post<{Params:{id:string}}>('/v1/activities/:id/cancel',async r=>a.cancel(r.params.id));
 app.post('/v1/schedules',async r=>a.save(r.body));app.get('/v1/schedules',async()=>a.schedules());app.post<{Params:{id:string}}>('/v1/schedules/:id/run',async r=>a.runSchedule(r.params.id));app.delete<{Params:{id:string}}>('/v1/schedules/:id',async r=>a.remove(r.params.id));
}
