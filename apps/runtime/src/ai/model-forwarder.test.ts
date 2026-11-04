import { expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { forwardModel } from './model-forwarder.js';
const listen = async (server: Server) => { server.listen(0,'127.0.0.1'); await once(server,'listening'); return `http://127.0.0.1:${(server.address() as {port:number}).port}`; };
it('forwards real chunks without output overrides and cancels upstream when the caller disconnects', async () => {
 let ended = false, observed: Record<string,unknown> = {};
 const upstream = createServer(async (req,res) => { let raw=''; for await (const c of req) raw+=c; observed=JSON.parse(raw); expect(req.headers.authorization).toBe('Bearer fixture-provider'); res.writeHead(200,{'content-type':'text/event-stream'}); res.write('data: first\n\n'); res.once('close',()=>{ended=true;}); });
 const url=await listen(upstream), signal=new AbortController();
 const bridge=createServer((req,res)=>void forwardModel(req,res,url,'fixture-provider',signal.signal)); const proxy=await listen(bridge);
 try {
  const response=await fetch(proxy,{method:'POST',body:JSON.stringify({messages:[],stream:true,max_tokens:512,max_completion_tokens:512})});
  const reader=response.body!.getReader(); const first=await reader.read(); expect(new TextDecoder().decode(first.value)).toContain('first'); expect(ended).toBe(false);
  expect(observed).not.toHaveProperty('max_tokens');expect(observed).not.toHaveProperty('max_completion_tokens');
  await reader.cancel(); for(let i=0;i<50&&!ended;i++)await new Promise(r=>setTimeout(r,10));expect(ended).toBe(true);
 } finally { signal.abort();bridge.closeAllConnections();upstream.closeAllConnections();await Promise.all([new Promise<void>(r=>bridge.close(()=>r())),new Promise<void>(r=>upstream.close(()=>r()))]); }
});
it('does not follow upstream redirects or expose provider error bodies', async () => {
 let hits=0;const upstream=createServer((req,res)=>{hits++;if(req.headers.authorization==='Bearer redirect')res.writeHead(302,{location:'/secret'}).end('credential');else res.writeHead(401).end('fixture-private-key');});const url=await listen(upstream);
 let key='error';const bridge=createServer((req,res)=>void forwardModel(req,res,url,key,new AbortController().signal));const proxy=await listen(bridge);
 try { const send=()=>fetch(proxy,{method:'POST',body:JSON.stringify({messages:[]})});let r=await send();expect(r.status).toBe(401);expect(await r.text()).toBe('{}');key='redirect';r=await send();expect(r.status).toBe(502);expect(await r.text()).toBe('{}');expect(hits).toBe(2); }
 finally{bridge.closeAllConnections();upstream.closeAllConnections();await Promise.all([new Promise<void>(r=>bridge.close(()=>r())),new Promise<void>(r=>upstream.close(()=>r()))]);}
});
