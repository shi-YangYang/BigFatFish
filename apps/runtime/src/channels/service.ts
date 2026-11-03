import { ApprovalStore } from '../permissions/store.js';
import { validateHeaderValue } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { ChatService } from '../ai/chat.js';
import { InputError, object, string, type ChatEvent, type ChatMessage } from '../ai/types.js';
import { configuration, inbound, segments, target } from './protocol.js';
import { loadQQ } from './plugin.js';
import type { Approval, ChannelStatus, Plugin, QQConfig, Segment, Target } from './types.js';
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
type DeliveryAuthorization={kind:'reply';assertScope:()=>void}|{kind:'approval';assertScope:()=>void};
export class Channels {
  private approvalStore:ApprovalStore;private plugin!:Plugin;private manifest:Record<string,unknown>={};private config:QQConfig|null=null;private revision='';private closing=false;
  private actions=new Set<Promise<unknown>>();
  private running=new Set<string>();private queues=new Map<string,Promise<void>>();
  constructor(private db:DatabaseSync,private chat:ChatService) {
    db.prepare("UPDATE channel_deliveries SET status=CASE WHEN status='sending' THEN 'unknown' ELSE 'interrupted' END,error='RUNTIME_RESTARTED' WHERE status IN ('queued','generating','sending')").run();
    this.approvalStore=new ApprovalStore(db,'qq');
    const row=db.prepare("SELECT config,revision FROM plugin_config WHERE id='qq'").get();
    if(row){this.config=configuration(JSON.parse(row.config as string));this.revision=row.revision as string;}
  }
  async initialize(){const loaded=await loadQQ();this.plugin=loaded.plugin;this.manifest=loaded.manifest;this.plugin.initialize({event:value=>this.receive(value),status:()=>{}});if(this.config?.enabled)this.start();}
  private audit(event:string,id=''){this.db.prepare('INSERT INTO audit(event,at) VALUES(?,?)').run(`qq.${event}${id?':'+id:''}`,new Date().toISOString());}
  status():ChannelStatus {return {config:this.config,hasToken:!!this.db.prepare("SELECT secret FROM plugin_config WHERE id='qq'").get()?.secret,revision:this.revision,health:this.plugin.health(),manifest:this.manifest};}
  private invalidate(){for(const id of this.running)this.chat.cancel(id);this.plugin.stop();this.approvalStore.revoke();}
  save(input:unknown){
    if(this.closing)throw new InputError('RUNTIME_STOPPING',503);
    const b=object(input),config=configuration(b);
    if(b.revision!==this.revision)throw new InputError('CHANNEL_VERSION_CONFLICT',409);
    const old=this.db.prepare("SELECT secret FROM plugin_config WHERE id='qq'").get();
    const plaintext=b.token===undefined?(old?.secret?this.chat.config.decryptSecret(old.secret as string):''):string(b.token,8192,true);
    // Disabling a legacy invalid connection must remain possible without replacing its secret.
    if(plaintext&&(b.token!==undefined||config.enabled))this.validToken(plaintext);
    const token=b.token===undefined?old?.secret??null:plaintext?this.chat.config.encryptSecret(plaintext):null;
    const revision=randomUUID();
    this.db.prepare("INSERT INTO plugin_config(id,config,secret,revision) VALUES('qq',?,?,?) ON CONFLICT(id) DO UPDATE SET config=excluded.config,secret=excluded.secret,revision=excluded.revision").run(JSON.stringify(config),token,revision);
    this.invalidate();this.revision=revision;this.config=config;
    this.audit('configured');if(config.enabled)this.start();return this.status();
  }
  private validToken(token:string){
    if([...token].some(c=>c.charCodeAt(0)<=32||c.charCodeAt(0)===127))throw new InputError('INVALID_TOKEN');
    try{validateHeaderValue('Authorization',`Bearer ${token}`);}catch{throw new InputError('INVALID_TOKEN');}
  }
  private start(){const secret=this.db.prepare("SELECT secret FROM plugin_config WHERE id='qq'").get()?.secret;this.plugin.start({...this.config!,token:secret?this.chat.config.decryptSecret(secret as string):''});}
  enable(enabled:boolean){if(!this.config)throw new InputError('CHANNEL_NOT_CONFIGURED',409);return this.save({...this.config,enabled,revision:this.revision});}
  private allowed(to:Target,revision:string,proactive=false){const c=this.config;return !this.closing&&revision===this.revision&&!!c?.enabled&&(proactive?c.proactiveEnabled:c.replyEnabled)&&(to.kind==='private'?to.id===c.ownerId:c.groups.includes(to.id));}
  private receive(value:unknown){
    if(!this.config?.enabled||!this.config.replyEnabled||this.closing)return;
    let event;try{event=inbound(value,this.config);}catch{return;}if(!event)return;
    const id=`${this.config.accountId}:${event.target.kind}:${event.target.id}:${event.id}`;
    const inserted=this.db.prepare("INSERT OR IGNORE INTO channel_deliveries(id,target,author,segments,status,created_at) VALUES(?,?,?,?,'queued',?)").run(id,JSON.stringify(event.target),event.author,JSON.stringify(event.parts),new Date().toISOString());if(!inserted.changes)return;
    if(this.queues.size>=32 || this.db.prepare("SELECT count(*) AS n FROM channel_deliveries WHERE status IN ('queued','generating')").get()!.n as number > 100){this.state(id,'blocked','QUEUE_FULL');return;}
    const revision=this.revision, key=`${event.target.kind}:${event.target.id}`;
    const job=(this.queues.get(key)??Promise.resolve()).then(()=>this.reply(id,event!,revision));this.queues.set(key,job);
    void job.finally(()=>{if(this.queues.get(key)===job)this.queues.delete(key);});
  }
  private state(id:string,status:string,error:string|null=null,messageId:string|null=null){this.db.prepare('UPDATE channel_deliveries SET status=?,error=?,message_id=COALESCE(?,message_id) WHERE id=?').run(status,error,messageId,id);}
  private wait(id:string){return new Promise<ChatMessage>(resolve=>{const done=(message:ChatMessage)=>{if(['queued','running'].includes(message.status))return;this.chat.events.off('message',listener);resolve(message);};const listener=(event:ChatEvent)=>{if(event.message.id===id)done(event.message);};this.chat.events.on('message',listener);done(this.chat.message(id));});}
  private async reply(id:string,event:NonNullable<ReturnType<typeof inbound>>,revision:string){
    let mid:string|undefined;
    try{
      if(!this.allowed(event.target,revision))throw new InputError('PERMISSION_REVOKED',403);
      const owner=event.target.kind==='private';const principal=`qq-${owner?'owner':'user'}:${event.author}`;
      const key=`${this.config!.accountId}:${revision}:${event.target.kind}:${event.target.id}:${event.author}`;
      let cid=this.db.prepare('SELECT conversation_id FROM channel_sessions WHERE id=?').get(key)?.conversation_id as string|undefined;
      if(!cid){cid=this.chat.create({title:`QQ ${event.target.kind==='group'?'群':'私聊'} ${event.target.id}`},{audience:owner?'owner':'group',principal}).id;this.db.prepare('INSERT INTO channel_sessions(id,conversation_id) VALUES(?,?)').run(key,cid);}
      this.state(id,'generating');this.chat.life.memories.record({id:`qq-received:${id}`,kind:'qq.received',sourceId:id,summary:`收到 QQ ${owner?'私聊':'群聊'}消息`,occurredAt:new Date().toISOString()});
      const message=this.chat.send(cid,{content:event.text,requestId:digest(id)},principal);mid=message.id;this.running.add(mid);
      const authorizeReply=this.chat.deliveryGuard(mid);
      const result=await this.wait(mid);if(result.status!=='completed')throw new InputError(result.error??'GENERATION_FAILED');
      if(!this.allowed(event.target,revision))throw new InputError('PERMISSION_REVOKED',403);
      if(result.content.length>4000)throw new InputError('MESSAGE_TOO_LONG');
      await this.deliver(id,event.target,[{type:'reply',data:{id:event.id}},{type:'text',data:{text:result.content}}],revision,{kind:'reply',assertScope:authorizeReply});
    }catch(error){this.state(id,'blocked',error instanceof InputError?error.message:'GENERATION_FAILED');this.audit('blocked',id);}finally{if(mid)this.running.delete(mid);}
  }
  private async deliver(id:string,to:Target,parts:Segment[],revision:string,authorization:DeliveryAuthorization){
    const proactive=authorization.kind==='approval';
    if(!this.allowed(to,revision,proactive))throw new InputError('PERMISSION_REVOKED',403);
    if(this.plugin.health().state!=='online')throw new InputError('CHANNEL_OFFLINE',409);
    this.state(id,'sending');this.audit('send.started',id);
    try{
      const result=await this.plugin.send(to.kind,to.id,parts,()=>{
        if(!this.allowed(to,revision,proactive))throw new InputError('PERMISSION_REVOKED',403);
        authorization.assertScope();
      });this.state(id,'sent',null,result.messageId);this.audit('send.sent',id);
      this.chat.life.memories.record({id:`qq-sent:${id}`,kind:'qq.sent',sourceId:id,summary:'QQ 消息发送已由协议服务确认',occurredAt:new Date().toISOString()});
      return 'sent';
    }catch(error){
      if(error instanceof Error&&error.message==='SEND_NOT_STARTED'){
        const reason=!this.allowed(to,revision,proactive)?'PERMISSION_REVOKED':error.cause instanceof InputError?error.cause.message:'CHANNEL_OFFLINE';
        this.state(id,'blocked',reason);this.audit('send.blocked',id);return reason==='PERMISSION_REVOKED'?'revoked':'blocked';
      }
      const status=error instanceof Error&&error.message==='ACTION_REJECTED'?'failed':'unknown';this.state(id,status,status==='unknown'?'SEND_UNKNOWN':'ACTION_REJECTED');this.audit(`send.${status}`,id);return status;}
  }
  deliveries(){return this.db.prepare('SELECT id,target,author,status,message_id AS messageId,error,created_at AS createdAt FROM channel_deliveries ORDER BY rowid DESC LIMIT 100').all();}
  approvals():Approval[]{return this.approvalStore.list() as unknown as Approval[];}
  propose(input:unknown){const b=object(input),to=target(b.target),parts=segments(b.segments,true);if(!this.allowed(to,this.revision,true))throw new InputError('PERMISSION_REVOKED',403);const a=this.approvalStore.create({target:to,segments:parts},this.revision);this.audit('approval.created',a.id);return a;}
  decide(id:string,input:unknown){
    const b=object(input);if(Object.keys(b).some(k=>!['digest','decision'].includes(k))||!['approve','reject'].includes(String(b.decision)))throw new InputError('INVALID_REQUEST');
    const row=this.approvalStore.get(id),payload=row.payload as unknown as Approval['payload'];if(row.status!=='pending'||row.expiresAt<=Date.now())throw new InputError('APPROVAL_NOT_PENDING',409);
    if(b.decision==='approve'){if(!this.allowed(payload.target,row.revision,true))throw new InputError('PERMISSION_REVOKED',403);if(this.plugin.health().state!=='online')throw new InputError('CHANNEL_OFFLINE',409);}
    this.approvalStore.decide(id,string(b.digest,64),this.revision,String(b.decision));
    if(b.decision==='reject'){this.audit('approval.rejected',id);return {status:'rejected'};}
    this.db.prepare("INSERT INTO channel_deliveries(id,target,author,status,created_at) VALUES(?,?,'local-owner','queued',?)").run(id,JSON.stringify(payload.target),new Date().toISOString());
    const action=this.deliver(id,payload.target,payload.segments,row.revision,{kind:'approval',assertScope:()=>{this.approvalStore.check(id,row.digest,this.revision);}}).then(status=>this.approvalStore.state(id,status)).catch(()=>{this.state(id,'blocked','PERMISSION_REVOKED');this.approvalStore.state(id,'revoked');});
    this.actions.add(action);void action.finally(()=>this.actions.delete(action));return {status:'executing'};
  }
  auditLog(){return this.db.prepare("SELECT event,at FROM audit WHERE event LIKE 'qq.%' ORDER BY id DESC LIMIT 100").all();}
  async close(){this.closing=true;this.invalidate();await Promise.all([...this.queues.values(),...this.actions]);this.plugin.dispose();}
}
