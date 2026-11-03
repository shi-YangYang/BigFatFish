import {expect,it} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {request} from 'node:https';
import WebSocket from 'ws';
import {chromium} from 'playwright-core';
import {configureWeb,webConfig} from '../../apps/runtime/src/web/config.js';
import {createWeb} from '../../apps/runtime/src/web/server.js';
import {paths} from '../../apps/runtime/src/paths.js';
import {startRuntime} from '../../apps/runtime/src/lifecycle.js';
import {requestRuntime} from '../../apps/runtime/src/connection.js';
import {fixtureModel} from '../fixtures/model.mjs';
it('real TLS, browser login/chat/backup and auth/CSRF/Host/WS/revocation boundaries',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff-web-')),p=paths(join(root,'fish')),cert=join(root,'cert.pem'),key=join(root,'key.pem'),fixture=await fixtureModel();
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost'],{stdio:'ignore'});configureWeb(p,{origin:'https://127.0.0.1:8443',password:'isolated-test-password',cert,key});const config=webConfig(p);let runtime=await startRuntime(p);const app=await createWeb(p,config,{stop:()=>runtime.stop(),start:async()=>{runtime=await startRuntime(p);}});await app.listen({host:'127.0.0.1',port:0});config.origin=`https://127.0.0.1:${(app.server.address() as {port:number}).port}`;
 const http=(path:string,method='GET',body?:unknown,headers:Record<string,string>={})=>new Promise<{status:number;body:Record<string,unknown>;cookie:string}>((resolve,reject)=>{const req=request(config.origin+path,{method,rejectUnauthorized:false,headers:{...(body?{'content-type':'application/json'}:{}),...headers}},res=>{let raw='';res.on('data',b=>raw+=b);res.on('end',()=>resolve({status:res.statusCode!,body:JSON.parse(raw||'{}'),cookie:res.headers['set-cookie']?.[0]?.split(';')[0]??''}));});req.on('error',reject);req.end(body?JSON.stringify(body):undefined);});
 let browser;
 try{
  expect((await http('/api/v1/status')).status).toBe(401);expect((await http('/auth/login','POST',{password:'isolated-test-password'})).status).toBe(403);
  const login=await http('/auth/login','POST',{password:'isolated-test-password'},{origin:config.origin});expect(login.status).toBe(200);const headers={origin:config.origin,cookie:login.cookie,'x-bff-csrf':String(login.body.csrf)};
  expect((await http('/api/v1/status','GET',undefined,headers)).body.state).toBe('running');expect((await http('/api/v1/persona','PUT',{}, {origin:config.origin,cookie:login.cookie})).status).toBe(403);
  expect((await http('/api/v1/status','GET',undefined,{...headers,host:'evil.test'})).status).toBe(403);expect((await http('/api/v1/status','GET',undefined,{...headers,'x-forwarded-host':'evil.test'})).status).toBe(403);expect((await http('/api/v1/shutdown?x=1','POST',{},headers)).status).toBe(403);
  const ws=new WebSocket(config.origin.replace('https','wss')+'/events?conversationId=missing',{rejectUnauthorized:false,origin:config.origin});ws.on('error',()=>{});expect(await new Promise<number>(resolve=>ws.once('unexpected-response',(_r,res)=>{res.resume();ws.terminate();resolve(res.statusCode!);}))).toBe(401);
  await requestRuntime(runtime.connection,'/v1/models','POST',{id:'web',label:'本地测试',provider:'openai',baseURL:fixture.url,model:'fixture-model',contextWindow:8192,maxTokens:512,timeoutMs:20000,vision:false});await requestRuntime(runtime.connection,'/v1/model-routes','PUT',{chat:'web'});
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const page=await browser.newPage({ignoreHTTPSErrors:true});await page.goto(config.origin);await page.getByLabel('管理口令').fill('isolated-test-password');await page.getByRole('button',{name:'登录',exact:true}).click();await page.getByRole('button',{name:'聊天',exact:true}).click();await page.getByRole('button',{name:'新对话',exact:true}).click();await page.getByRole('textbox',{name:'消息',exact:true}).fill('从真实浏览器发消息');await page.getByRole('button',{name:'发送',exact:true}).click();await page.getByText('测试模型回复',{exact:true}).waitFor();await page.getByRole('button',{name:'插件',exact:true}).click();await page.getByRole('heading',{name:'插件',exact:true}).waitFor();
  const backup=await http('/maintenance/export','POST',{},headers);expect(backup.status,JSON.stringify(backup.body)).toBe(200);expect(backup.body.state).toBe('completed');const restore=await http('/maintenance/restore','POST',{data:backup.body.data},headers);expect(restore.body.state,JSON.stringify(restore.body)).toBe('completed');expect((await http('/api/v1/conversations','GET',undefined,headers)).body).toHaveLength(1);
  expect((await http('/auth/logout','POST',{},headers)).status).toBe(200);expect((await http('/api/v1/status','GET',undefined,headers)).status).toBe(401);
 }finally{await browser?.close();await app.close();await runtime.stop();await fixture.close();rmSync(root,{recursive:true,force:true});}
},60000);
it('active gateway blocks credential replacement; expires sessions and rate limits failed logins',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff-web-expiry-')),p=paths(join(root,'fish')),cert=join(root,'cert'),key=join(root,'key');execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost'],{stdio:'ignore'});const input={origin:'https://127.0.0.1:8443',password:'isolated-test-password',cert,key};configureWeb(p,input);const c=webConfig(p);c.sessionMs=10;const app=await createWeb(p,c,{stop:async()=>{},start:async()=>{}});
 try{expect(()=>configureWeb(p,{...input,password:'new-isolated-password'})).toThrow('WEB_STOP_REQUIRED');const headers={host:'127.0.0.1:8443',origin:c.origin};const login=await app.inject({method:'POST',url:'/auth/login',headers,payload:{password:input.password}});expect(login.statusCode).toBe(200);await new Promise(r=>setTimeout(r,20));expect((await app.inject({url:'/auth/session',headers:{...headers,cookie:String(login.headers['set-cookie']).split(';')[0]}})).statusCode).toBe(401);for(let i=0;i<4;i++)await app.inject({method:'POST',url:'/auth/login',headers,payload:{password:'wrong'}});expect((await app.inject({method:'POST',url:'/auth/login',headers,payload:{password:'wrong'}})).statusCode).toBe(429);
 }finally{await app.close();rmSync(root,{recursive:true,force:true});}
});
