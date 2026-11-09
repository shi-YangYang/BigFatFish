import { setTimeout as delay } from 'node:timers/promises';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join, isAbsolute } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { BrowserContext, Page } from 'playwright-core';
import type { DataPaths } from '../paths.js';
import { assertRegular, privateFile } from '../paths.js';
import { InputError, object, string } from '../ai/types.js';
import type { ChatService } from '../ai/chat.js';
import { transcribe } from '../ai/media.js';
import type { TaskQueue } from '../tasks/queue.js';
import { BrowserManager, asset, type BrowserConfig } from './browser.js';
import { callMcp, READ_TOOLS, WRITE_TOOLS } from './mcp.js';
import { WriteGate, writeCapabilities } from './write-gate.js';
import { publicResult, toolArgs, videoId } from './input.js';
interface Capture{state:{video:{id:string;title:string;author:string;duration:number}};frames:{data:string;mimeType:'image/jpeg';videoId:string;time:number}[];observation:Record<string,unknown>}
interface Controller{captureSharedFrames(seconds:number,signal:AbortSignal):Promise<Capture>;captureAudio(seconds:number,signal:AbortSignal):Promise<{data:string;mimeType:string}>;state():Promise<{loginRequired:boolean;verificationRequired:boolean;video?:{id:string}}>}
export class Douyin{
 private connection:{phase:string;error?:string;loginState?:string}={phase:'idle'};private connecting?:{control:AbortController;promise:Promise<void>};
 readonly browser:BrowserManager;private config:BrowserConfig={enabled:false,executablePath:'',pythonPath:'python3',headless:false,accountId:''};private revision='';private accountState='unverified';private closed=false;private transitioning=false;
 constructor(private db:DatabaseSync,private chat:ChatService,private queue:TaskQueue,private p:DataPaths,fixture?:(context:BrowserContext)=>Promise<void>){this.browser=new BrowserManager(p,fixture);const r=db.prepare("SELECT config,revision FROM plugin_config WHERE id='douyin'").get();if(r){this.config=JSON.parse(r.config as string);this.revision=r.revision as string;}}
 assertPlugin:()=>void=()=>{};
 resource:(path:string)=>string=asset;
 async reload(directory:string){await this.stop();this.resource=path=>path.startsWith('plugins/douyin/')?join(directory,path.slice(15)):path.startsWith('services/douyin/')?join(directory,path):asset(path);this.browser.resource=this.resource;}
 status(){return {connection:this.connection,config:this.config,revision:this.revision,browser:this.browser.status(),accountState:this.accountState,writeCapabilities};}
 discover(){return {browsers:this.browser.discover()};}
 private check(revision=this.revision){this.assertPlugin();if(this.closed||this.transitioning||!this.config.enabled||revision!==this.revision||this.queue.paused)throw new InputError('DOUYIN_DISABLED',409);}
 async configure(value:unknown,connectionControl?:AbortController){if(!connectionControl)this.cancelConnection();if(this.closed)throw new InputError('RUNTIME_STOPPING',503);const b=object(value);if(b.enabled)this.assertPlugin();if(b.revision!==this.revision)throw new InputError('CHANNEL_VERSION_CONFLICT',409);if(typeof b.enabled!=='boolean'||typeof b.headless!=='boolean')throw new InputError('INVALID_REQUEST');const executablePath=string(b.executablePath??'',2000,true),pythonPath=string(b.pythonPath??'python3',2000),accountId=string(b.accountId??'',100,true);if(executablePath&&!isAbsolute(executablePath))throw new InputError('INVALID_BROWSER_PATH');if(pythonPath!=='python3'&&!isAbsolute(pythonPath))throw new InputError('INVALID_PYTHON_PATH');if(accountId&&!/^\d{1,100}$/.test(accountId))throw new InputError('INVALID_ACCOUNT');this.transitioning=true;await this.queue.abort('douyin');await this.browser.close();this.transitioning=false;connectionControl?.signal.throwIfAborted();if(this.closed)throw new InputError('RUNTIME_STOPPING',503);if(b.revision!==this.revision)throw new InputError('CHANNEL_VERSION_CONFLICT',409);this.config={enabled:b.enabled,headless:b.headless,executablePath,pythonPath,accountId};this.revision=randomUUID();this.accountState='unverified';this.db.prepare("INSERT INTO plugin_config(id,config,revision) VALUES('douyin',?,?) ON CONFLICT(id) DO UPDATE SET config=excluded.config,revision=excluded.revision").run(JSON.stringify(this.config),this.revision);return this.status();}
 private cancelConnection(){this.connecting?.control.abort();this.connection={phase:'idle'};}
 connect(value:unknown){
  const body=object(value);if(body.revision!==this.revision)throw new InputError('CHANNEL_VERSION_CONFLICT',409);
  if(this.connecting||this.transitioning)throw new InputError('DOUYIN_CONNECTION_BUSY',409);
  this.assertPlugin();if(this.closed)throw new InputError('RUNTIME_STOPPING',503);if(this.queue.paused)throw new InputError('ACTIVITIES_PAUSED',409);
  const control=new AbortController();this.connection={phase:'connecting'};
  const configured=Promise.resolve().then(()=>this.configure({...this.config,...body,enabled:true},control));
  const promise=configured.then(async()=>{
   control.signal.throwIfAborted();const revision=this.revision;
   const check=()=>{control.signal.throwIfAborted();this.check(revision);};
   await this.browser.lease({...this.config,headless:false},control.signal,async()=>{
    check();this.browser.mode='login';
    let raw=await this.mcp('douyin_check_credential',{},control.signal);check();
    if(raw.loggedIn!==true){raw=await this.mcp('douyin_login_qr',{},control.signal);check();}
    const deadline=Date.now()+180000;
    for(;;){
     check();const account=await this.browser.account();check();
     if(raw.loggedIn===true&&account.loggedIn&&/^\d{1,100}$/.test(account.id)){
      if(this.config.accountId&&this.config.accountId!==account.id){this.accountState='account-mismatch';throw new InputError('DOUYIN_ACCOUNT_CHANGED',409);}
      if(!this.config.accountId){this.config={...this.config,accountId:account.id};this.revision=randomUUID();this.db.prepare("UPDATE plugin_config SET config=?,revision=? WHERE id='douyin'").run(JSON.stringify(this.config),this.revision);}
      this.accountState='verified';this.connection={phase:'online'};return;
     }
     this.accountState='login-required';
     this.connection={phase:'login',loginState:raw.needCaptcha?'verification':raw.state==='scanned_need_confirm'?'confirmation':'waiting'};
     if(Date.now()>=deadline)throw new InputError('DOUYIN_LOGIN_TIMEOUT',409);
     await delay(2000,undefined,{signal:control.signal});check();raw=await this.mcp('douyin_login_poll',{},control.signal);
    }
   });
  }).catch(error=>{if(!control.signal.aborted)this.connection={phase:'error',error:error instanceof InputError?error.message:'DOUYIN_LOGIN_REQUIRED'};}).finally(()=>{if(this.connecting?.control===control)this.connecting=undefined;});
  this.connecting={control,promise};
  // A successful request acknowledges saved settings; login remains owned by Runtime.
  return configured.then(()=>{control.signal.throwIfAborted();return this.status();},async error=>{await promise;throw error;});
 }
 async disconnect(){this.cancelConnection();await this.configure({...this.config,enabled:false,revision:this.revision});await this.connecting?.promise;return this.status();}
 private async mcp(tool:string,args:Record<string,unknown>,signal:AbortSignal,guard?:()=>Promise<void>){const context=this.browser.context!,before=context.pages();try{return await callMcp({script:this.resource('services/douyin/mcp_server.py'),python:this.config.pythonPath,home:join(this.p.data,'douyin-mcp'),endpoint:this.browser.endpoint,tool,args,signal,guard});}finally{if(!tool.startsWith('douyin_login'))await Promise.allSettled(context.pages().filter(page=>!before.includes(page)).map(page=>page.close()));}}
 read(value:unknown){const b=object(value),tool=string(b.tool,64);if(!READ_TOOLS.includes(tool as never))throw new InputError('TOOL_NOT_ALLOWED',403);const args=toolArgs(tool,b.args);this.check();if(tool.startsWith('douyin_login')&&this.config.headless)throw new InputError('BROWSER_DISPLAY_REQUIRED',409);const revision=this.revision;return this.queue.enqueue('douyin','read',{tool,args},string(b.requestId,100),'Activity',async signal=>this.browser.lease(this.config,signal,async()=>{this.check(revision);this.browser.mode=tool.startsWith('douyin_login')?'login':'read';const raw=await this.mcp(tool,args,signal);this.check(revision);if(raw.needLogin)this.accountState='login-required';if(tool==='douyin_check_credential'||tool==='douyin_login_poll'){const account=await this.browser.account();this.accountState=raw.loggedIn===true&&account.loggedIn?(this.config.accountId&&account.id!==this.config.accountId?'account-mismatch':'verified'):'login-required';}return {status:raw.needLogin?'blocked':raw.ok===true?'completed':'failed',...publicResult(raw)};}));}
 watch(value:unknown,mode='Activity'){const b=object(value),id=videoId(b.videoId),seconds=Number(b.seconds??3);if(!Number.isFinite(seconds)||seconds<0.2||seconds>10)throw new InputError('INVALID_WATCH_BUDGET');if(b.audio!==undefined&&typeof b.audio!=='boolean')throw new InputError('INVALID_REQUEST');this.check();const requestId=string(b.requestId,100),input={videoId:id,seconds,audio:b.audio===true};const duplicate=this.queue.request('douyin','watch',input,requestId);if(duplicate)return duplicate;const seenRow=this.db.prepare("SELECT id FROM activity_tasks WHERE platform='douyin' AND kind='watch' AND json_extract(input,'$.videoId')=? AND status IN ('queued','running','completed','partial') ORDER BY rowid DESC LIMIT 1").get(id);const seen=seenRow?this.queue.get(seenRow.id as string):undefined;if(seen){this.queue.alias('douyin','watch',input,requestId,seen.id);return seen;}const revision=this.revision;return this.queue.enqueue('douyin','watch',input,requestId,mode,async(signal,taskId)=>{
  const captured=await this.browser.lease(this.config,signal,async()=>{this.check(revision);const page=await this.browser.context!.newPage();try{await page.goto(`https://www.douyin.com/video/${id}`,{waitUntil:'domcontentloaded',timeout:30000});const module=await import(pathToFileURL(this.resource('plugins/douyin/lockybee/core.mjs')).href) as {BrowserController:new(options:{page:Page})=>Controller;verifySharedVideoFrameProof:(v:Capture,id:string)=>boolean};const controller=new module.BrowserController({page});await page.waitForSelector('video',{timeout:15000});const state=await controller.state();if(state.loginRequired||state.verificationRequired)throw new InputError(state.verificationRequired?'DOUYIN_VERIFICATION_REQUIRED':'DOUYIN_LOGIN_REQUIRED',409);if(state.video?.id!==id)throw new InputError('DOUYIN_PAGE_CHANGED',409);await page.locator('video').first().evaluate(async video=>{await (video as HTMLVideoElement).play();});const capture=await controller.captureSharedFrames(seconds,signal);if(!module.verifySharedVideoFrameProof(capture,id))throw new InputError('VIDEO_EVIDENCE_INVALID');let audio:Awaited<ReturnType<Controller['captureAudio']>>|undefined,audioError:string|undefined;if(b.audio)try{audio=await controller.captureAudio(seconds,signal);}catch{signal.throwIfAborted();audioError='AUDIO_UNAVAILABLE';}return {capture,audio,audioError};}finally{await page.close().catch(()=>{});}});
  signal.throwIfAborted();this.check(revision);const warnings:string[]=[];if(captured.audioError)warnings.push(captured.audioError);let transcript='',asrModelId:string|undefined;if(captured.audio)try{const asr=await transcribe(this.chat.config,captured.audio,signal);transcript=asr.text;asrModelId=asr.modelId;}catch(e){signal.throwIfAborted();warnings.push(e instanceof InputError?e.message:'ASR_FAILED');}
  const {capture}=captured;const evidence={platform:'douyin',videoId:id,url:`https://www.douyin.com/video/${id}`,title:capture.state.video.title||id,author:capture.state.video.author,observedAt:new Date().toISOString(),subtitles:transcript,transcriptSource:transcript?'sampled-audio-asr':null,asrModelId,observation:capture.observation,modelFrameIndexes:[0,2],frames:capture.frames.map(({videoId,time})=>({videoId,time})),warnings};
  const result=await this.chat.understandVideo(taskId,evidence,[capture.frames[0]!,capture.frames[2]!].map(frame=>({type:'image' as const,data:frame.data,mimeType:frame.mimeType})),signal);signal.throwIfAborted();this.check(revision);const eventId=`douyin:${taskId}`,summary=`观看抖音《${evidence.title}》 ${evidence.url}；实际3帧采样，其中2帧用于理解${transcript?'及音轨转写':'，无音轨转写'}。模型总结：${result.summary}`;this.chat.life.memories.record({id:eventId,kind:'douyin.watched',sourceId:taskId,summary,occurredAt:evidence.observedAt});for(const interest of result.interests)this.chat.life.memories.insert({kind:'interest',subject:`鱼的兴趣候选：${interest}`,content:`本次视频推测兴趣：${interest}；不是主人事实。`,importance:2,sources:[{type:'activity',id:eventId,quote:summary.slice(0,2000)}]});return {status:warnings.length?'partial':'completed',evidence,summary:result.summary,modelId:result.modelId};});}
 async discoverContent(query:string|undefined,signal:AbortSignal){this.check();const revision=this.revision;return this.browser.lease(this.config,signal,async()=>{const raw=await this.mcp(query?'douyin_search':'douyin_feed',query?{keyword:query,num:10}:{num:5,scrolls:2,skip_live:true},signal);this.check(revision);if(raw.ok!==true||raw.needLogin||!Array.isArray(raw.items)||raw.source==='none')throw new InputError('DOUYIN_PAGE_CHANGED',409);return raw.items.slice(0,10).map(value=>{const item=object(value);return {platform:'douyin' as const,videoId:videoId(item.aweme_id),title:string(item.title??'',1000,true),author:string(item.author??'',200,true)};}).filter(item=>!this.db.prepare("SELECT id FROM activity_tasks WHERE platform='douyin' AND kind='watch' AND json_extract(input,'$.videoId')=? AND status IN ('completed','partial','queued','running')").get(item.videoId));});}
 attachment(value:unknown){const b=object(value),data=string(b.data,24_000_000);if(!/^[A-Za-z0-9+/]+={0,2}$/.test(data))throw new InputError('INVALID_MEDIA');const bytes=Buffer.from(data,'base64');if(bytes.length<12||bytes.length>16_000_000||bytes.subarray(4,8).toString()!=='ftyp')throw new InputError('INVALID_MEDIA');const id=randomUUID(),dir=join(this.p.data,'douyin-attachments');mkdirSync(dir,{recursive:true,mode:0o700});const file=join(dir,id+'.mp4');writeFileSync(file,bytes,{mode:0o600,flag:'wx'});privateFile(file);return {id,digest:createHash('sha256').update(bytes.toString('base64')).digest('hex'),bytes:bytes.length};}
 private attachmentFile(id:unknown){const name=string(id,64);if(!/^[a-f0-9-]{36}$/.test(name))throw new InputError('INVALID_MEDIA');const file=join(this.p.data,'douyin-attachments',name+'.mp4');assertRegular(file);const bytes=readFileSync(file);if(bytes.length>16_000_000)throw new InputError('INVALID_MEDIA');return {file,digest:createHash('sha256').update(bytes.toString('base64')).digest('hex')};}
 write(value:unknown){
  this.check();
  if(!this.config.accountId)throw new InputError('DOUYIN_ACCOUNT_REQUIRED',409);
  const b=object(value);
  if(Object.keys(b).some(key=>!['tool','args','requestId'].includes(key)))throw new InputError('INVALID_REQUEST');
  const tool=string(b.tool,64),requestId=string(b.requestId,100);
  if(!WRITE_TOOLS.includes(tool as never))throw new InputError('TOOL_NOT_ALLOWED',403);
  const args=toolArgs(tool,b.args),revision=this.revision,accountId=this.config.accountId;
  const attachmentDigest=tool==='douyin_publish'?this.attachmentFile(args.attachmentId).digest:undefined;
  if(writeCapabilities[tool as keyof typeof writeCapabilities]!=='bounded-http')throw new InputError('ACTION_PROTOCOL_UNSUPPORTED',409);
  const input={tool,args,accountId,revision,...(attachmentDigest?{attachmentDigest}:{})};
  return this.queue.enqueue('douyin','write',input,requestId,'Activity',async(signal,taskId)=>{
   let submitted=false;
   try{return await this.browser.lease(this.config,signal,async()=>{
    this.browser.submitted=false;
    try{
    const guard=async()=>{
     signal.throwIfAborted();this.check(revision);
     if(await this.browser.blocked())throw new InputError('DOUYIN_VERIFICATION_REQUIRED',409);
     const account=await this.browser.account();
     signal.throwIfAborted();this.check(revision);
     if(!account.loggedIn||!account.id||account.id!==accountId)throw new InputError('DOUYIN_ACCOUNT_CHANGED',403);
     if(attachmentDigest&&attachmentDigest!==this.attachmentFile(args.attachmentId).digest)throw new InputError('ACTION_CONTENT_CHANGED',409);
    };
    await guard();this.browser.mode='write';this.browser.submitted=false;
    const gate=new WriteGate(tool,args,guard);this.browser.gate=gate;
    const callArgs={...args};
    if(tool==='douyin_publish'){callArgs.video_path=this.attachmentFile(args.attachmentId).file;delete callArgs.attachmentId;}
    const raw=await this.mcp(tool,callArgs,signal,()=>gate.arm());await gate.settle();
    submitted=this.browser.submitted||gate.submitted;
    const status=gate.receipt&&!this.browser.denied?'completed':submitted||raw.status==='unknown'?'unknown':signal.aborted?'cancelled':this.browser.denied?'revoked':raw.needLogin?'blocked':'failed';
    this.db.prepare('INSERT INTO audit(event,at) VALUES(?,?)').run(`douyin.${status}:${taskId}`,new Date().toISOString());
    return {...publicResult(gate.receipt??raw),verified:status==='completed',...(gate.error?{error:gate.error}:{}),status};
    }finally{submitted ||=this.browser.submitted;}
   });}catch(e){
    return {status:submitted?'unknown':signal.aborted?'cancelled':'revoked',error:submitted?'ACTION_UNKNOWN':signal.aborted?'CANCELLED':e instanceof InputError?e.message:'ACTION_NOT_SENT'};
   }
  });
 }
 async stop(){this.cancelConnection();await this.queue.abort('douyin');await this.browser.close();await this.connecting?.promise;this.accountState='unverified';return this.status();}
 async close(){this.closed=true;await this.stop();}
}
