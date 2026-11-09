import { expect,it } from 'vitest';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import { mkdtempSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright-core';
import type { ChildProcess } from 'node:child_process';
import { startWebSocketPolicy } from '../../plugins/douyin/websocket-policy.mjs';
import { WebSocketServer } from 'ws';
import { BrowserManager } from '../../apps/runtime/src/douyin/browser.js';
import { paths } from '../../apps/runtime/src/paths.js';

const config={enabled:true,executablePath:'',pythonPath:'python3',headless:true,accountId:''};
it('rejects worker WS/WSS before any target connection, preserving startup, nested and module worker HTTP reads',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff-worker-ws-'));
 let connections=0,handshakes=0;const messages:string[]=[],reads:string[]=[];
 // Separate target from the page server: even a WSS TCP/TLS attempt counts as
 // a leak here. A bad certificate cannot make the no-connection assertion pass.
 const receiver=createServer();receiver.on('connection',()=>connections++);
 const ws=new WebSocketServer({server:receiver});ws.on('connection',socket=>{
  handshakes++;socket.on('message',data=>{messages.push(data.toString());socket.send('UNAPPROVED-ACK');});
 });
 await new Promise<void>(r=>receiver.listen(0,'127.0.0.1',r));
 const port=(receiver.address() as {port:number}).port;
 const workerRun=`async function run(url){const outcome=await new Promise(resolve=>{const s=new WebSocket(url);s.onopen=()=>s.send('UNAPPROVED-WORKER-PAYLOAD');s.onmessage=e=>resolve(e.data);s.onerror=()=>resolve('error');s.onclose=()=>resolve('closed');});return {outcome,read:await fetch('/read').then(r=>r.text())};}`;
 const server=createServer((req,res)=>{
  const url=new URL(req.url!,'http://fixture');
  if(url.pathname==='/read'){reads.push(url.pathname);res.end('normal worker read');return;}
  res.setHeader('content-type',url.pathname.endsWith('.js')?'text/javascript':'text/html');
  if(url.pathname==='/worker.js'||url.pathname==='/shared.js'){
   const startup=url.searchParams.get('startup');
   res.end(workerRun+(startup?`const initial=run(${JSON.stringify(startup)});`:'')+(url.pathname==='/shared.js'
    ?`onconnect=e=>{const p=e.ports[0];p.onmessage=async e=>p.postMessage(await ${startup?'initial':'run(e.data)'});p.start()}`
    :`onmessage=async e=>postMessage(await ${startup?'initial':'run(e.data)'});`));return;
  }
  if(url.pathname==='/nested.js'){
   res.end("const w=new Worker('/worker.js');w.onmessage=e=>postMessage(e.data);onmessage=e=>w.postMessage(e.data);");return;
  }
  res.end('<title>isolated websocket boundary</title>');
 });
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 const manager=new BrowserManager(paths(root));
 try{await manager.lease(config,new AbortController().signal,async()=>{
  const page=await manager.context!.newPage();await page.goto(base);
  for(const kind of ['page','dedicated','nested','shared','module','shared-module','startup','shared-startup','blob'] as const){
   for(const scheme of ['ws','wss']){
    manager.denied=false;manager.mode=kind.includes('module')?'write':kind.includes('startup')?'login':'read';
    const url=`${scheme}://${scheme==='ws'?'localhost':'127.0.0.1'}:${port}/${kind}`;
    const result=await page.evaluate(({kind,url,workerRun})=>new Promise<{outcome:string;read:string}>((resolve,reject)=>{
     const timer=setTimeout(()=>reject(new Error(kind+' '+url+' worker websocket timed out')),5000);
     const done=(value:{outcome:string;read:string})=>{clearTimeout(timer);resolve(value);};
     if(kind==='page'){
      const s=new WebSocket(url);s.onopen=()=>s.send('UNAPPROVED-PAGE-PAYLOAD');s.onmessage=e=>done({outcome:e.data,read:''});
      s.onerror=()=>done({outcome:'error',read:''});s.onclose=()=>done({outcome:'closed',read:''});return;
     }
     let source=kind==='nested'?'/nested.js':kind.startsWith('shared')?'/shared.js':'/worker.js';
     if(kind.includes('startup'))source+='?startup='+encodeURIComponent(url);
     if(kind==='blob')source=URL.createObjectURL(new Blob([workerRun.replace("fetch('/read')",`fetch('${location.origin}/read')`)+"onmessage=async e=>postMessage(await run(e.data));"],{type:'text/javascript'}));
     const options={type:kind.includes('module')?'module' as const:'classic' as const};
     const w=kind.startsWith('shared')?new SharedWorker(source,{...options,name:url}):new Worker(source,options);
     (window as unknown as {workers:(Worker|SharedWorker)[]}).workers??=[];
     (window as unknown as {workers:(Worker|SharedWorker)[]}).workers.push(w);
     w.onerror=e=>{clearTimeout(timer);reject(new Error(kind+': '+e.message));};
     const p='port' in w?w.port:w;p.onmessage=e=>{done(e.data);if(kind==='blob')URL.revokeObjectURL(source);};if('start' in p)p.start();p.postMessage(url);
    }),{kind,url,workerRun});
    expect(['error','closed']).toContain(result.outcome);
    if(kind!=='page')expect(result.read).toBe('normal worker read');
    await expect.poll(()=>manager.denied).toBe(true);
    expect(manager.submitted).toBe(false);expect(page.isClosed()).toBe(false);
   }
  }
  expect(reads).toHaveLength(16);expect(connections).toBe(0);expect(handshakes).toBe(0);expect(messages).toEqual([]);
 });}finally{
  await manager.close();for(const socket of ws.clients)socket.terminate();await new Promise<void>(r=>ws.close(()=>r()));
  receiver.closeAllConnections();await new Promise<void>(r=>receiver.close(()=>r()));
  server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});
 }
},30000);

