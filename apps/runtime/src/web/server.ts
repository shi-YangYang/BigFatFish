import {acquireInstance} from '../instance.js';
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import WebSocket from 'ws';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPassword, type WebConfig } from './config.js';
import { readConnection } from '../connection.js';
import { publicError } from '../arguments.js';
import type { DataPaths } from '../paths.js';
import { exportArchive, inspectArchive, restoreArchive, type Scope } from '../maintenance/archive.js';
export async function createWeb(p:DataPaths,c:WebConfig,processes:{stop:()=>Promise<unknown>;start:()=>Promise<unknown>;update?:(action:string)=>Promise<unknown>}){
 const app=Fastify({logger:false,https:{key:readFileSync(c.key),cert:readFileSync(c.cert)},bodyLimit:180*1024*1024,requestTimeout:15000,forceCloseConnections:true,trustProxy:false});
 const release=acquireInstance(join(p.runtime,'web-instance.sqlite'));
 const sessions=new Map<string,{csrf:string;expires:number;sockets:Set<WebSocket>}>(), attempts=new Map<string,{count:number;until:number}>();
 const cookie=(headers:{cookie?:string})=>headers.cookie?.match(/(?:^|; )__Host-bff=([a-f0-9]{64})(?:;|$)/)?.[1];
 const revoke=(id:string)=>{const s=sessions.get(id);s?.sockets.forEach(ws=>ws.close(1008));sessions.delete(id);};
 const timer=setInterval(()=>{for(const [id,s]of sessions)if(s.expires<=Date.now())revoke(id);for(const [id,a]of attempts)if(a.until<Date.now())attempts.delete(id);},1000);timer.unref();
 app.addHook('onClose',async()=>{clearInterval(timer);for(const id of sessions.keys())revoke(id);release();});
 app.addHook('onRequest',async(req,reply)=>{
  reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff').header('Referrer-Policy','no-referrer').header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' blob: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  if(req.headers.host!==new URL(c.origin).host||req.headers['x-forwarded-host']||req.headers['x-forwarded-proto']||req.headers.forwarded||req.headers.origin&&req.headers.origin!==c.origin||req.headers['sec-fetch-site']==='cross-site')return reply.code(403).send({error:'WEB_ORIGIN_DENIED'});
  const write=!['GET','HEAD'].includes(req.method);
  if(write&&req.headers.origin!==c.origin)return reply.code(403).send({error:'WEB_ORIGIN_DENIED'});
  if(req.url==='/auth/login')return;
  if(req.url==='/'||/^\/assets\/[a-zA-Z0-9._-]+$/.test(req.url))return;
  const s=sessions.get(cookie(req.headers)??'');
  if(!s||s.expires<=Date.now())return reply.code(401).send({error:'WEB_LOGIN_REQUIRED'});
  if(write&&req.headers['x-bff-csrf']!==s.csrf)return reply.code(403).send({error:'WEB_CSRF_DENIED'});
 });
 app.setErrorHandler((e,_req,reply)=>reply.code((e as {statusCode?:number}).statusCode??400).send({error:publicError(e)}));
 app.post('/auth/login',{bodyLimit:4096},async(req,reply)=>{
  const ip=req.ip,a=attempts.get(ip)??{count:0,until:Date.now()+60000};
  if(a.until>Date.now()&&a.count>=5)return reply.code(429).send({error:'WEB_RATE_LIMIT'});
  if(!attempts.has(ip)&&attempts.size>=1000)return reply.code(429).send({error:'WEB_RATE_LIMIT'});a.count++;attempts.set(ip,a);
  if(!checkPassword(c,(req.body as {password?:unknown})?.password))return reply.code(401).send({error:'WEB_LOGIN_FAILED'});
  if(sessions.size>=100)return reply.code(429).send({error:'WEB_RATE_LIMIT'});
  const old=cookie(req.headers);if(old)revoke(old);const id=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');sessions.set(id,{csrf,expires:Date.now()+c.sessionMs,sockets:new Set()});
  reply.header('Set-Cookie',`__Host-bff=${id}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(c.sessionMs/1000)}`);return {csrf};
 });
 app.get('/auth/session',async req=>({csrf:sessions.get(cookie(req.headers)!)!.csrf}));
 app.post('/auth/logout',async(req,reply)=>{revoke(cookie(req.headers)!);reply.header('Set-Cookie','__Host-bff=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0');return {loggedOut:true};});
 await app.register(websocket,{options:{maxPayload:1024}});
 app.get<{Querystring:{conversationId?:string}}>('/events',{websocket:true},(socket,req)=>{
  const s=sessions.get(cookie(req.headers)!)!;if(req.headers.origin!==c.origin||!req.query.conversationId||req.query.conversationId.length>100){socket.close(1008);return;}
  s.sockets.add(socket);const connection=readConnection(p),upstream=new WebSocket(`ws://127.0.0.1:${connection.port}/v1/events?conversationId=${encodeURIComponent(req.query.conversationId)}`,{headers:{authorization:`Bearer ${connection.token}`},maxPayload:1048576});
  upstream.on('message',data=>{if(socket.bufferedAmount>1048576){socket.close(1013);return;}if(socket.readyState===WebSocket.OPEN)socket.send(data.toString());});upstream.on('error',()=>socket.close(1011));upstream.on('close',()=>socket.close(1012));socket.on('close',()=>{s.sockets.delete(socket);upstream.terminate();});socket.on('error',()=>upstream.terminate());
 });
 let busy=false;const directory=join(p.runtime,'web-transfer');mkdirSync(directory,{recursive:true,mode:0o700});
 app.post('/maintenance/:action',async(req,reply)=>{
  const action=(req.params as {action:string}).action,b=req.body as {data?:string;password?:string;scopes?:Scope[];credentials?:boolean};if(!['export','restore'].includes(action))return reply.code(400).send({error:'INVALID_ARGUMENTS'});if(busy)return reply.code(409).send({error:'MAINTENANCE_BUSY'});busy=true;
  const file=join(directory,randomUUID());let stopped=false;
  try{if(action==='restore'){if(typeof b.data!=='string'||b.data.length>179000000)throw new Error('INVALID_ARCHIVE');writeFileSync(file,Buffer.from(b.data,'base64'),{mode:0o600,flag:'wx'});inspectArchive(file,b.password);}
   await processes.stop();stopped=true;
   const result=action==='export'?await exportArchive(p,file,{password:b.password,scopes:b.scopes,credentials:b.credentials}):restoreArchive(p,file,b.password);
   await processes.start();stopped=false;
   return action==='export'?{state:'completed',data:readFileSync(file).toString('base64')}:{state:'completed',...result};
  }finally{try{if(stopped)await processes.start();}finally{rmSync(file,{force:true});busy=false;}}
 });
 app.post('/update/:action',{bodyLimit:4096},async(req,reply)=>{
  const action=(req.params as {action:string}).action;if(!['check','install','rollback'].includes(action)||!processes.update)return reply.code(400).send({error:'UPDATE_UNAVAILABLE'});if(busy)return reply.code(409).send({error:'MAINTENANCE_BUSY'});busy=true;
  try{const result=await processes.update(action);if(action!=='check')await processes.start();return {state:'completed',result,restartConsole:action!=='check'};}finally{busy=false;}
 });
 app.all('/api/*',{bodyLimit:24_000_000},async(req,reply)=>{
  if(busy)return reply.code(503).send({error:'MAINTENANCE_BUSY'});
  const route=req.url.slice(4),pathname=new URL(route,'http://localhost').pathname;if(!/^\/v1\/[a-zA-Z0-9/_-]+$/.test(pathname)||new URL(route,'http://localhost').pathname==='/v1/shutdown'||route.includes('..')||route.includes('\\'))return reply.code(403).send({error:'FORBIDDEN'});
  const connection=readConnection(p),response=await fetch(`http://127.0.0.1:${connection.port}${route}`,{method:req.method,headers:{authorization:`Bearer ${connection.token}`,'content-type':'application/json'},...(!['GET','HEAD','DELETE'].includes(req.method)?{body:JSON.stringify(req.body??{})}:{}),redirect:'error',signal:AbortSignal.timeout(195000)});
  reply.code(response.status).type('application/json');return response.text();
 });
 const root=fileURLToPath(new URL(import.meta.url.includes('/dist/')?'../../../web/':'../../../../dist/web/',import.meta.url));
 app.get('/',async(_req,reply)=>reply.type('text/html').send(readFileSync(join(root,'index.html'))));
 app.get<{Params:{name:string}}>('/assets/:name',async(req,reply)=>{if(!/^[a-zA-Z0-9._-]+\.(js|css)$/.test(req.params.name))return reply.code(404).send();return reply.type(req.params.name.endsWith('.js')?'application/javascript':'text/css').send(readFileSync(join(root,'assets',req.params.name)));});
 return app;
}
