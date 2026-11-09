import { expect,it } from 'vitest';
import { createServer } from 'node:http';
import { mkdtempSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BrowserManager } from '../../apps/runtime/src/douyin/browser.js';
import { WriteGate } from '../../apps/runtime/src/douyin/write-gate.js';
import { paths } from '../../apps/runtime/src/paths.js';

const config={enabled:true,executablePath:'',pythonPath:'python3',headless:true,accountId:'12345'};
it('native redirect guard preserves safe URL/cookies and blocks read/login redirects before transmission on pages, popups and OOPIFs',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff-redirect-')),requests:{url:string;cookie:string}[]=[];
 const server=createServer((req,res)=>{
  const url=req.url??'';requests.push({url,cookie:req.headers.cookie??''});
  if(url==='/start'){res.writeHead(302,{location:'/middle','set-cookie':'redirect_cookie=yes; Path=/'}).end();return;}
  if(url==='/middle'){res.writeHead(307,{location:'/final'}).end();return;}
  if(url==='/unsafe'){res.writeHead(307,{location:'/aweme/v1/web/commit/item/digg/'}).end();return;}
  res.setHeader('content-type','text/html');res.end('<title>safe</title>safe');
 });
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const port=(server.address() as {port:number}).port,base=`http://127.0.0.1:${port}`,cross=`http://localhost:${port}`;
 // No injected transport: native route.fallback -> loopback server -> native
 // Chromium redirects exercise exactly the production forwarding path.
 const manager=new BrowserManager(paths(root));
 try{await manager.lease(config,new AbortController().signal,async()=>{
  const context=manager.context!,page=context.pages()[0]!;
  await page.goto(base+'/start');expect(page.url()).toBe(base+'/final');expect(requests.find(r=>r.url==='/final')?.cookie).toContain('redirect_cookie=yes');
  await expect(page.goto(base+'/unsafe')).rejects.toThrow();expect(manager.denied).toBe(true);
  manager.denied=false;manager.mode='login';
  const fresh=await context.newPage();await fresh.goto(base+'/start');expect(fresh.url()).toBe(base+'/final');
  await expect(fresh.goto(base+'/unsafe')).rejects.toThrow();expect(manager.denied).toBe(true);
  manager.denied=false;const opener=await context.newPage();await opener.goto(base+'/final');
  const popupPromise=opener.waitForEvent('popup');await opener.evaluate(url=>window.open(url),base+'/start');const popup=await popupPromise;
  await popup.waitForURL(base+'/final');await expect(popup.goto(base+'/unsafe')).rejects.toThrow();expect(manager.denied).toBe(true);
  manager.denied=false;await opener.setContent(`<iframe name="remote" src="${cross}/start"></iframe>`);
  const frame=opener.frame({name:'remote'})!;await frame.waitForURL(cross+'/final');
  const frameSession=await context.newCDPSession(frame);
  expect((await frameSession.send('Target.getTargetInfo')).targetInfo.type).toBe('iframe');
  await frameSession.detach();
  await expect(frame.goto(cross+'/unsafe')).rejects.toThrow();expect(manager.denied).toBe(true);
  expect(requests.filter(r=>r.url.includes('/digg/'))).toHaveLength(0);
 });}finally{await manager.close();await new Promise<void>(r=>server.close(()=>r()));rmSync(root,{recursive:true,force:true});}
},30000);

