import { fork, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type BrowserContext, type Route } from 'playwright-core';
import { WriteGate } from './write-gate.js';
import { RedirectGuard, requestPolicy } from './redirects.js';
import { InputError } from '../ai/types.js';
import type { DataPaths } from '../paths.js';
export function asset(path:string){return fileURLToPath(new URL(`../../../../${path}`,import.meta.url));}
export interface BrowserConfig{enabled:boolean;executablePath:string;pythonPath:string;headless:boolean;accountId:string}
export class BrowserManager{
 private child?:ChildProcess;private browser?:Browser;context?:BrowserContext;endpoint='';private startPromise?:Promise<void>;private tail:Promise<unknown>=Promise.resolve();private closing?:Promise<void>;
 gate?:WriteGate;mode:'read'|'login'|'write'='read';submitted=false;denied=false;
 constructor(private p:DataPaths,readonly fixture?: (context:BrowserContext)=>Promise<void>){}
 discover(){return [...new Set([chromium.executablePath(),...(process.platform==='darwin'?['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']:process.platform==='win32'?[`${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,`${process.env['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`]:['/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome'])])].filter(existsSync);}
 status(){return {state:this.context?'ready':'closed',available:this.discover().length>0};}
 async start(config:BrowserConfig){if(this.closing)await this.closing;if(this.context)return;if(this.startPromise)return this.startPromise;this.startPromise=this.launch(config).finally(()=>{this.startPromise=undefined;});return this.startPromise;}
 private async launch(config:BrowserConfig){
  const executablePath=config.executablePath||this.discover()[0];if(!executablePath||!existsSync(executablePath))throw new InputError('BROWSER_MISSING',409);
  if(!config.headless&&process.platform==='linux'&&!process.env.DISPLAY&&!process.env.WAYLAND_DISPLAY)throw new InputError('BROWSER_DISPLAY_REQUIRED',409);
  const profile=join(this.p.data,'douyin-browser');mkdirSync(profile,{recursive:true,mode:0o700});rmSync(join(profile,'DevToolsActivePort'),{force:true});
  const env:NodeJS.ProcessEnv={PATH:process.env.PATH,TMPDIR:process.env.TMPDIR,DISPLAY:process.env.DISPLAY,WAYLAND_DISPLAY:process.env.WAYLAND_DISPLAY,SystemRoot:process.env.SystemRoot};
  const child=fork(asset('plugins/douyin/browser-host.mjs'),[],{env,stdio:['ignore','ignore','ignore','ipc']});this.child=child;
  child.on('message',(v:unknown)=>{if(this.child===child&&(v as {webSocketDenied?:boolean}).webSocketDenied)this.denied=true;});
  try{const port=await new Promise<number>((done,reject)=>{const timeout=setTimeout(()=>reject(new Error('BROWSER_START_TIMEOUT')),30000);const ready=(v:unknown)=>{const x=v as {port?:number;error?:string};if(!x.port&&!x.error)return;clearTimeout(timeout);child.off('message',ready);if(x.port)done(x.port);else reject(new Error('BROWSER_LAUNCH_FAILED'));};child.on('message',ready);child.once('exit',()=>{clearTimeout(timeout);reject(new Error('BROWSER_CLOSED'));});child.once('error',reject);child.send({profile,executablePath:resolve(executablePath),headless:config.headless});});
   this.endpoint=`http://127.0.0.1:${port}`;this.browser=await chromium.connectOverCDP(this.endpoint);this.context=this.browser.contexts()[0];if(!this.context)throw new Error('BROWSER_CONTEXT_MISSING');
   const context=this.context;const redirects=new RedirectGuard(context,()=>this.mode,()=>{this.denied=true;});await redirects.start(this.browser);await this.fixture?.(context);await context.route('**/*',route=>this.guardRequest(route,context,redirects));await this.context.routeWebSocket('**/*',socket=>{socket.onMessage(()=>{this.denied=true;socket.close();});});this.context.on('response',response=>this.gate?.response(response));this.browser.on('disconnected',()=>{this.context=undefined;this.endpoint='';});
  }catch{await this.close();throw new InputError('BROWSER_LAUNCH_FAILED',409);}
 }
 private async guardRequest(route:Route,context:BrowserContext,redirects:RedirectGuard){
  const req=route.request();const {write,auth,login}=requestPolicy(req.url(),req.method(),this.mode);
  try{
   // Install on the actual Chromium target before releasing its first request.
   // Dedicated worker requests have their owning frame in PW 1.58. Shared
   // workers never enter this route: the browser-level guard owns their I/O.
   // This also covers Python-created pages, popups and cross-process frames.
   await redirects.ensure(req.frame().page());
   if(context!==this.context)throw new Error('BROWSER_CLOSED');
   if(write&&!login){if(this.mode!=='write'||!this.gate)throw new Error();await this.gate.authorize(req);this.submitted=this.gate.submitted;}
   if(auth&&this.mode!=='login')throw new Error();
   await route.fallback();
  }catch{this.denied=true;await route.abort('blockedbyclient').catch(()=>{});}
 }
 async blocked(){for(const page of this.context?.pages()??[]){if(!/^https:\/\/(www|creator)\.douyin\.com(?:\/|$)/.test(page.url()))continue;const blocked=await page.evaluate(()=>Array.from(document.querySelectorAll('#captcha_container,[id^="captcha_container"],[data-e2e="captcha-container"],iframe[src*="captcha"]')).some(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>30&&r.height>30&&s.display!=='none'&&s.visibility!=='hidden';}));if(blocked)return true;}return false;}
 async account(){if(!this.context)throw new InputError('BROWSER_CLOSED',409);const cookies=await this.context.cookies('https://www.douyin.com');const get=(key:string)=>cookies.find(c=>c.name===key)?.value;return {id:get('uid_tt')||get('uid_tt_ss')||'',loggedIn:!!(get('sessionid')||get('sessionid_ss')||get('sid_tt'))};}
 async lease<T>(config:BrowserConfig,signal:AbortSignal,fn:()=>Promise<T>){const previous=this.tail;let release!:()=>void;const done=new Promise<void>(r=>{release=r;});this.tail=previous.catch(()=>{}).then(()=>done);await previous.catch(()=>{});const abort=()=>{void this.close();};try{signal.throwIfAborted();signal.addEventListener('abort',abort,{once:true});await this.start(config);signal.throwIfAborted();this.submitted=false;this.denied=false;return await fn();}finally{signal.removeEventListener('abort',abort);if(signal.aborted)await this.close();this.gate=undefined;this.mode='read';release();}}

 close(){if(this.closing)return this.closing;const child=this.child;this.child=undefined;this.context=undefined;this.endpoint='';this.closing=(async()=>{await this.browser?.close().catch(()=>{});this.browser=undefined;if(child&&child.exitCode===null&&child.signalCode===null){await new Promise<void>(r=>{const timer=setTimeout(()=>child.kill('SIGKILL'),5000);child.once('exit',()=>{clearTimeout(timer);r();});child.kill('SIGTERM');});}})().finally(()=>{this.closing=undefined;});return this.closing;}
}
