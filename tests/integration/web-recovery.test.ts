import {expect,it} from 'vitest';
import {mkdtempSync,rmSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {configureWeb,webConfig} from '../../apps/runtime/src/web/config.js';
import {createWeb} from '../../apps/runtime/src/web/server.js';
import {paths} from '../../apps/runtime/src/paths.js';
import {startRuntime} from '../../apps/runtime/src/lifecycle.js';
import {requestRuntime} from '../../apps/runtime/src/connection.js';

it('recovers expired Web login and invalid plugin JSON without losing retry or ordinary errors',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff-web-recovery-')),p=paths(join(root,'fish')),cert=join(root,'cert'),key=join(root,'key');
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost'],{stdio:'ignore'});
 configureWeb(p,{origin:'https://127.0.0.1:8443',password:'isolated-test-password',cert,key});const config=webConfig(p);config.sessionMs=2000;
 const runtime=await startRuntime(p),app=await createWeb(p,config,{stop:()=>runtime.stop(),start:async()=>{}});
 await app.listen({host:'127.0.0.1',port:0});config.origin=`https://127.0.0.1:${(app.server.address() as {port:number}).port}`;
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
  const pluginDir=join(root,'plugin');mkdirSync(pluginDir);for(const file of ['manifest.json','index.mjs'])writeFileSync(join(pluginDir,file),readFileSync(join('examples/hello-fish',file)));writeFileSync(join(pluginDir,'host.mjs'),readFileSync('plugins/sdk/host.mjs'));
  const bundle=join(root,'hello.bff-plugin');execFileSync(process.execPath,['scripts/pack-plugin.mjs',pluginDir,bundle]);await requestRuntime(runtime.connection,'/v1/plugins/install','POST',JSON.parse(readFileSync(bundle,'utf8')));
  const page=await browser.newPage({ignoreHTTPSErrors:true});page.setDefaultTimeout(5000);const pageErrors:string[]=[];page.on('pageerror',e=>pageErrors.push(e.message));
  const login=async()=>{await page.getByLabel('管理口令').fill('isolated-test-password');await page.getByRole('button',{name:'登录',exact:true}).click();await page.getByText('已连接',{exact:true}).waitFor();};
  await page.goto(config.origin);await login();
  await new Promise(r=>setTimeout(r,2100));await page.getByRole('button',{name:'刷新连接'}).click();await page.getByLabel('管理口令').waitFor();expect(await page.getByRole('alert').innerText()).toContain('登录已过期');
  config.sessionMs=60000;await login();
  // A failed transport and a business permission error must retain the logged-in shell.
  await page.route('**/api/v1/status',r=>r.abort('internetdisconnected'));await page.getByRole('button',{name:'刷新连接'}).click();await page.getByText('未连接',{exact:true}).waitFor();expect(await page.getByRole('button',{name:'退出登录'}).count()).toBe(1);await page.unroute('**/api/v1/status');
  await page.route('**/api/v1/status',r=>r.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:'PLUGIN_DISABLED'})}));await page.getByRole('button',{name:'刷新连接'}).click();await page.getByRole('alert').filter({hasText:'插件已停用或尚未授权。'}).waitFor();expect(await page.getByLabel('管理口令').count()).toBe(0);await page.unroute('**/api/v1/status');await page.getByRole('button',{name:'刷新连接'}).click();await page.getByText('已连接',{exact:true}).waitFor();
  await page.getByRole('button',{name:'插件',exact:true}).click();const own=page.locator('article').filter({has:page.getByRole('heading',{name:'问候鱼 1.0.0'})});
  const configInput=own.getByLabel('配置（不接受密钥等敏感信息）'),enable=own.getByRole('button',{name:'信任并授权启用'});let enableRequests=0;page.on('request',r=>{if(r.url().endsWith('/plugins/hello-fish/enable'))enableRequests++;});
  await configInput.fill('{');await enable.click();await page.getByRole('alert').filter({hasText:'JSON'}).waitFor();expect(await enable.isEnabled()).toBe(true);expect(enableRequests).toBe(0);
  await configInput.fill('{}');await enable.click();await own.getByRole('button',{name:'停用并撤销执行'}).waitFor();expect(enableRequests).toBe(1);
  await page.getByRole('button',{name:'退出登录'}).click();await page.getByLabel('管理口令').waitFor();
  config.sessionMs=2000;await login();await new Promise(r=>setTimeout(r,2100));await page.getByRole('button',{name:'退出登录'}).click();await page.getByLabel('管理口令').waitFor();
  config.sessionMs=60000;await login();
  let releaseOld!:()=>Promise<void>,markHeld!:()=>void;const held=new Promise<void>(r=>{markHeld=r;});
  await page.route('**/api/v1/status',async r=>{releaseOld=()=>r.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'WEB_LOGIN_REQUIRED'})});markHeld();},{times:1});
  await page.getByRole('button',{name:'刷新连接'}).click();await held;await page.getByRole('button',{name:'退出登录'}).click();await page.getByLabel('管理口令').waitFor();await login();await releaseOld();await page.getByRole('button',{name:'刷新连接'}).click();await page.getByText('已连接',{exact:true}).waitFor();expect(await page.getByLabel('管理口令').count()).toBe(0);expect(pageErrors).toEqual([]);
  mkdirSync('build/p7-evidence',{recursive:true});await page.screenshot({path:'build/p7-evidence/rework-web-recovery.png'});writeFileSync('build/p7-evidence/rework-web-recovery.json',JSON.stringify({realTLS:true,realChrome:true,expiredRefreshRecovered:true,expiredLogoutRecovered:true,reloginConnected:true,stalePreviousSession401Ignored:true,ordinaryNetworkAnd403RetainSession:true,invalidJsonRequests:0,correctedJsonRequests:enableRequests,pageErrors},null,2));
 }finally{await browser.close();await app.close();await runtime.stop();rmSync(root,{recursive:true,force:true});}
},30000);
