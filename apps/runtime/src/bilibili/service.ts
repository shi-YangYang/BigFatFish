import {pathToFileURL} from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { ChatService } from '../ai/chat.js';
import { InputError, object, string } from '../ai/types.js';
import type { Channels } from '../channels/service.js';
import type { DataPaths } from '../paths.js';
import { Upstream, loadBilibili, type Credentials, type Evidence } from './upstream.js';
export interface VideoTask {id:string;bvid:string;status:string;result:{evidence:Evidence;summary?:string;modelId?:string}|null;error:string|null;createdAt:string}
interface AuthState {id?:string;status:string;image?:string;expiresAt?:number;account?:{mid:string;name:string};error?:string}
interface QR {start():Promise<AuthState>;poll(id:string):Promise<AuthState>;cancel(id?:string):AuthState;dispose():void}
export class Bilibili {
  private upstream:Upstream;private module!:Awaited<ReturnType<typeof loadBilibili>>;private qr!:QR;
  private initializationError:string|undefined;
  private enabled=false;private revision='';private account:AuthState['account'];private accountState='signed-out';private closing=false;
  private connection:{phase:string;login?:AuthState;error?:string}={phase:'idle'};
  private connecting?:{control:AbortController;promise:Promise<void>};
  private operations=new Map<string,{control:AbortController;promise:Promise<unknown>}>();
  constructor(private db:DatabaseSync,private chat:ChatService,private channels:Channels,p:DataPaths,options?:ConstructorParameters<typeof Upstream>[1]){
    this.upstream=new Upstream(p,options);db.prepare("UPDATE video_tasks SET status='interrupted',error='RUNTIME_RESTARTED' WHERE status IN ('queued','running','understanding')").run();
    const row=db.prepare("SELECT config,revision FROM plugin_config WHERE id='bilibili'").get();if(row){const c=JSON.parse(row.config as string);this.enabled=c.enabled===true;this.account=c.account;this.revision=row.revision as string;this.accountState=this.account?'unverified':'signed-out';}
  }
  assertPlugin:()=>void=()=>{};
  async suspend(){await this.abort();}
  async reload(directory:string){await this.abort();this.qr?.dispose();this.upstream.url=pathToFileURL(directory+'/');this.initializationError=undefined;await this.initialize();if(this.initializationError)throw new InputError(this.initializationError,409);}
  async initialize(){try{this.module=await loadBilibili(this.upstream.url);this.qr=new this.module.QrAuth({save:(c:Credentials,options:{signal:AbortSignal;check:()=>void})=>this.import(c,options)});}catch{this.initializationError='BILI_DEPENDENCY_MISSING';}}
  status(){return {connection:this.connection,enabled:this.enabled,revision:this.revision,account:this.account,accountState:this.accountState,hasCredentials:!!this.db.prepare("SELECT secret FROM plugin_config WHERE id='bilibili'").get()?.secret,health:{state:this.initializationError?'unavailable':this.enabled?'ready':'disabled',error:this.initializationError,ffmpeg:this.upstream.ffmpeg()},manifest:this.module?.manifest??{id:'bilibili',version:'0.1.0'}};}
  private assertEnabled(){this.assertPlugin();if(this.initializationError)throw new InputError(this.initializationError,409);if(this.closing)throw new InputError('RUNTIME_STOPPING',503);if(!this.enabled)throw new InputError('BILI_DISABLED',409);}
  private secret():Credentials|null{const row=this.db.prepare("SELECT secret FROM plugin_config WHERE id='bilibili'").get();return row?.secret?JSON.parse(this.chat.config.decryptSecret(row.secret as string)):null;}
  private save(secret: string|null|undefined=undefined){const old=this.db.prepare("SELECT secret FROM plugin_config WHERE id='bilibili'").get();this.revision=randomUUID();this.db.prepare("INSERT INTO plugin_config(id,config,secret,revision) VALUES('bilibili',?,?,?) ON CONFLICT(id) DO UPDATE SET config=excluded.config,secret=excluded.secret,revision=excluded.revision").run(JSON.stringify({enabled:this.enabled,account:this.account}),secret===undefined?old?.secret??null:secret,this.revision);}
  async configure(input:unknown){if(this.closing)throw new InputError('RUNTIME_STOPPING',503);const b=object(input);if(b.enabled)this.assertPlugin();if(b.revision!==this.revision||typeof b.enabled!=='boolean')throw new InputError('CHANNEL_VERSION_CONFLICT',409);await this.abort();if(b.revision!==this.revision)throw new InputError('CHANNEL_VERSION_CONFLICT',409);this.enabled=b.enabled;this.save();return this.status();}
  private async abort(){this.cancelConnection();this.qr?.cancel();for(const r of this.operations.values())r.control.abort();await Promise.allSettled([...this.operations.values()].map(r=>r.promise));}
  private operation<T>(fn:(signal:AbortSignal)=>Promise<T>){this.assertEnabled();if(this.operations.size)throw new InputError('BILI_BUSY',409);const id=randomUUID(),control=new AbortController();const promise=Promise.resolve().then(()=>fn(control.signal)).finally(()=>this.operations.delete(id));this.operations.set(id,{control,promise});return promise;}
  async import(input:unknown,options?:{signal:AbortSignal;check:()=>void}){
    if(!options)this.cancelConnection();this.assertEnabled();const revision=this.revision;let credentials:Credentials;try{credentials=this.module.parseManualCookie(input);}catch{throw new InputError('BILI_INVALID_CREDENTIALS');}
    return this.operation(async signal=>{
      let account;try{account=await this.module.verifyAccount(credentials,{signal:options?AbortSignal.any([signal,options.signal]):signal});}catch{throw new InputError('BILI_LOGIN_FAILED',409);}
      options?.check();signal.throwIfAborted();if(revision!==this.revision)throw new InputError('CHANNEL_VERSION_CONFLICT',409);
      this.account=account;this.accountState='verified';this.save(this.chat.config.encryptSecret(JSON.stringify(credentials)));return account;
    });
  }
  verify(){return this.operation(async signal=>{const c=this.secret();if(!c)throw new InputError('BILI_LOGIN_REQUIRED',409);try{const account=await this.module.verifyAccount(c,{signal});signal.throwIfAborted();this.account=account;this.accountState='verified';return this.status();}catch{this.accountState='expired-or-unavailable';throw new InputError('BILI_LOGIN_FAILED',409);}});}
  async logout(){await this.abort();this.account=undefined;this.accountState='signed-out';this.save(null);return this.status();}
  async login(action:string,id?:string){if(action==='start'||action==='cancel')this.cancelConnection();this.assertEnabled();try{if(action==='start')return await this.qr.start();if(action==='poll'&&id)return await this.qr.poll(id);if(action==='cancel')return this.qr.cancel(id);}catch{throw new InputError('BILI_LOGIN_FAILED',409);}throw new InputError('INVALID_REQUEST');}
  private cancelConnection(){this.connecting?.control.abort();this.qr?.cancel();this.connection={phase:'idle'};}
  connect(input:unknown){
    const body=object(input);if(body.revision!==this.revision)throw new InputError('CHANNEL_VERSION_CONFLICT',409);
    if(this.connecting||this.operations.size)throw new InputError('BILI_BUSY',409);
    this.assertPlugin();if(this.closing)throw new InputError('RUNTIME_STOPPING',503);if(this.initializationError)throw new InputError(this.initializationError,409);
    let credentials:Credentials|undefined;try{credentials=body.credentials===undefined?undefined:this.module.parseManualCookie(body.credentials);}catch{throw new InputError('BILI_INVALID_CREDENTIALS');}
    this.enabled=true;this.accountState=this.account?'unverified':'signed-out';this.save();const revision=this.revision,control=new AbortController();
    this.connection={phase:'connecting'};
    const check=()=>{control.signal.throwIfAborted();this.assertEnabled();if(this.revision!==revision)throw new InputError('CHANNEL_VERSION_CONFLICT',409);};
    const promise=Promise.resolve().then(async()=>{
      check();
      if(credentials){await this.import(credentials,{signal:control.signal,check});control.signal.throwIfAborted();this.connection={phase:'online'};return;}
      if(this.secret())try{await this.verify();check();this.connection={phase:'online'};return;}catch{check();}
      let login=await this.qr.start();check();this.connection={phase:'login',login};
      while(['waiting','scanned'].includes(login.status)){
        await delay(2200,undefined,{signal:control.signal});check();login=await this.qr.poll(login.id!);
        control.signal.throwIfAborted();
        if(login.status==='success'){this.connection={phase:'online'};return;}
        check();this.connection={phase:'login',login};
      }
      this.connection={phase:login.status==='expired'?'expired':'error',error:login.status==='expired'?undefined:'BILI_LOGIN_FAILED'};
    }).catch(error=>{if(!control.signal.aborted)this.connection={phase:'error',error:error instanceof InputError?error.message:'BILI_LOGIN_FAILED'};}).finally(()=>{if(this.connecting?.control===control)this.connecting=undefined;});
    this.connecting={control,promise};return this.status();
  }
  async disconnect(){await this.configure({enabled:false,revision:this.revision});await this.connecting?.promise;return this.status();}
  search(input:unknown,external?:AbortSignal){const b=object(input);return this.operation(signal=>this.upstream.search(string(b.query,200),this.secret(),external?AbortSignal.any([signal,external]):signal));}
  read(input:unknown){const b=object(input),kind=b.kind;if(!['video','comments','debrief'].includes(String(kind)))throw new InputError('INVALID_REQUEST');return this.operation(signal=>this.upstream.read(this.bvid(b.bvid),kind as 'video'|'comments'|'debrief',this.secret(),signal));}
  private bvid(input:unknown){const value=string(input,12);if(!/^BV[0-9A-Za-z]{10}$/.test(value))throw new InputError('INVALID_BVID');return value;}
  seen(bvid:string){return !!this.db.prepare("SELECT id FROM video_tasks WHERE bvid=? AND status IN ('queued','running','understanding','completed','partial') LIMIT 1").get(bvid);}
  task(id:string):VideoTask{const row=this.db.prepare('SELECT id,bvid,status,result,error,created_at AS createdAt FROM video_tasks WHERE id=?').get(id);if(!row)throw new InputError('TASK_NOT_FOUND',404);return {...row,result:row.result?JSON.parse(row.result as string):null} as unknown as VideoTask;}
  tasks(){return this.db.prepare('SELECT id FROM video_tasks ORDER BY rowid DESC LIMIT 100').all().map(r=>this.task(r.id as string));}
  watch(input:unknown){
    this.assertEnabled();if(this.db.prepare("SELECT value FROM settings WHERE key='activities.paused'").get()?.value==='true')throw new InputError('ACTIVITIES_PAUSED',409);const b=object(input),bvid=this.bvid(b.bvid),requestId=string(b.requestId,100);
    const duplicate=this.db.prepare('SELECT task_id AS id,bvid FROM video_requests WHERE request_id=?').get(requestId);if(duplicate){if(duplicate.bvid!==bvid)throw new InputError('IDEMPOTENCY_CONFLICT',409);return this.task(duplicate.id as string);}
    const seen=this.db.prepare("SELECT id FROM video_tasks WHERE bvid=? AND status IN ('queued','running','understanding','completed','partial') ORDER BY rowid DESC LIMIT 1").get(bvid);if(seen){this.db.prepare('INSERT INTO video_requests(request_id,task_id,bvid) VALUES(?,?,?)').run(requestId,seen.id!,bvid);return this.task(seen.id as string);}
    if(this.operations.size)throw new InputError('BILI_BUSY',409);
    const id=randomUUID(),control=new AbortController();this.db.prepare("INSERT INTO video_tasks(id,request_id,bvid,status,created_at) VALUES(?,?,?,'queued',?)").run(id,requestId,bvid,new Date().toISOString());this.db.prepare('INSERT INTO video_requests(request_id,task_id,bvid) VALUES(?,?,?)').run(requestId,id,bvid);
    const promise=Promise.resolve().then(async()=>{
      try{
        this.state(id,'running');const {evidence,images}=await this.upstream.watch(bvid,this.secret(),control.signal);control.signal.throwIfAborted();
        this.state(id,'understanding',{evidence});
        const result=await this.chat.understandVideo(id,evidence,images,control.signal);control.signal.throwIfAborted();
        this.state(id,evidence.warnings.length?'partial':'completed',{evidence,summary:result.summary,modelId:result.modelId});
        const eventId=`bilibili:${id}`,summary=`读取 B站视频《${evidence.title}》 ${evidence.url}；证据：${evidence.subtitles?'官方字幕':'无官方字幕'}、${result.visual?'9 帧采样画面':'未理解画面'}。模型总结：${result.summary}`;
        this.chat.life.memories.record({id:eventId,kind:'bilibili.watched',sourceId:id,summary,occurredAt:evidence.observedAt});
        for(const interest of result.interests)this.chat.life.memories.insert({kind:'interest',subject:`鱼的兴趣候选：${interest}`,content:`根据本次视频理解推测鱼可能关注：${interest}；不是主人事实。`,importance:2,sources:[{type:'activity',id:eventId,quote:summary.slice(0,2000)}]});
      }catch(error){this.state(id,control.signal.aborted?'cancelled':'failed',undefined,control.signal.aborted?'CANCELLED':error instanceof InputError?error.message:'BILI_TASK_FAILED');}
      finally{this.operations.delete(id);}
    });this.operations.set(id,{control,promise});return this.task(id);
  }
  private state(id:string,status:string,result?:VideoTask['result'],error:string|null=null){this.db.prepare('UPDATE video_tasks SET status=?,result=COALESCE(?,result),error=? WHERE id=?').run(status,result?JSON.stringify(result):null,error,id);}
  cancel(id:string){this.task(id);this.operations.get(id)?.control.abort();return this.task(id);}
  share(id:string,input:unknown){const task=this.task(id);if(!['completed','partial'].includes(task.status)||!task.result?.summary)throw new InputError('VIDEO_NOT_UNDERSTOOD',409);const b=object(input);if(!this.channels.status().config)throw new InputError('CHANNEL_NOT_CONFIGURED',409);const {evidence,summary}=task.result;return this.channels.send({target:b.target,segments:[{type:'text',data:{text:`${evidence.title}\n${evidence.url}\n${summary}`}}]});}
  async close(){this.closing=true;await this.abort();await this.connecting?.promise;this.qr?.dispose();}
}
