import { randomBytes } from 'node:crypto';
import { existsSync,readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import type { FastifyInstance } from 'fastify';
import { InputError,object } from '../../ai/types.js';
import { assertRegular,type DataPaths } from '../../paths.js';
import { Channels } from '../service.js';
import { configuration, stableId } from '../protocol.js';
import { NapCatClient,onebotRead,contacts } from './client.js';
import { ComponentPlatform,VERSION,privateDirectory,writePrivate } from './platform.js';
import type { ManagedState,ManagedQQStatus,QQContact } from './types.js';
// qrcode already ships with the Bilibili integration.
import { createRequire } from 'node:module';
const qrcode=createRequire(import.meta.url)('qrcode') as {toDataURL:(text:string,options:object)=>Promise<string>};
async function freePort(){const server=createServer();await new Promise<void>((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});const address=server.address() as {port:number};await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));return address.port;}
export function onebotConfig(state:ManagedState,native:boolean){return {network:{httpServers:[],httpSseServers:[],httpClients:[],websocketClients:[],plugins:[],websocketServers:[{name:'bigfatfish',enable:true,host:native?'127.0.0.1':'0.0.0.0',port:native?state.botPort:3001,messagePostFormat:'array',reportSelfMessage:false,token:state.botToken,enableForcePushEvent:true,debug:false,heartInterval:30000}]},musicSignUrl:'',enableLocalFile2Url:false,parseMultMsg:false,imageDownloadProxy:''};}
export class ManagedQQ {
 private resumeOnLogin=false;private componentTouched=false;private stateValid=true;private state:ManagedState;private platform:ComponentPlatform;private client?:NapCatClient;private view:ManagedQQStatus;
 private job?:Promise<void>;private control?:AbortController;private generation=0;private running=false;private closed=false;private timer?:ReturnType<typeof setTimeout>;private configuredAccount='';private qrUrl='';
 private lists:{friends:QQContact[];groups:QQContact[];error?:string}={friends:[],groups:[]};
 readonly directory:string;private stateFile:string;
 constructor(p:DataPaths,private channels:Channels){
  this.directory=join(p.data,'qq-component');this.stateFile=join(this.directory,'manager.json');
  const initial:ManagedState={id:randomBytes(12).toString('hex'),webToken:randomBytes(32).toString('hex'),botToken:randomBytes(32).toString('hex'),webPort:0,botPort:0,installed:false};
  this.state=initial;
  try{privateDirectory(this.directory);assertRegular(this.stateFile);if(existsSync(this.stateFile))this.state=JSON.parse(readFileSync(this.stateFile,'utf8')) as ManagedState;
   if(!/^[a-f0-9]{24}$/.test(this.state.id)||![this.state.webToken,this.state.botToken].every(x=>/^[a-f0-9]{64}$/.test(x))||typeof this.state.installed!=='boolean')throw new Error();
  }catch{this.state=initial;this.stateValid=false;}
  this.platform=new ComponentPlatform(this.directory,this.state);this.view={phase:this.state.installed?'ready':'missing',engine:this.platform.native?'native':'docker',supported:this.platform.supported,version:VERSION,busy:false};if(!this.stateValid){this.view.phase='error';this.view.error='QQ_COMPONENT_STATE_INVALID';}
 }
 initialize(){if(!this.stateValid)return;if(this.channels.status().config?.mode==='managed'&&this.channels.status().config?.enabled)this.action('start');}
 status(){return {...this.view};}
 contactList(){return this.lists;}
 private persist(){writePrivate(this.stateFile,this.state);}
 private error(error:unknown){return error instanceof InputError?error.message:'QQ_COMPONENT_UNAVAILABLE';}
 private launch(phase:ManagedQQStatus['phase'],work:(signal:AbortSignal,generation:number)=>Promise<void>){
  if(this.closed)throw new InputError('RUNTIME_STOPPING',503);if(!this.stateValid)throw new InputError('QQ_COMPONENT_STATE_INVALID');if(this.job)throw new InputError('QQ_COMPONENT_BUSY',409);
  const generation=++this.generation;this.control=new AbortController();this.view={...this.view,phase,busy:true,error:undefined,operationError:undefined};
  const job=work(this.control.signal,generation).catch(error=>{if(generation===this.generation)this.view={...this.view,phase:'error',error:this.error(error),operationError:this.error(error),qr:undefined};}).finally(()=>{if(this.job===job){this.job=undefined;this.view.busy=false;}});this.job=job;
  return this.status();
 }
 action(action:'install'|'start'|'stop'|'refresh'){
  if(!this.stateValid)throw new InputError('QQ_COMPONENT_STATE_INVALID');
  if(action==='stop'){
   if(this.view.phase==='stopping')return this.status();
   if(this.closed)throw new InputError('RUNTIME_STOPPING',503);
   // Cancel installation/start before queued cleanup, preventing late orphan creation.
   const pending=this.job;this.control?.abort();this.generation++;this.running=false;clearTimeout(this.timer);this.view={...this.view,phase:'stopping',busy:true,qr:undefined,account:undefined};
   this.resumeOnLogin=false;const config=this.channels.status();if(config.config?.mode==='managed'&&config.config.enabled)this.channels.enable(false);
   const job=(async()=>{await pending;if(this.state.installed||this.componentTouched)await this.platform.stop();this.componentTouched=false;this.view.phase=this.state.installed?'ready':'missing';this.view.error=undefined;})().catch(error=>{this.view.phase='error';this.view.error=this.error(error);}).finally(()=>{if(this.job===job){this.job=undefined;this.view.busy=false;}});this.job=job;return this.status();
  }
  if(action==='install'&&this.running)throw new InputError('QQ_COMPONENT_BUSY',409);
  if(action==='install')return this.launch('installing',async(signal)=>{await this.platform.install(signal);signal.throwIfAborted();this.state.installed=true;this.persist();this.view.phase='ready';});
  if(action==='refresh')return this.launch('login',async()=>{if(!this.running||!this.client)throw new InputError('QQ_COMPONENT_NOT_STARTED',409);await this.client.call('QQLogin/RefreshQRcode');this.qrUrl='';await this.poll(this.generation);});
  if(this.running)throw new InputError('QQ_COMPONENT_BUSY',409);
  return this.launch('starting',async(signal,generation)=>{
   if(!this.state.installed)throw new InputError('QQ_COMPONENT_NOT_INSTALLED',409);
   const current=this.channels.status();if(current.config?.enabled&&current.config.mode!=='managed')throw new InputError('QQ_EXTERNAL_ACTIVE',409);
   for(const path of ['qq','work','work/config','work/plugins'])privateDirectory(join(this.directory,path));
   this.state.webPort=await freePort();this.state.botPort=await freePort();if(this.state.webPort===this.state.botPort)this.state.botPort=await freePort();this.persist();
   writePrivate(join(this.directory,'work','config','webui.json'),{host:this.platform.native?'127.0.0.1':'0.0.0.0',port:this.platform.native?this.state.webPort:6099,token:this.state.webToken,loginRate:10,autoLoginAccount:''});
   writePrivate(join(this.directory,'work','config','onebot11.json'),onebotConfig(this.state,this.platform.native));
   signal.throwIfAborted();
   try{this.componentTouched=true;await this.platform.start();signal.throwIfAborted();this.running=true;this.configuredAccount='';this.qrUrl='';this.client=new NapCatClient(this.state.webPort,this.state.webToken);
   for(let attempt=0;attempt<60;attempt++){signal.throwIfAborted();try{await this.poll(generation);this.schedule();return;}catch{await delay(1000,undefined,{signal});}}throw new InputError('QQ_COMPONENT_START_FAILED');}
   catch(error){this.running=false;await this.platform.stop();this.componentTouched=false;throw error;}
  });
 }
 private schedule(){clearTimeout(this.timer);if(!this.running||this.closed)return;this.timer=setTimeout(()=>{const generation=this.generation;void this.poll(generation).catch(error=>{if(generation===this.generation){this.view.error=this.error(error);this.view.phase='error';this.view.qr=undefined;}}).finally(()=>this.schedule());},3000);}
 private async poll(generation:number){
  const status=await this.client!.call('QQLogin/CheckLoginStatus');if(generation!==this.generation||!this.running)return;
  if(status.isLogin!==true||status.coreReady!==true){
   this.view={...this.view,phase:'login',account:undefined,error:status.loginError?'QQ_LOGIN_FAILED':undefined,loginPhase:typeof status.loginPhase==='string'?status.loginPhase:undefined};
   if(typeof status.qrcodeurl==='string'&&status.qrcodeurl.length<4096&&status.qrcodeurl!==this.qrUrl){const qr=await qrcode.toDataURL(status.qrcodeurl,{width:240,margin:2});if(generation!==this.generation)return;this.qrUrl=status.qrcodeurl;this.view.qr=qr;}
   return;
  }
  const info=await this.client!.call('QQLogin/GetQQLoginInfo'),id=stableId(info.uin);if(info.online!==true)throw new InputError('CHANNEL_OFFLINE',409);
  if(generation!==this.generation)return;
  const existing=this.channels.status();
  if(existing.config?.mode==='managed'&&existing.config.accountId!==id&&existing.config.enabled)this.channels.enable(false);
  if(this.configuredAccount!==id){
   await this.client!.call('OB11Config/SetConfig',{config:JSON.stringify(onebotConfig(this.state,this.platform.native))});
   if(generation!==this.generation)return;
   const login=await onebotRead(this.state.botPort,this.state.botToken,'get_login_info') as {user_id:unknown};if(stableId(login.user_id)!==id)throw new InputError('QQ_ACCOUNT_CHANGED',409);
   if(generation!==this.generation)return;this.configuredAccount=id;
   try{const [friends,groups]=await Promise.all([onebotRead(this.state.botPort,this.state.botToken,'get_friend_list'),onebotRead(this.state.botPort,this.state.botToken,'get_group_list')]);if(generation!==this.generation)return;this.lists={friends:contacts(friends,'friend'),groups:contacts(groups,'group')};}catch{this.lists={friends:[],groups:[],error:'QQ_CONTACTS_UNAVAILABLE'};}
   const saved=this.channels.status();if(generation===this.generation&&saved.config?.mode==='managed'&&(saved.config.enabled||this.resumeOnLogin)&&saved.config.accountId===id)this.channels.save({...saved.config,enabled:true,revision:saved.revision,url:`ws://127.0.0.1:${this.state.botPort}`,token:this.state.botToken});
  }
  this.resumeOnLogin=false;if(generation!==this.generation)return;this.view={...this.view,phase:'online',account:{id,name:String(info.nick??id).slice(0,100)},qr:undefined,error:undefined,loginPhase:undefined};
 }
 configure(input:unknown){
  const body=object(input),current=this.channels.status();
  if(body.revision!==current.revision)throw new InputError('CHANNEL_VERSION_CONFLICT',409);
  const id=stableId(body.accountId);if(!this.running||this.view.phase!=='online'||this.view.account?.id!==id)throw new InputError('QQ_ACCOUNT_CHANGED',409);
  const owner=stableId(body.ownerId);if(owner===id)throw new InputError('QQ_OWNER_IS_BOT');
  if(!Array.isArray(body.groups)||body.groups.length>100||typeof body.replyEnabled!=='boolean'||typeof body.proactiveEnabled!=='boolean')throw new InputError('INVALID_REQUEST');
  const groups=body.groups.map(stableId);
  configuration({...body,url:`ws://127.0.0.1:${this.state.botPort}`,enabled:true});
  return this.launch('online',async(_signal,generation)=>{
   const login=await onebotRead(this.state.botPort,this.state.botToken,'get_login_info') as {user_id:unknown};const status=await onebotRead(this.state.botPort,this.state.botToken,'get_status') as {online:boolean};
   if(generation!==this.generation)throw new InputError('CANCELLED');
   if(stableId(login.user_id)!==id||status.online!==true)throw new InputError('QQ_ACCOUNT_CHANGED',409);
   this.channels.save({mode:'managed',url:`ws://127.0.0.1:${this.state.botPort}`,token:this.state.botToken,accountId:id,ownerId:owner,friendIds:body.friendIds,groupReplyMode:body.groupReplyMode,groups,enabled:true,replyEnabled:body.replyEnabled,proactiveEnabled:body.proactiveEnabled,revision:body.revision});
  });
 }
 resume(){const config=this.channels.status();if(!config.config||config.config.mode!=='managed')throw new InputError('CHANNEL_NOT_CONFIGURED',409);if(this.running)return this.configure({...config.config,revision:config.revision});this.resumeOnLogin=true;try{return this.action('start');}catch(error){this.resumeOnLogin=false;throw error;}}
 async stopAndWait(){this.action('stop');await this.job;}
 async close(){this.closed=true;this.running=false;this.generation++;clearTimeout(this.timer);this.control?.abort();await this.job;if(this.componentTouched&&this.stateValid){await this.platform.stop();this.componentTouched=false;}}
}
export function registerManagedQQ(app:FastifyInstance,managed:ManagedQQ){
 app.get('/v1/channels/qq/component',async()=>managed.status());
 app.get('/v1/channels/qq/component/contacts',async()=>managed.contactList());
 for(const action of ['install','start','stop','refresh'] as const)app.post(`/v1/channels/qq/component/${action}`,async()=>managed.action(action));
 app.put('/v1/channels/qq/component/settings',async req=>managed.configure(req.body));
}