it('login POST redirects keep native GET semantics and pending authorization can still be revoked',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff-login-redirect-'));const received:{method:string;cookie:string;body:string}[]=[];
 const receiver=createServer((req,res)=>{let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{received.push({method:req.method??'',cookie:req.headers.cookie??'',body});res.end('login final');});});
 await new Promise<void>(r=>receiver.listen(0,'127.0.0.1',r));const final=`http://127.0.0.1:${(receiver.address() as {port:number}).port}/final`;
 let status=302,submissions=0;
 const manager=new BrowserManager(paths(root),async context=>{
  await context.addCookies([{name:'sessionid',value:'private-login-cookie',domain:'.douyin.com',path:'/'}]);
  await context.route('**/*',async route=>{
   if(route.request().method()==='POST'){submissions++;await route.fulfill({status,headers:{location:final},body:''});return;}
   await route.fulfill({contentType:'text/html',body:'<form method="POST" action="/passport/login"><input name="credential" value="fixture-only"></form>'});
  });
 });
 try{await manager.lease(config,new AbortController().signal,async()=>{
  const page=await manager.context!.newPage();await page.goto('https://www.douyin.com/login');manager.mode='login';
  await page.evaluate(()=>document.querySelector('form')!.submit());await page.waitForURL(final);
  expect(received).toEqual([{method:'GET',cookie:'',body:''}]);expect(manager.denied).toBe(false);
  status=307;const other=await manager.context!.newPage();await other.goto('https://www.douyin.com/login');
  await other.evaluate(()=>document.querySelector('form')!.submit());await expect.poll(()=>manager.denied).toBe(true);
  expect(submissions).toBe(2);expect(received).toHaveLength(1);
  const action=await manager.context!.newPage();await action.goto('https://www.douyin.com/video/1234567890123456789');
  let revoked=false,checking=false,release!:()=>void;
  const gate=new WriteGate('douyin_like',{aweme_id:'1234567890123456789',undo:false},async()=>{
   if(checking)await new Promise<void>(r=>{release=r;});if(revoked)throw new Error('revoked');
  });
  await gate.arm();checking=true;manager.mode='write';manager.gate=gate;manager.denied=false;
  await action.evaluate(()=>{void fetch('/aweme/v1/web/commit/item/digg/',{method:'POST',body:'aweme_id=1234567890123456789&type=1'}).catch(()=>{});});
  await expect.poll(()=>!!release).toBe(true);revoked=true;release();await expect.poll(()=>manager.denied).toBe(true);
  expect(gate.submitted).toBe(false);expect(submissions).toBe(2);expect(received).toHaveLength(1);
 });}finally{await manager.close();await new Promise<void>(r=>receiver.close(()=>r()));rmSync(root,{recursive:true,force:true});}
},30000);

it('approved POST cannot redirect to an extra endpoint/origin and cancellation stops a pending hop',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff-write-redirect-')),received:string[]=[];let checks=0,initial=0,redirect=true;
 const server=createServer((req,res)=>{received.push(req.method??'');res.end('{}');});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const target=`http://127.0.0.1:${(server.address() as {port:number}).port}/UNAPPROVED`;
 let release!:()=>void,waiting!:()=>void;const held=new Promise<void>(r=>{waiting=r;});let hold=false;
 const manager=new BrowserManager(paths(root),async context=>{
  await context.route('**/*',async route=>{
   const req=route.request();if(req.method()==='POST'){initial++;if(hold){waiting();await new Promise<void>(r=>{release=r;});}await route.fulfill(redirect?{status:307,headers:{location:target},body:''}:{contentType:'application/json',body:'{"status_code":0}'}).catch(()=>{});return;}
   await route.fulfill({contentType:'text/html',body:'<form method="POST" action="/aweme/v1/web/commit/item/digg/"><input name="aweme_id" value="1234567890123456789"><input name="type" value="1"></form>'});
  });
 });
 const abort=new AbortController();
 try{
  await manager.lease(config,abort.signal,async()=>{
   const page=await manager.context!.newPage();await page.goto('https://www.douyin.com/video/1234567890123456789');
   const gate=new WriteGate('douyin_like',{aweme_id:'1234567890123456789',undo:false},async()=>{checks++;});await gate.arm();manager.gate=gate;manager.mode='write';
   await page.evaluate(()=>document.querySelector('form')!.submit());await expect.poll(()=>manager.denied).toBe(true);
   expect(initial).toBe(1);expect(received).toEqual([]);expect(checks).toBe(2);expect(manager.submitted).toBe(true);
  });
  redirect=false;
  await manager.lease(config,abort.signal,async()=>{
   const page=await manager.context!.newPage();await page.goto('https://www.douyin.com/video/1234567890123456789');
   const gate=new WriteGate('douyin_like',{aweme_id:'1234567890123456789',undo:false},async()=>{});await gate.arm();manager.gate=gate;manager.mode='write';
   await page.evaluate(()=>document.querySelector('form')!.submit());await expect.poll(()=>gate.receipt?.verified).toBe(true);expect(initial).toBe(2);
  });
  hold=true;redirect=true;
  const lease=manager.lease(config,abort.signal,async()=>{
   const page=await manager.context!.newPage();await page.goto('https://www.douyin.com/video/1234567890123456789');
   const gate=new WriteGate('douyin_like',{aweme_id:'1234567890123456789',undo:false},async()=>{});await gate.arm();manager.gate=gate;manager.mode='write';
   await page.evaluate(()=>document.querySelector('form')!.submit());await held;abort.abort();release();
  });
  await lease;expect(manager.status().state).toBe('closed');expect(received).toEqual([]);
 }finally{release?.();await manager.close();await new Promise<void>(r=>server.close(()=>r()));rmSync(root,{recursive:true,force:true});}
},30000);

