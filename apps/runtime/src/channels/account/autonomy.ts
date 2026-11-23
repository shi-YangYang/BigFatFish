import type {QQActionState} from './action-state.js';
import type {SelfOptions} from './action-state.js';
export interface SelfRun {accountId:string;options:SelfOptions;guard:()=>void;run:(signal:AbortSignal)=>Promise<void>}
export class QQAutonomy {
 private timer:NodeJS.Timeout;private active?:{control:AbortController;promise:Promise<void>};private closed=false;
 constructor(private state:QQActionState,private snapshot:()=>SelfRun|undefined){this.timer=setInterval(()=>void this.tick(),30000).unref();}
 tick(){if(this.closed)return Promise.resolve();if(this.state.paused()){this.cancel();return Promise.resolve();}if(this.active)return this.active.promise;const snap=this.snapshot();if(!snap||(!snap.options.profile&&!snap.options.posts)||!this.state.due(snap.accountId))return Promise.resolve();const control=new AbortController();
  const promise=Promise.resolve().then(async()=>{snap.guard();if(this.state.paused())return;await snap.run(AbortSignal.any([control.signal,AbortSignal.timeout(60000)]));}).catch(()=>{/* Action failures have their own durable records; decisions retry only at the next bounded slot. */}).finally(()=>{this.active=undefined;});this.active={control,promise};return promise;
 }
 cancel(){this.active?.control.abort();}
 async close(){this.closed=true;clearInterval(this.timer);this.cancel();await this.active?.promise;}
}
