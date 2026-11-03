import type { Browser, BrowserContext, Page } from 'playwright-core';

type Mode='read'|'login'|'write';
export function requestPolicy(url:string,method:string,mode:Mode){
 const u=new URL(url),mutating=!['GET','HEAD','OPTIONS'].includes(method);
 const write=mutating||/\/(digg|comment\/publish|comment\/reply|aweme\/create|item\/create|draft\/save|save_draft|aweme\/publish|message\/send|send_message|share|upload)(\/|\?|$)/i.test(u.pathname);
 const auth=/passport|login|logout|account\/update/i.test(u.pathname)&&mutating;
 const login=auth&&mode==='login'&&u.protocol==='https:'&&/^(www\.)?douyin\.com$/.test(u.hostname);
 return {write,auth,login};
}

// Playwright 1.58 routes only the first request in a redirect chain. Chromium's
// Fetch domain still pauses each hop before transmission. The normal route owns
// initial authorization/receipts; this guard rejects restricted redirect hops
// and unroutable shared-worker writes, never granting another approval use.
// Safe reads and page login keep native URL, cookie and redirect semantics.
type Send=(method:string,params?:Record<string,unknown>)=>Promise<unknown>;
interface Message{id?:number;method?:string;params?:Record<string,unknown>;result?:unknown;error?:unknown}

export class RedirectGuard{
 private pages=new WeakMap<Page,Promise<void>>();
 private closed=false;
 constructor(private context:BrowserContext,private mode:()=>Mode,private denied:()=>void){
  context.once('close',()=>{this.closed=true;});
 }
 async start(browser:Browser){
  // Dedicated workers inherit the owning frame's Fetch interception, but
  // shared workers have an independent loader and are not routed by PW 1.58.
  // Browser-level Fetch covers that loader before any page/worker is released.
  const session=await browser.newBrowserCDPSession(),shared=new Set<string>();
  const remember=(info:{type:string;targetId:string})=>{if(info.type==='shared_worker')shared.add(info.targetId);};
  session.on('Target.targetCreated',event=>remember(event.targetInfo));
  session.on('Target.targetInfoChanged',event=>remember(event.targetInfo));
  // Retain IDs until browser closure: a terminated worker can still have a
  // paused request. IDs are unique for this owned browser, never reused.
  this.context.once('close',()=>shared.clear());
  const filter=[{type:'shared_worker',exclude:false},{exclude:true}];
  await session.send('Target.setDiscoverTargets',{discover:true,filter});
  session.on('Fetch.requestPaused',event=>{
   void (async()=>{
    const policy=requestPolicy(event.request.url,event.request.method,this.mode());
    const restricted=policy.write||policy.auth;
    if(restricted&&!shared.has(event.frameId)){
     // Resolve after pausing, not just from event delivery order. A newly
     // created shared worker must not send before discovery catches up.
     for(const info of (await session.send('Target.getTargets',{filter})).targetInfos)remember(info);
    }
    // No Playwright Request/Response exists for shared-worker fetches, so no
    // immutable approval or receipt can be bound. Reads are native; writes
    // are refused even during a page's approved write/login lease.
    const blocked=this.closed||restricted&&shared.has(event.frameId);
    if(blocked)this.denied();
    await session.send(blocked?'Fetch.failRequest':'Fetch.continueRequest',{
     requestId:event.requestId,...(blocked?{errorReason:'BlockedByClient' as const}:{}),
    });
   })().catch(()=>{if(!this.closed){this.denied();void browser.close().catch(()=>{});}});
  });
  await session.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 }
 ensure(page:Page){
  let ready=this.pages.get(page);
  if(!ready){ready=this.attach(page);this.pages.set(page,ready);}
  return ready;
 }
 private async attach(page:Page){
  const session=await this.context.newCDPSession(page);
  const send=session.send.bind(session) as Send;
  const pending=new Set<Promise<void>>();
  const register=(wire:Send,onEvent:(handler:(event:Message)=>void)=>void,resume=false)=>{
   let nextId=0;
   const callbacks=new Map<string,{resolve:(value:unknown)=>void;reject:(error:unknown)=>void}>();
   const children=new Map<string,(event:Message)=>void>();
   page.once('close',()=>{for(const callback of callbacks.values())callback.reject(new Error('BROWSER_CLOSED'));callbacks.clear();children.clear();});
   onEvent(event=>{
    if(event.method==='Fetch.requestPaused'){
     const e=event.params as unknown as {requestId:string;redirectedRequestId?:string;request:{url:string;method:string}};
     const policy=requestPolicy(e.request.url,e.request.method,this.mode());
     const blocked=this.closed||!!e.redirectedRequestId&&((policy.write&&!policy.login)||(policy.auth&&this.mode()!=='login'));
     if(blocked)this.denied();
     void wire(blocked?'Fetch.failRequest':'Fetch.continueRequest',{
      requestId:e.requestId,...(blocked?{errorReason:'BlockedByClient'}:{}),
     }).catch(()=>{}); // Browser shutdown cancels the native request as well.
    }else if(event.method==='Target.attachedToTarget'){
     const e=event.params as unknown as {sessionId:string;waitingForDebugger:boolean};
     const childSend:Send=(method,params)=>new Promise((resolve,reject)=>{
      const id=++nextId,key=`${e.sessionId}:${id}`;callbacks.set(key,{resolve,reject});
      void wire('Target.sendMessageToTarget',{sessionId:e.sessionId,message:JSON.stringify({id,method,params})}).catch(error=>{callbacks.delete(key);reject(error);});
     });
     const task=register(childSend,handler=>children.set(e.sessionId,handler),e.waitingForDebugger);
     pending.add(task);void task.catch(()=>{this.denied();void page.close().catch(()=>{});}).finally(()=>pending.delete(task));
    }else if(event.method==='Target.receivedMessageFromTarget'){
     const e=event.params as unknown as {sessionId:string;message:string};
     const message=JSON.parse(e.message) as Message;
     if(message.id!==undefined){const key=`${e.sessionId}:${message.id}`,callback=callbacks.get(key);callbacks.delete(key);if(message.error)callback?.reject(message.error);else callback?.resolve(message.result);}
     else children.get(e.sessionId)?.(message);
    }else if(event.method==='Target.detachedFromTarget'){
     const id=String(event.params?.sessionId);children.delete(id);
     for(const [key,callback] of callbacks)if(key.startsWith(id+':')){callbacks.delete(key);callback.reject(new Error('BROWSER_TARGET_CLOSED'));}
    }
   });
   return (async()=>{
    await wire('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
    // OOPIFs (including nested frames) need their own interception. Keep them
    // paused until the same guard is installed, then preserve native execution.
    // A dedicated worker has no Fetch domain; its network is already paused
    // by this frame. Only OOPIFs require another Fetch-capable session.
    await wire('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:false,filter:[{type:'iframe',exclude:false},{exclude:true}]});
    if(resume)await wire('Runtime.runIfWaitingForDebugger');
   })();
  };
  await register(send,handler=>{
   for(const name of ['Fetch.requestPaused','Target.attachedToTarget','Target.receivedMessageFromTarget','Target.detachedFromTarget'] as const)session.on(name,params=>handler({method:name,params:params as unknown as Record<string,unknown>}));
  });
  await Promise.all(pending);
 }
}