it('dedicated, nested and shared workers preserve native reads and cannot send restricted requests',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff-worker-')),received:string[]=[];
 const server=createServer((req,res)=>{
  const url=req.url??'';received.push(`${req.method} ${url}`);
  if(url.startsWith('/worker.js')||url.startsWith('/shared.js')){
   const shared=url.startsWith('/shared'),startup=new URL(url,'http://fixture').searchParams.get('startup');
   res.setHeader('content-type','text/javascript');
   const run=`async function run(data){try{const r=await fetch(data.url,{method:data.method||'GET'});return {ok:r.ok,text:await r.text(),url:r.url}}catch{return {ok:false}}}`;
   res.end(run+(startup?`void fetch(${JSON.stringify(startup)}).catch(()=>{});`:'')+(shared?'onconnect=e=>{const p=e.ports[0];p.onmessage=async e=>p.postMessage(await run(e.data));p.start();};':'onmessage=async e=>postMessage(await run(e.data));'));return;
  }
  if(url==='/nested.js'){res.setHeader('content-type','text/javascript');res.end("const w=new Worker('/worker.js');w.onmessage=e=>postMessage(e.data);onmessage=e=>w.postMessage(e.data)");return;}
  if(url==='/read-redirect'){res.writeHead(302,{location:'/read-hop','set-cookie':'worker_cookie=yes; Path=/'}).end();return;}
  if(url==='/read-hop'){res.writeHead(307,{location:'/read-final'}).end();return;}
  if(url==='/unsafe'){res.writeHead(307,{location:'/aweme/v1/web/commit/item/digg/'}).end();return;}
  if(url==='/read-final'){res.end(`read:${req.headers.cookie??''}`);return;}
  res.setHeader('content-type','text/html');res.end('<title>worker fixture</title>');
 });
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 const manager=new BrowserManager(paths(root));
 try{await manager.lease(config,new AbortController().signal,async()=>{
  const page=await manager.context!.newPage();await page.goto(base);
  for(const kind of ['dedicated','nested','shared'] as const){
   manager.denied=false;
   // Keep the worker/port alive across requests; immediate startup I/O is also
   // covered below, without waiting for target discovery in the test.
   await page.evaluate(kind=>{
    const w=kind==='shared'?new SharedWorker('/shared.js'):new Worker(kind==='nested'?'/nested.js':'/worker.js');
    const port='port' in w?w.port:w;
    (window as unknown as {worker:Worker|SharedWorker;port:Worker|MessagePort}).worker=w;
    (window as unknown as {port:Worker|MessagePort}).port=port;
    if('start' in port)port.start();
   },kind);
   const request=(url:string,method='GET')=>page.evaluate(({url,method})=>new Promise<{ok:boolean;text?:string;url?:string}>((resolve,reject)=>{
    const port=(window as unknown as {port:Worker|MessagePort}).port;
    const timer=setTimeout(()=>reject(new Error('worker request timed out')),5000);
    port.onmessage=e=>{clearTimeout(timer);resolve(e.data);};port.postMessage({url,method});
   }),{url,method});
   expect(await request('/read-final')).toMatchObject({ok:true});
   expect(await request('/read-redirect')).toEqual({ok:true,text:'read:worker_cookie=yes',url:base+'/read-final'});
   expect(page.isClosed()).toBe(false);expect(manager.denied).toBe(false);
   expect(await request('/aweme/v1/web/commit/item/digg/')).toEqual({ok:false});expect(manager.denied).toBe(true);
   manager.denied=false;expect(await request('/ordinary','POST')).toEqual({ok:false});expect(manager.denied).toBe(true);
   manager.denied=false;expect(await request('/unsafe')).toEqual({ok:false});expect(manager.denied).toBe(true);
   // A shared worker must not borrow another page's approved write/login mode.
   if(kind==='shared'){
    for(const mode of ['write','login'] as const){manager.mode=mode;manager.denied=false;expect(await request('/passport/login','POST')).toEqual({ok:false});expect(manager.denied).toBe(true);}
    manager.mode='read';
   }
   expect(page.isClosed()).toBe(false);
   await page.evaluate(()=>{const w=(window as unknown as {worker:Worker|SharedWorker}).worker;if('terminate' in w)w.terminate();else w.port.close();});
  }
  manager.denied=false;
  // Module initialization fetch precedes onconnect and any page handshake.
  await page.evaluate(()=>{(window as unknown as {startup:SharedWorker}).startup=new SharedWorker('/shared.js?startup=/aweme/v1/web/commit/item/digg/');});
  await expect.poll(()=>manager.denied).toBe(true);expect(page.isClosed()).toBe(false);
  expect(received.filter(url=>url.includes('/digg/')&&!url.includes('/shared.js?'))).toEqual([]);
  expect(received.filter(url=>url.startsWith('POST'))).toEqual([]);
  expect(received.filter(url=>url==='GET /unsafe')).toHaveLength(3);
  expect(received.filter(url=>url==='GET /read-final')).toHaveLength(6);
  expect(await page.evaluate(async()=>{try{const registration=await navigator.serviceWorker.register('/service.js');return registration?'registered':'blocked';}catch{return 'blocked';}})).toBe('blocked');expect(manager.context!.serviceWorkers()).toEqual([]);expect(received).not.toContain('GET /service.js');
 });}finally{await manager.close();await new Promise<void>(r=>server.close(()=>r()));rmSync(root,{recursive:true,force:true});}
},30000);

