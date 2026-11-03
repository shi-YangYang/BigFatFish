import type { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { InputError } from '../ai/types.js';
export interface ActivityTask{id:string;platform:string;kind:string;mode:string;input:Record<string,unknown>;status:string;result:Record<string,unknown>|null;error:string|null;createdAt:string}
export class TaskQueue{
 private runs=new Map<string,{control:AbortController;promise:Promise<void>;started:boolean}>();private tail=Promise.resolve();private closed=false;paused=false;
 constructor(private db:DatabaseSync){db.prepare("UPDATE activity_tasks SET status=CASE WHEN kind='write' THEN 'unknown' ELSE 'interrupted' END,error='RUNTIME_RESTARTED' WHERE status IN ('queued','running')").run();this.paused=db.prepare("SELECT value FROM settings WHERE key='activities.paused'").get()?.value==='true';}
 get(id:string):ActivityTask{const r=this.db.prepare('SELECT id,platform,kind,mode,input,status,result,error,created_at AS createdAt FROM activity_tasks WHERE id=?').get(id);if(!r)throw new InputError('TASK_NOT_FOUND',404);return {...r,input:JSON.parse(r.input as string),result:r.result?JSON.parse(r.result as string):null} as unknown as ActivityTask;}
 list(){return this.db.prepare('SELECT id FROM activity_tasks ORDER BY rowid DESC LIMIT 100').all().map(r=>this.get(r.id as string));}
 request(platform:string,kind:string,input:Record<string,unknown>,requestId:string){const old=this.db.prepare('SELECT task_id,input,platform,kind FROM activity_requests WHERE request_id=?').get(requestId);if(!old)return undefined;if(old.input!==JSON.stringify(input)||old.platform!==platform||old.kind!==kind)throw new InputError('IDEMPOTENCY_CONFLICT',409);return this.get(old.task_id as string);}
 alias(platform:string,kind:string,input:Record<string,unknown>,requestId:string,id:string){this.db.prepare('INSERT INTO activity_requests(request_id,task_id,platform,kind,input) VALUES(?,?,?,?,?)').run(requestId,id,platform,kind,JSON.stringify(input));}
 enqueue(platform:string,kind:string,input:Record<string,unknown>,requestId:string,mode:string,run:(signal:AbortSignal,id:string)=>Promise<Record<string,unknown>>){
  if(this.closed||this.paused)throw new InputError('ACTIVITIES_PAUSED',409);const encoded=JSON.stringify(input);const old=this.request(platform,kind,input,requestId);if(old)return old;if(this.runs.size>=32)throw new InputError('QUEUE_FULL',429);
  const id=randomUUID(),control=new AbortController();this.db.prepare("INSERT INTO activity_tasks(id,request_id,platform,kind,mode,input,status,created_at) VALUES(?,?,?,?,?,?,'queued',?)").run(id,requestId,platform,kind,mode,encoded,new Date().toISOString());this.alias(platform,kind,input,requestId,id);
  const promise=this.tail.catch(()=>{}).then(async()=>{try{control.signal.throwIfAborted();this.runs.get(id)!.started=true;this.state(id,'running');const signal=AbortSignal.any([control.signal,AbortSignal.timeout(180000)]);const result=await run(signal,id);if(kind!=='write')signal.throwIfAborted();this.state(id,typeof result.status==='string'?result.status:'completed',result);}catch(e){this.state(id,control.signal.aborted?'cancelled':'failed',undefined,control.signal.aborted?'CANCELLED':e instanceof InputError?e.message:'ACTIVITY_FAILED');}finally{this.runs.delete(id);}});this.runs.set(id,{control,promise,started:false});this.tail=promise;return this.get(id);
 }
 private state(id:string,status:string,result?:Record<string,unknown>,error:string|null=null){this.db.prepare('UPDATE activity_tasks SET status=?,result=?,error=? WHERE id=?').run(status,result?JSON.stringify(result):null,error,id);}
 cancel(id:string){this.get(id);const run=this.runs.get(id);run?.control.abort();if(run&&!run.started)this.state(id,'cancelled',undefined,'CANCELLED');return this.get(id);}
 async abort(platform?:string){const entries=[...this.runs].filter(([id])=>!platform||this.get(id).platform===platform);for(const [id]of entries)this.cancel(id);await Promise.allSettled(entries.filter(([,r])=>r.started).map(([,r])=>r.promise));}
 async pause(value:boolean){this.paused=value;this.db.prepare("INSERT INTO settings(key,value) VALUES('activities.paused',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(value));if(value)await this.abort();return {paused:value};}
 async close(){this.closed=true;await this.abort();await this.tail;}
}
