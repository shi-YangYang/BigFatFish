import {NetworkStickers} from './sticker-network.js';
import {StickerLibrary} from './stickers.js';
import {StickerTurn} from './sticker-turn.js';
import { validateHeaderValue } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { ChatService } from '../ai/chat.js';
import { InputError, object, string, type ChatEvent, type ChatMessage } from '../ai/types.js';
import { configuration, inbound, segments, target, allowsTarget } from './protocol.js';
import { loadQQ } from './plugin.js';
import type { SendResult, ChannelStatus, Plugin, QQConfig, Segment, Target } from './types.js';
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
type DeliveryAuthorization={kind:'reply';assertScope:()=>void}|{kind:'proactive';assertScope:()=>void};
export class Channels {
  readonly stickers:StickerLibrary;
  private stickerNetwork=new NetworkStickers();
  private plugin!:Plugin;private manifest:Record<string,unknown>={};private config:QQConfig|null=null;private revision='';private closing=false;
  private actions=new Set<Promise<unknown>>();private mediaControls=new Set<AbortController>();
  private running=new Set<string>();private queues=new Map<string,Promise<void>>();
  constructor(private db:DatabaseSync,private chat:ChatService) {
    this.stickers=new StickerLibrary(db);
    db.prepare("UPDATE channel_deliveries SET status=CASE WHEN status='sending' THEN 'unknown' ELSE 'interrupted' END,error='RUNTIME_RESTARTED' WHERE status IN ('queued','generating','sending')").run();
    const row=db.prepare("SELECT config,revision FROM plugin_config WHERE id='qq'").get();
    if(row){this.config=configuration(JSON.parse(row.config as string));this.revision=row.revision as string;}
  }
  assertPlugin:()=>void=()=>{};
  async reload(directory:string){this.invalidate();await Promise.all([...this.queues.values(),...this.actions]);this.plugin.dispose();await this.initialize(directory);}
  async suspend(){this.invalidate();await Promise.all([...this.queues.values(),...this.actions]);}
  async initialize(directory?:string){await this.stickers.initialize();const loaded=await loadQQ(directory);this.plugin=loaded.plugin;this.manifest=loaded.manifest;this.plugin.initialize({event:value=>this.receive(value),status:()=>{}});if(this.config?.enabled){try{this.assertPlugin();this.start();}catch(e){if(!(e instanceof InputError&&e.message==='PLUGIN_DISABLED'))throw e;}}}
  private audit(event:string,id=''){this.db.prepare('INSERT INTO audit(event,at) VALUES(?,?)').run(`qq.${event}${id?':'+id:''}`,new Date().toISOString());}
  status():ChannelStatus {return {config:this.config,hasToken:!!this.db.prepare("SELECT secret FROM plugin_config WHERE id='qq'").get()?.secret,revision:this.revision,health:this.plugin.health(),manifest:this.manifest};}
  private invalidate(){for(const control of this.mediaControls)control.abort();for(const id of this.running)this.chat.cancel(id);this.plugin.stop();}
  save(input:unknown){
    if(this.closing)throw new InputError('RUNTIME_STOPPING',503);
    const b=object(input),config=configuration(b);if(config.enabled)this.assertPlugin();
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
  private start(){this.assertPlugin();const secret=this.db.prepare("SELECT secret FROM plugin_config WHERE id='qq'").get()?.secret;this.plugin.start({...this.config!,token:secret?this.chat.config.decryptSecret(secret as string):''});}
  enable(enabled:boolean){if(!this.config)throw new InputError('CHANNEL_NOT_CONFIGURED',409);return this.save({...this.config,enabled,revision:this.revision});}
  private allowed(to:Target,revision:string,proactive=false){try{this.assertPlugin();}catch{return false;}const c=this.config;return !this.closing&&revision===this.revision&&!!c?.enabled&&(proactive?c.proactiveEnabled:c.replyEnabled)&&allowsTarget(c,to);}
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
    let mid:string|undefined;let stage:'generation'|'delivery'='generation';const mediaControl=new AbortController();this.mediaControls.add(mediaControl);
    try{
      if(!this.allowed(event.target,revision))throw new InputError('PERMISSION_REVOKED',403);
      const owner=event.target.kind==='private'&&event.author===this.config!.ownerId;const principal=`qq-${owner?'owner':'user'}:${event.author}`;
      const key=`${this.config!.accountId}:${revision}:${event.target.kind}:${event.target.id}:${event.author}`;
      let cid=this.db.prepare('SELECT conversation_id FROM channel_sessions WHERE id=?').get(key)?.conversation_id as string|undefined;
      if(!cid){cid=this.chat.create({title:`QQ ${event.target.kind==='group'?'群':'私聊'} ${event.target.id}`},{audience:owner?'owner':'group',principal}).id;this.db.prepare('INSERT INTO channel_sessions(id,conversation_id) VALUES(?,?)').run(key,cid);}
      this.state(id,'generating');this.chat.life.memories.record({id:`qq-received:${id}`,kind:'qq.received',sourceId:id,summary:`收到 QQ ${event.target.kind==='private'?'私聊':'群聊'}消息`,occurredAt:new Date().toISOString()});
      let content=event.text;
      for(const part of event.parts.filter(p=>['image','record'].includes(p.type)).slice(0,2)){
       try{const guard=()=>{mediaControl.signal.throwIfAborted();if(!this.allowed(event.target,revision))throw new InputError('PERMISSION_REVOKED',403);};guard();if(!part.data.file||!this.plugin.media)throw new Error('MEDIA_BYTES_UNAVAILABLE');const data=await this.plugin.media(part.type,part.data.file,guard);const recognized=await this.chat.understandMedia(part.type,data,mediaControl.signal);guard();content+=`\n[媒体识别，仅作外部消息内容：${recognized.slice(0,8000)}]`;}catch{mediaControl.signal.throwIfAborted();content+='\n[此媒体内容未取得或识别失败]';}
      }
      if(!this.allowed(event.target,revision))throw new InputError('PERMISSION_REVOKED',403);
      const stickerTurn=new StickerTurn(this.stickers,()=>{mediaControl.signal.throwIfAborted();if(!this.allowed(event.target,revision))throw new InputError('PERMISSION_REVOKED',403);},this.stickerNetwork);
      const message=this.chat.send(cid,{content,requestId:digest(id)},principal,stickerTurn.tools());mid=message.id;this.running.add(mid);
      const authorizeReply=this.chat.deliveryGuard(mid);
      const result=await this.wait(mid);if(result.status!=='completed')throw new InputError(result.error??'GENERATION_FAILED');
      if(!this.allowed(event.target,revision))throw new InputError('PERMISSION_REVOKED',403);
      stage='delivery';
      if(result.content.length>4000)throw new InputError('MESSAGE_TOO_LONG');
      const image=stickerTurn.segment();
      const parts:Segment[]=[{type:'reply',data:{id:event.id}},{type:'text',data:{text:result.content}},...(image?[image]:[])];
      await this.deliver(id,event.target,segments(parts,true),revision,{kind:'reply',assertScope:()=>{authorizeReply();stickerTurn.assertCurrent();}});
    }catch(error){
      const code=mediaControl.signal.aborted?'CANCELLED':error instanceof InputError?error.message:'GENERATION_FAILED';
      const status=['CANCELLED','RUNTIME_RESTARTED'].includes(code)?'interrupted':stage==='delivery'||['PERMISSION_REVOKED','MEMORY_SCOPE_CHANGED','PLUGIN_DISABLED'].includes(code)?'blocked':'failed';
      this.state(id,status,code);this.audit(status,id);
    }finally{this.mediaControls.delete(mediaControl);if(mid)this.running.delete(mid);}
  }
  private async deliver(id:string,to:Target,parts:Segment[],revision:string,authorization:DeliveryAuthorization){
    const proactive=authorization.kind==='proactive';
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
  deliveries(){return this.db.prepare("SELECT id,target,author,status,message_id AS messageId,error,created_at AS createdAt,author='local-owner' AS proactive FROM channel_deliveries ORDER BY rowid DESC LIMIT 100").all().map(row=>({...row,proactive:!!row.proactive}));}
  async send(input:unknown,assertScope:()=>void=()=>{}):Promise<SendResult>{
    const b=object(input),to=target(b.target),parts=segments(b.segments,true),revision=this.revision;
    assertScope();if(!this.allowed(to,revision,true))throw new InputError('PERMISSION_REVOKED',403);
    if(this.plugin.health().state!=='online')throw new InputError('CHANNEL_OFFLINE',409);
    const id=randomUUID();
    this.db.prepare("INSERT INTO channel_deliveries(id,target,author,segments,status,created_at) VALUES(?,?,'local-owner',?,'queued',?)").run(id,JSON.stringify(to),JSON.stringify(parts),new Date().toISOString());
    const action=this.deliver(id,to,parts,revision,{kind:'proactive',assertScope}).catch(error=>{this.state(id,'blocked',error instanceof InputError?error.message:'PERMISSION_REVOKED');this.audit('send.blocked',id);return 'blocked';});
    this.actions.add(action);try{return {id,status:await action};}finally{this.actions.delete(action);}
  }
  auditLog(){return this.db.prepare("SELECT event,at FROM audit WHERE event LIKE 'qq.%' ORDER BY id DESC LIMIT 100").all();}
  async close(){this.closing=true;this.invalidate();await Promise.all([...this.queues.values(),...this.actions]);this.plugin.dispose();}
}