it('cancelling a shared worker redirect closes owned resources before any restricted hop',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff-shared-cancel-')),received:string[]=[];let release=()=>{},waiting=()=>{};
 const held=new Promise<void>(r=>{waiting=r;});
 const server=createServer((req,res)=>{
  received.push(req.url??'');
  if(req.url==='/shared.js'){res.setHeader('content-type','text/javascript');res.end("void fetch('/held').catch(()=>{});onconnect=()=>{};");return;}
  if(req.url==='/held'){release=()=>{if(!res.headersSent)res.writeHead(307,{location:'/aweme/v1/web/commit/item/digg/'}).end();};waiting();return;}
  res.setHeader('content-type','text/html');res.end('read');
 });
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 const manager=new BrowserManager(paths(root)),abort=new AbortController();
 try{
  await manager.lease(config,abort.signal,async()=>{
   const page=await manager.context!.newPage();await page.goto(base);
   await page.evaluate(()=>{(window as unknown as {worker:SharedWorker}).worker=new SharedWorker('/shared.js');});
   await held;abort.abort();release();
  });
  expect(manager.status().state).toBe('closed');expect(manager.endpoint).toBe('');expect(received.filter(url=>url.includes('/digg/'))).toEqual([]);
 }finally{release();await manager.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));rmSync(root,{recursive:true,force:true});}
},30000);

it('dedicated worker writes retain the same single-use approval and asynchronous revocation boundary',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff-worker-approval-'));let submissions=0,checks=0,revoked=false,checking=false,waiting=false,release=()=>{};
 const manager=new BrowserManager(paths(root),async context=>{
  await context.route('**/*',async route=>{
   const req=route.request();
   if(req.method()==='POST'){submissions++;await route.fulfill({contentType:'application/json',body:'{"status_code":0}'});return;}
   if(new URL(req.url()).pathname==='/worker.js'){
    await route.fulfill({contentType:'text/javascript',body:"onmessage=async()=>{try{const r=await fetch('/aweme/v1/web/commit/item/digg/',{method:'POST',body:'aweme_id=1234567890123456789&type=1'});postMessage(r.ok)}catch{postMessage(false)}}"});return;
   }
   await route.fulfill({contentType:'text/html',body:'worker approval'});
  });
 });
 try{await manager.lease(config,new AbortController().signal,async()=>{
  const page=await manager.context!.newPage();await page.goto('https://www.douyin.com/');
  const write=()=>page.evaluate(()=>new Promise<boolean>(resolve=>{const w=new Worker('/worker.js');w.onmessage=e=>resolve(e.data);w.postMessage('write');}));
  const gate=new WriteGate('douyin_like',{aweme_id:'1234567890123456789',undo:false},async()=>{checks++;});
  await gate.arm();manager.gate=gate;manager.mode='write';
  expect(await write()).toBe(true);await expect.poll(()=>gate.receipt?.verified).toBe(true);
  expect(await write()).toBe(false);expect(submissions).toBe(1);expect(checks).toBe(2);expect(manager.submitted).toBe(true);
  const next=new WriteGate('douyin_like',{aweme_id:'1234567890123456789',undo:false},async()=>{if(checking)await new Promise<void>(r=>{waiting=true;release=r;});if(revoked)throw new Error('revoked');});
  await next.arm();manager.gate=next;manager.denied=false;checking=true;
  let pending=false;const result=write().then(value=>{pending=true;return value;});
  await expect.poll(()=>waiting).toBe(true);
  expect(pending).toBe(false);revoked=true;release();expect(await result).toBe(false);
  expect(next.submitted).toBe(false);expect(submissions).toBe(1);expect(manager.denied).toBe(true);expect(page.isClosed()).toBe(false);
 });}finally{release();await manager.close();rmSync(root,{recursive:true,force:true});}
},30000);
