import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { InputError, object, string } from '../ai/types.js';
import type { MemoryTask } from './types.js';
export interface DiaryOptions { enabled:boolean; hour:number; timezone:string; since:string; revision:string }
export function localDay(now:number,timezone:string){return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function dueDiaryDay(now:number,options:DiaryOptions){
  const today=localDay(now,options.timezone),hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:options.timezone,hour:'2-digit',hourCycle:'h23'}).format(now));
  const day=hour>=options.hour?today:new Date(Date.parse(today+'T12:00:00Z')-86400_000).toISOString().slice(0,10);
  return day>=localDay(Date.parse(options.since),options.timezone)?day:null;
}
interface DiaryRunner { start:(day:string,timezone:string,requestId:string,assertCurrent:()=>void)=>MemoryTask; task:(id:string)=>MemoryTask; cancel:(id:string)=>unknown }
export class AutomaticDiary {
  private timer:NodeJS.Timeout;private closed=false;
  constructor(private db:DatabaseSync,private runner:DiaryRunner,private changed:()=>void,private now=Date.now){
    db.prepare('INSERT OR IGNORE INTO diary_options VALUES(1,1,23,?,?,?)').run(Intl.DateTimeFormat().resolvedOptions().timeZone,new Date(now()).toISOString(),randomUUID());
    this.timer=setInterval(()=>{if(db.isOpen)try{this.tick();}catch{/* Failed admission is recorded on the next bounded tick. */}},30_000).unref();
  }
  options():DiaryOptions {const r=this.db.prepare('SELECT * FROM diary_options WHERE id=1').get()!;return {enabled:!!r.enabled,hour:Number(r.hour),timezone:String(r.timezone),since:String(r.since),revision:String(r.revision)};}
  status(){return { ...this.options(),last:this.db.prepare('SELECT day,status,error FROM diary_auto_runs ORDER BY day DESC LIMIT 1').get()??null };}
  save(input:unknown){const b=object(input),old=this.options(),hour=Number(b.hour),timezone=string(b.timezone,80);if(typeof b.enabled!=='boolean'||!Number.isInteger(hour)||hour<0||hour>23)throw new InputError('INVALID_REQUEST');if(b.revision!==old.revision)throw new InputError('DIARY_SETTINGS_CHANGED',409);try{localDay(this.now(),timezone);}catch{throw new InputError('INVALID_TIMEZONE');}
    this.cancelPending();this.db.prepare('UPDATE diary_options SET enabled=?,hour=?,timezone=?,since=?,revision=? WHERE id=1').run(Number(b.enabled),hour,timezone,old.enabled?old.since:new Date(this.now()).toISOString(),randomUUID());this.changed();return this.status();
  }
  private cancelPending(){for(const r of this.db.prepare("SELECT task_id FROM diary_auto_runs WHERE status='running'").all()){if(r.task_id)this.runner.cancel(String(r.task_id));}this.db.prepare("UPDATE diary_auto_runs SET status='cancelled',error=NULL WHERE status='running'").run();}
  tick(){if(this.closed)return;const options=this.options();if(!options.enabled)return;const now=this.now();
    for(const r of this.db.prepare("SELECT day,timezone,task_id,attempts FROM diary_auto_runs WHERE status='running'").all()){
      const task=this.runner.task(String(r.task_id));if(['queued','running'].includes(task.status))continue;
      const done=['completed','partial'].includes(task.status);this.db.prepare('UPDATE diary_auto_runs SET status=?,error=?,next_at=? WHERE day=? AND timezone=?').run(done?'done':Number(r.attempts)>=3?'failed':'retry',done?null:task.error,now+300_000,r.day!,r.timezone!);this.changed();
    }
    const day=dueDiaryDay(now,options);if(!day)return;
    if(this.db.prepare('SELECT 1 FROM daily_diaries WHERE day=? AND timezone=?').get(day,options.timezone))return;
    const run=this.db.prepare('SELECT * FROM diary_auto_runs WHERE day=? AND timezone=?').get(day,options.timezone);
    if(run&&(!['retry','cancelled'].includes(String(run.status))||Number(run.next_at)>now))return;
    if(this.db.prepare("SELECT 1 FROM diary_auto_runs WHERE status='running'").get())return;
    const attempts=Number(run?.attempts??0)+1;if(attempts>3)return;
    const assertCurrent=()=>{const current=this.options();if(this.closed||!current.enabled||current.revision!==options.revision)throw new InputError('CANCELLED');if(this.db.prepare('SELECT 1 FROM daily_diaries WHERE day=? AND timezone=?').get(day,options.timezone))throw new InputError('DIARY_ALREADY_WRITTEN');};
    try{assertCurrent();const task=this.runner.start(day,options.timezone,`auto-diary:${day}:${options.timezone}:${randomUUID()}`,assertCurrent);
      this.db.prepare("INSERT INTO diary_auto_runs VALUES(?,?,'running',?,?,0,NULL) ON CONFLICT(day,timezone) DO UPDATE SET status='running',attempts=excluded.attempts,task_id=excluded.task_id,error=NULL").run(day,options.timezone,attempts,task.id);
    }catch(error){const code=error instanceof InputError?error.message:'DIARY_START_FAILED';if(code==='DIARY_BUSY'||code==='QUEUE_FULL')return;
      this.db.prepare('INSERT INTO diary_auto_runs VALUES(?,?,?,?,NULL,?,?) ON CONFLICT(day,timezone) DO UPDATE SET status=excluded.status,attempts=excluded.attempts,error=excluded.error,next_at=excluded.next_at').run(day,options.timezone,code==='NO_DIARY_SOURCES'?'skipped':attempts>=3?'failed':'retry',attempts,now+300_000,code);
    }this.changed();
  }
  close(){this.closed=true;clearInterval(this.timer);this.cancelPending();}
}
