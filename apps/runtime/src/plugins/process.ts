import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { InputError } from '../ai/types.js';
export class PluginProcess {
 private child:ChildProcessWithoutNullStreams;private pending=new Map<string,{resolve:(v:unknown)=>void;reject:(e:Error)=>void;timer:NodeJS.Timeout;cleanup:()=>void;controller:AbortController}>();private closed=false;private revoked=false;private hostCount=0;private stopped:Promise<void>;
 constructor(directory:string,entry:string,private host:(method:string,args:unknown,signal:AbortSignal)=>Promise<unknown>,private exited:()=>void){
  const env:NodeJS.ProcessEnv={};for(const k of ['PATH','SystemRoot','WINDIR','TMP','TEMP','TMPDIR','LANG'])if(process.env[k])env[k]=process.env[k];
  this.child=spawn(process.execPath,[join(directory,entry)],{cwd:directory,env,stdio:['pipe','pipe','pipe'],windowsHide:true,detached:process.platform!=='win32'});let buffer='';
  this.stopped=new Promise(resolve=>this.child.once('close',()=>{this.exited();resolve();}));
  this.child.stdout.setEncoding('utf8');this.child.stdout.on('data',(data:string)=>{buffer+=data.toString();if(Buffer.byteLength(buffer)>262144){void this.stop();return;}let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);void this.message(line);}});this.child.stderr.resume();this.child.on('error',()=>void this.stop());this.child.on('exit',()=>void this.stop());
 }
 private async message(line:string){let b;try{b=JSON.parse(line);if(typeof b.id!=='string'||b.id.length>100)throw new Error();if(b.host){
   if(this.closed||this.revoked||typeof b.method!=='string'||typeof b.callId!=='string'||!this.pending.has(b.callId)||this.hostCount>=8)throw new Error('PLUGIN_HOST_DENIED');this.hostCount++;
   try{const result=await this.host(b.method,b.args,this.pending.get(b.callId)!.controller.signal);if(!this.closed&&!this.revoked&&this.pending.has(b.callId))this.write({id:b.id,host:true,result});}finally{this.hostCount--;}
  }else{const p=this.pending.get(b.id);if(!p)return;this.pending.delete(b.id);clearTimeout(p.timer);p.cleanup();p.controller.abort();if(b.error)p.reject(new InputError(b.error==='QQ_APPROVAL_REMOVED'?'QQ_APPROVAL_REMOVED':'PLUGIN_CALL_FAILED',409));else p.resolve(b.result);}
 }catch(error){if(b?.host&&!this.closed){try{this.write({id:b.id,host:true,error:error instanceof InputError&&error.message==='QQ_APPROVAL_REMOVED'?'QQ_APPROVAL_REMOVED':'PLUGIN_HOST_DENIED'});}catch{void this.stop();}}else void this.stop();}}
 private write(b:unknown){const value=JSON.stringify(b);if(this.closed||Buffer.byteLength(value)>262144)throw new InputError('PLUGIN_UNAVAILABLE',409);this.child.stdin.write(value+'\n');}
 call(method:string,args:unknown,signal?:AbortSignal,timeoutMs=10000):Promise<unknown>{if(this.revoked&&method!=='dispose')throw new InputError('PLUGIN_STOPPED',409);if(this.pending.size>=8)throw new InputError('PLUGIN_BUSY',429);signal?.throwIfAborted();const id=randomUUID(),controller=new AbortController();return new Promise((resolve,reject)=>{const cancel=()=>{void this.stop();};const timer=setTimeout(()=>{void this.stop();},timeoutMs);const cleanup=()=>signal?.removeEventListener('abort',cancel);this.pending.set(id,{resolve,reject,timer,cleanup,controller});signal?.addEventListener('abort',cancel,{once:true});try{this.write({id,method,args});}catch(e){this.pending.delete(id);clearTimeout(timer);cleanup();reject(e);}});}
 // Revoke host capabilities synchronously; bounded plugin cleanup may finish afterward.
 revoke(){this.revoked=true;for(const p of this.pending.values())p.controller.abort();}
 stop(){if(this.closed)return this.stopped;this.closed=true;const pending=[...this.pending.values()];for(const p of pending){p.controller.abort();clearTimeout(p.timer);p.cleanup();}this.pending.clear();this.child.stdin.destroy();if(this.child.pid&&process.platform!=='win32'){try{process.kill(-this.child.pid,'SIGKILL');}catch{/* exited */}}else this.child.kill('SIGKILL');void this.stopped.then(()=>{for(const p of pending)p.reject(new InputError('PLUGIN_STOPPED',409));});return this.stopped;}
 async dispose(){this.revoke();try{await this.call('dispose',{});}finally{await this.stop();}}
}
