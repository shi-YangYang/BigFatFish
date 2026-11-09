import {it,expect} from 'vitest';
import {existsSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright-core';
const executable=process.env.BFF_TEST_BROWSER??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
it.skipIf(!existsSync(executable))('keeps QQ contact refresh busy separate from the previous settings save',async()=>{
 const server=await createServer({configFile:resolve('apps/desktop/vite.config.ts'),server:{host:'127.0.0.1',port:0,strictPort:false,fs:{allow:[resolve('.')]}}});await server.listen();
 const browser=await chromium.launch({executablePath:executable,headless:true});const releases=new Set<()=>void>();
 try{
  const page=await browser.newPage({viewport:{width:900,height:720},reducedMotion:'reduce'});page.setDefaultTimeout(5000);
  let gate:{path:string;entered:()=>void;wait:Promise<void>}|undefined,revision=0,rejectSave=false;
  const pause=(path:string)=>{let entered!:()=>void,release!:()=>void;const reached=new Promise<void>(r=>{entered=r;}),wait=new Promise<void>(r=>{release=()=>{releases.delete(release);r();};});releases.add(release);gate={path,entered,wait};return {reached,release};};
  const config={mode:'managed',url:'ws://127.0.0.1:3001',accountId:'10001',ownerId:'20002',enabled:true,groups:[],friendIds:[],replyEnabled:true,proactiveEnabled:false};
  const component={phase:'online',supported:true,engine:'docker',busy:false,account:{id:'10001',name:'测试鱼'}};
  const contacts={accountId:'10001',friends:[{id:'20002',name:'主人'}],groups:[]};
  await page.route('**/api/v1/**',async route=>{
   const path=new URL(route.request().url()).pathname.slice(4);
   if(gate?.path===path){const current=gate;gate=undefined;current.entered();await current.wait;}
   if(path==='/v1/channels/qq/component/settings'){
    if(rejectSave)return route.fulfill({status:409,json:{error:'CHANNEL_VERSION_CONFLICT'}});
    revision++;return route.fulfill({json:{}});
   }
   const data:Record<string,unknown>={'/v1/channels/qq':{config,revision:String(revision),health:{state:'online'},hasToken:true,builtin:true},'/v1/channels/qq/component':component,'/v1/channels/qq/component/contacts':contacts,'/v1/channels/qq/component/contacts/refresh':contacts};
   return route.fulfill({json:data[path]??{}});
  });
  await page.goto(`http://127.0.0.1:${(server.httpServer!.address() as {port:number}).port}/@fs/${resolve('tests/fixtures/desktop-clarity.html')}?qqconnection`);
  const save=page.getByRole('button',{name:'保存设置',exact:true}),refresh=page.getByRole('button',{name:'刷新好友和群聊'});
  const saving=pause('/v1/channels/qq/component/settings');await save.click();await saving.reached;
  expect(await save.getAttribute('aria-busy')).toBe('true');expect(await refresh.getAttribute('aria-busy')).not.toBe('true');saving.release();
  await page.waitForFunction(()=>document.querySelector('.qq-reply-actions button')?.getAttribute('aria-busy')!=='true');
  const refreshing=pause('/v1/channels/qq/component/contacts/refresh');await refresh.click();await refreshing.reached;
  expect(await refresh.getAttribute('aria-busy')).toBe('true');expect(await save.getAttribute('aria-busy')).not.toBe('true');expect(await save.isDisabled()).toBe(true);
  mkdirSync('build/qq-response-feedback',{recursive:true});await page.screenshot({path:'build/qq-response-feedback/contacts-busy-r1.png'});refreshing.release();
  await page.waitForFunction(()=>document.querySelector('button[aria-label="刷新好友和群聊"]')?.getAttribute('aria-busy')!=='true');expect(await save.isEnabled()).toBe(true);expect(await refresh.isEnabled()).toBe(true);
  rejectSave=true;await save.click();await page.locator('.qq-reply-card').getByRole('alert').getByText('回复设置已在其他地方更新，请重新打开页面后修改。').waitFor();
  expect(await page.locator('.qq-account-card').getByRole('alert').count()).toBe(0);expect(await save.getAttribute('aria-busy')).not.toBe('true');
 }finally{for(const release of releases)release();await browser.close();await server.close();}
},15000);
it.skipIf(!existsSync(executable))('handles native string errors, partial records and visible pending connection actions',async()=>{
 const server=await createServer({configFile:resolve('apps/desktop/vite.config.ts'),server:{host:'127.0.0.1',port:0,strictPort:false,fs:{allow:[resolve('.')]}}});await server.listen();
 const browser=await chromium.launch({executablePath:executable,headless:true});const releases=new Set<()=>void>();
 try{
  const page=await browser.newPage({viewport:{width:900,height:720},reducedMotion:'reduce'});page.setDefaultTimeout(7000);
  await page.addInitScript(()=>{Object.assign(window,{__TAURI_INTERNALS__:{invoke:async(_command:string,args:{route:string;method:string;body?:unknown})=>{const r=await fetch('/fixture'+args.route,{method:args.method,headers:{'content-type':'application/json'},body:args.body===undefined?undefined:JSON.stringify(args.body)});const data=await r.json();if(!r.ok)throw data.error;return data;}}});});
  let old=true,unconfigured=false;
  let gate:{path:string;entered:()=>void;wait:Promise<void>}|undefined;
  const pause=(path:string)=>{let entered!:()=>void,release!:()=>void;const reached=new Promise<void>(r=>{entered=r;}),wait=new Promise<void>(r=>{release=()=>{releases.delete(release);r();};});releases.add(release);gate={path,entered,wait};return {reached,release};};
  const qr=await createRequire(import.meta.url)('qrcode').toDataURL('Spec057 isolated fixture');
  const config={mode:'managed',url:'ws://127.0.0.1:3001',accountId:'10001',ownerId:'20002',enabled:true,groups:[],friendIds:[],replyEnabled:true,proactiveEnabled:false};
  const component={phase:'ready',supported:true,engine:'docker',busy:false,qr:undefined as string|undefined,loginPhase:undefined as string|undefined,account:undefined as {id:string;name:string}|undefined};
  const bili={enabled:false,revision:'one',accountState:'signed-out',connection:{phase:'idle',login:{status:'waiting',image:qr}}};
  const douyin={config:{enabled:false,executablePath:'',pythonPath:'python3',accountId:'',headless:false},accountState:'unverified',revision:'one',connection:{phase:'idle',loginState:''}};
  await page.route('**/fixture/v1/**',async route=>{
   const request=route.request(),path=new URL(request.url()).pathname.slice(8);
   if(gate?.path===path){const current=gate;gate=undefined;current.entered();await current.wait;}
   if(path.endsWith('/self-options'))return route.fulfill(old||unconfigured?{status:404,json:{error:unconfigured?'CHANNEL_NOT_CONFIGURED':'Not Found'}}:{json:{accountId:'10001',profile:true,posts:false,visibility:'friends',revision:'one'}});
   if(path.endsWith('/message-issues'))return route.fulfill({json:[{id:'old-message',kind:'send_failed',at:'2026-01-01T00:00:00Z',target:{kind:'private',id:'20002'}}]});
   if(path.endsWith('/action-issues'))return route.fulfill(old?{status:404,json:{error:'Not Found'}}:{json:[]});
   if(path==='/v1/channels/qq/component/connect')Object.assign(component,{phase:'installing',busy:true});
   if(path==='/v1/channels/qq/component/stop')Object.assign(component,{phase:'ready',busy:false});
   if(path==='/v1/bilibili/connect')bili.connection.phase='connecting';
   if(path==='/v1/douyin/connect')douyin.connection.phase='connecting';
   const data:Record<string,unknown>={'/v1/channels/qq':{config,revision:'one',health:{state:'online'},hasToken:true,builtin:true},'/v1/channels/qq/component':component,'/v1/channels/qq/component/contacts':{accountId:'10001',friends:[{id:'20002',name:'主人'}],groups:[]},'/v1/bilibili':bili,'/v1/bilibili/tasks':[],'/v1/douyin':douyin,'/v1/activities':{tasks:[],schedules:[]}};
   return route.fulfill({json:data[path]??{}});
  });
  const url=`http://127.0.0.1:${(server.httpServer!.address() as {port:number}).port}/@fs/${resolve('tests/fixtures/desktop-clarity.html')}`;
  await page.goto(url+'?qqself');const self=page.getByRole('article').filter({has:page.getByRole('heading',{name:'自主活动'})}),messages=page.getByRole('article').filter({has:page.getByRole('heading',{name:'操作记录'})});
  await self.getByText('请重新启动大肥鱼，再重试。').waitFor();await messages.getByText('消息发送失败',{exact:true}).waitFor();await messages.getByText('请重新启动大肥鱼，再重试。').waitFor();expect(await messages.getByText('暂无需要处理的问题').count()).toBe(0);
  mkdirSync('build/qq-response-feedback',{recursive:true});await page.screenshot({path:'build/qq-response-feedback/old-runtime-partial.png'});
  old=false;const reading=pause('/v1/channels/qq/self-options');await self.getByRole('button',{name:'重试'}).click();await reading.reached;await self.getByRole('status',{name:'正在加载',exact:true}).waitFor();reading.release();await self.getByRole('button',{name:'保存设置'}).waitFor();
  const saving=pause('/v1/channels/qq/self-options');await self.getByRole('button',{name:'保存设置'}).click();await saving.reached;expect(await self.getByRole('button',{name:/正在保存/}).getAttribute('aria-busy')).toBe('true');saving.release();await self.getByText('已保存',{exact:true}).waitFor();
  await messages.getByRole('alert').waitFor({state:'detached'});expect(await messages.getByText('消息发送失败',{exact:true}).isVisible()).toBe(true);
  unconfigured=true;await page.reload();await page.getByText('连接并设置 QQ 后可使用自主活动').waitFor();expect(await self.getByRole('alert').count()).toBe(0);unconfigured=false;
  await page.goto(url+'?qqconnection');const connecting=pause('/v1/channels/qq/component/connect');await page.getByRole('button',{name:'连接 QQ',exact:true}).click();await connecting.reached;expect(await page.getByRole('button',{name:/连接 QQ/}).getAttribute('aria-busy')).toBe('true');connecting.release();await page.locator('[data-badge-label]').getByText('正在准备组件',{exact:true}).waitFor();
  expect(await page.locator('.account-status svg').count()).toBe(1);await page.screenshot({path:'build/qq-response-feedback/qq-installing.png'});
  Object.assign(component,{phase:'login',busy:false,loginPhase:'waiting_qrcode',qr});await page.getByRole('img',{name:'QQ 登录二维码'}).waitFor();expect(await page.locator('.account-status svg').count()).toBe(0);expect(await page.getByRole('button',{name:'刷新二维码'}).isEnabled()).toBe(true);
  component.loginPhase='qrcode_scanned';await page.locator('[data-badge-label]').getByText('等待手机确认',{exact:true}).waitFor();expect(await page.locator('.account-status svg').count()).toBe(1);
  Object.assign(component,{phase:'online',loginPhase:undefined,qr:undefined,account:{id:'10001',name:'测试鱼'}});await page.getByRole('button',{name:'保存设置',exact:true}).waitFor();const contacts=pause('/v1/channels/qq/component/contacts/refresh');await page.getByRole('button',{name:'刷新好友和群聊'}).click();await contacts.reached;expect(await page.getByRole('button',{name:'刷新好友和群聊'}).getAttribute('aria-busy')).toBe('true');contacts.release();
  for(const [platform,connectPath,button,label] of [['bili','/v1/bilibili/connect','连接 B站','连接中'],['douyin','/v1/douyin/connect','连接抖音','正在打开登录']] as const){
   await page.goto(url+'?'+platform);const connecting=pause(connectPath);await page.getByRole('button',{name:button,exact:true}).click();await connecting.reached;expect(await page.getByRole('button',{name:new RegExp(button)}).getAttribute('aria-busy')).toBe('true');connecting.release();await page.locator('[data-badge-label]').getByText(label,{exact:true}).waitFor();expect(await page.locator('.platform-account-heading svg').count()).toBe(1);
   for(const width of [900,380]){await page.setViewportSize({width,height:720});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:`build/qq-response-feedback/${platform}-loading-${width}.png`});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  }
 }finally{for(const release of releases)release();await browser.close();await server.close();}
},40000);
