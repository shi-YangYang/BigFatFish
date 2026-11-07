import {createHash,randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {InputError,object} from '../ai/types.js';
export interface SelfOptions {accountId:string;profile:boolean;posts:boolean;visibility:'friends'|'self'|'public';revision:string}
export class QQActionState {
 constructor(private db:DatabaseSync,readonly now=Date.now){db.prepare("UPDATE qq_operations SET status='unknown',error='RUNTIME_RESTARTED' WHERE status='running'").run();}
 options(accountId:string):SelfOptions {
  const row=this.db.prepare('SELECT * FROM qq_self_options WHERE account_id=?').get(accountId);
  return {accountId,profile:row?!!row.profile:!this.restored(),posts:row?!!row.posts:!this.restored(),visibility:(row?.visibility??'friends') as SelfOptions['visibility'],revision:String(row?.revision??'initial')};
 }
 save(accountId:string,input:unknown){const b=object(input),old=this.options(accountId);if(b.accountId!==accountId||b.revision!==old.revision)throw new InputError('QQ_SELF_SETTINGS_CHANGED',409);if(typeof b.profile!=='boolean'||typeof b.posts!=='boolean'||!['friends','self','public'].includes(String(b.visibility)))throw new InputError('INVALID_REQUEST');this.db.prepare('INSERT INTO qq_self_options VALUES(?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET profile=excluded.profile,posts=excluded.posts,visibility=excluded.visibility,revision=excluded.revision').run(accountId,Number(b.profile),Number(b.posts),String(b.visibility),randomUUID());return this.options(accountId);}
 private restored(){return this.db.prepare("SELECT value FROM settings WHERE key='qq.self.restorePaused'").get()?.value==='true';}
 paused(){return this.db.prepare("SELECT value FROM settings WHERE key='activities.paused'").get()?.value==='true';}
 due(accountId:string){const now=this.now(),day=new Date(now).toLocaleDateString('en-CA'),row=this.db.prepare('SELECT * FROM qq_self_clock WHERE account_id=?').get(accountId);if(!row){this.db.prepare('INSERT INTO qq_self_clock VALUES(?,?,?,0)').run(accountId,now+3600000,day);return false;}if(Number(row.next_at)>now)return false;if(row.day===day&&Number(row.decisions)>=6)return false;this.db.prepare('UPDATE qq_self_clock SET next_at=?,day=?,decisions=? WHERE account_id=?').run(now+3600000,day,row.day===day?Number(row.decisions)+1:1,accountId);return true;}
 async write(accountId:string,kind:string,payload:unknown,scope:string,limit:number,guard:()=>void,run:()=>Promise<unknown>){
  guard();const at=new Date(this.now()).toISOString(),start=new Date(this.now());start.setHours(0,0,0,0);
  const fingerprint=createHash('sha256').update(JSON.stringify([scope,payload,kind==='like'?start.toISOString():null])).digest('hex');
  const unresolved=this.db.prepare("SELECT 1 FROM qq_operations WHERE account_id=? AND kind=? AND fingerprint=? AND status IN ('running','unknown') LIMIT 1").get(accountId,kind,fingerprint);
  if(unresolved)throw new InputError('QQ_ACTION_UNCONFIRMED',409);
  const mutable=['profile','avatar','group_card','space_profile'].includes(kind);
  const old=mutable?undefined:this.db.prepare("SELECT result FROM qq_operations WHERE account_id=? AND kind=? AND fingerprint=? AND status='done' ORDER BY rowid DESC LIMIT 1").get(accountId,kind,fingerprint);
  if(old)return JSON.parse(String(old.result));
  const count=this.db.prepare("SELECT count(*) AS n FROM qq_operations WHERE account_id=? AND kind=? AND created_at>=? AND status IN ('running','done','unknown')").get(accountId,kind,start.toISOString());if(Number(count?.n)>=limit)throw new InputError('QQ_ACTION_DAILY_LIMIT',409);
  const id=randomUUID();this.db.prepare("INSERT INTO qq_operations VALUES(?,?,?,?,'running',NULL,NULL,?)").run(id,accountId,kind,fingerprint,at);
  try{const result=await run();this.db.prepare("UPDATE qq_operations SET status='done',result=? WHERE id=?").run(JSON.stringify(result??null),id);return result;}
  catch(error){const code=error instanceof Error?error.message:'QQ_ACTION_FAILED';const status=['SEND_NOT_STARTED','ACTION_REJECTED','QQ_TOOL_UNSUPPORTED'].includes(code)?'failed':'unknown';this.db.prepare('UPDATE qq_operations SET status=?,error=? WHERE id=?').run(status,code,id);throw error;}
 }
 issues(){return this.db.prepare("SELECT id,kind,status,created_at AS at FROM qq_operations WHERE status IN ('unknown','failed') ORDER BY created_at DESC LIMIT 20").all();}
}