it('has no direct fallback when the owned rejecting proxy disappears and closes its listener on cancellation',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff-worker-ws-close-'));
 let connections=0;const receiver=createServer();receiver.on('connection',socket=>{connections++;socket.destroy();});
 await new Promise<void>(r=>receiver.listen(0,'127.0.0.1',r));
 const server=createServer((req,res)=>{res.setHeader('content-type',req.url==='/worker.js'?'text/javascript':'text/html');res.end(req.url==='/worker.js'?"onmessage=e=>{const s=new WebSocket(e.data);s.onopen=()=>s.send('UNAPPROVED');s.onerror=()=>postMessage('error');};":'<title>proxy lifecycle</title>');});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`,target=`ws://127.0.0.1:${(receiver.address() as {port:number}).port}/failure`;
 const manager=new BrowserManager(paths(root));let proxyPort=0;
 const listening=(port:number)=>new Promise<boolean>(resolve=>{const socket=connect(port,'127.0.0.1');socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',()=>resolve(false));});
 try{
  let denied=0;
  const policy=await startWebSocketPolicy(()=>denied++,()=>{});
  const browser=await chromium.launch({executablePath:manager.discover()[0],headless:true,args:policy.args});
  try{
   const page=await browser.newPage();await page.goto(base);
   const attempt=(url:string)=>page.evaluate(url=>new Promise(resolve=>{
    const w=new Worker('/worker.js');(window as unknown as {w:Worker}).w=w;w.onmessage=e=>resolve(e.data);w.postMessage(url);
   }),url);
   expect(await attempt(target)).toBe('error');expect(denied).toBe(1);
   // Exercise the production network policy with its endpoint gone while the
   // browser stays alive. Killing the host instead also closes Chrome's pipe.
   await policy.close();
   expect(await attempt(target)).toBe('error');expect(await attempt(target.replace('ws:','wss:'))).toBe('error');
   expect(denied).toBe(1);expect(connections).toBe(0);expect(page.isClosed()).toBe(false);
  }finally{await browser.close();await policy.close();}
  const abort=new AbortController();
  await manager.lease(config,abort.signal,async()=>{
   const session=await manager.context!.browser()!.newBrowserCDPSession();const command=await session.send('Browser.getBrowserCommandLine');await session.detach();
   proxyPort=Number(command.arguments.find(a=>a.startsWith('--proxy-server='))!.match(/socks=http:\/\/127\.0\.0\.1:(\d+)/)![1]);
   expect(await listening(proxyPort)).toBe(true);abort.abort();
  });
  expect(manager.status().state).toBe('closed');expect(manager.endpoint).toBe('');expect(await listening(proxyPort)).toBe(false);expect(connections).toBe(0);
 }finally{await manager.close();receiver.closeAllConnections();await new Promise<void>(r=>receiver.close(()=>r()));server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
},30000);

// A signal exit leaves exitCode=null. Shutdown must not wait for a second exit
// event after the owned host is already dead.
it('closes after an already exited host without waiting for another exit event',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff-worker-ws-exit-')),manager=new BrowserManager(paths(root));
 try{
  await manager.start(config);
  const child=(manager as unknown as {child:ChildProcess}).child;
  await new Promise<void>(resolve=>{child.once('exit',()=>resolve());child.kill('SIGKILL');});
  expect(child.signalCode).toBe('SIGKILL');
  await manager.close();expect(manager.status().state).toBe('closed');expect(manager.endpoint).toBe('');
 }finally{await manager.close();rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
},10000);
