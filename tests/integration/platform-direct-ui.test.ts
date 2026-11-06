import { it, expect } from 'vitest';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import type { ActivityTask } from '../../apps/runtime/src/tasks/queue.js';
const executable=process.env.BFF_TEST_BROWSER??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
it.skipIf(!existsSync(executable)).each(['desktop', 'web'])('%s keeps activity controls in My Fish and submits Douyin interactions into operation records',async(host)=>{
 const server=await createServer({configFile:resolve('apps', host, 'vite.config.ts'),server:{host:'127.0.0.1',port:0,strictPort:false,fs:{allow:[resolve('.')]}}});await server.listen();
 const browser=await chromium.launch({executablePath:executable,headless:true});
 try{
   const page=await browser.newPage({viewport:{width:900,height:760},reducedMotion:'reduce'});page.setDefaultTimeout(4000);
   const requests:{route:string;method:string;body:Record<string,unknown>}[]=[],errors:string[]=[];let tasks:ActivityTask[]=[],paused=false;
   page.on('pageerror',error=>errors.push(error.message));
   const call=(route:string,method='GET',body:Record<string,unknown>={})=>{
    requests.push({route,method,body});
    if(route.includes('approvals'))throw new Error('Removed endpoint requested');
    if(route==='/v1/douyin/write'){
     const task={id:'write-'+tasks.length,platform:'douyin',kind:'write',mode:'Activity',input:body,status:tasks.length?'unknown':'completed',result:null,error:tasks.length?'ACTION_UNKNOWN':null,createdAt:new Date().toISOString()};tasks=[task,...tasks];return task;
    }
    if(route==='/v1/activities/pause'){paused=Boolean(body.paused);return {paused};}
    const data:Record<string,unknown>={
     '/v1/status':{state:'running'},'/v1/models':[],'/v1/model-routes':{},'/v1/conversations':[],
     '/v1/activities':{paused,tasks,schedules:[]},
     '/v1/life/updates':{revision:'fixture'},'/v1/life':{persona:{name:'大肥鱼'},activity:[],interests:[],relationships:[],recent:[],diaries:[]},
     '/v1/channels/qq':{config:null,health:{state:'stopped'}},'/v1/bilibili':{enabled:false,accountState:'unverified'},
     '/v1/douyin':{revision:'fixture',config:{enabled:true,accountId:'12345',executablePath:'',pythonPath:'python3',headless:false},browser:{state:'ready'},accountState:'verified',connection:{phase:'online'}},
    };return data[route]??[];
   };
   if(host==='desktop'){
    await page.exposeFunction('fixtureInvoke',(cmd:string,args:{route:string;method?:string;body?:Record<string,unknown>})=>cmd==='desktop_settings'?{complete:true}:cmd==='runtime_status'?{}:cmd==='runtime_request'?call(args.route,args.method,args.body):{});
    await page.addInitScript(()=>{Object.assign(window,{__TAURI_INTERNALS__:{invoke:(cmd:string,args:unknown)=>(window as unknown as {fixtureInvoke:(cmd:string,args:unknown)=>unknown}).fixtureInvoke(cmd,args)}});});
   }else{
    await page.route('**/api/v1/**',route=>route.fulfill({json:call(new URL(route.request().url()).pathname.slice(4),route.request().method(),route.request().postDataJSON()??{})}));
    await page.route('**/auth/session',route=>route.fulfill({json:{csrf:'fixture'}}));
    await page.route('**/auth/logout',route=>route.fulfill({json:{}}));
   }
   await page.goto(`http://127.0.0.1:${(server.httpServer!.address() as {port:number}).port}`);
   const header=page.locator('.topbar:visible');
   await header.getByRole('button',{name:'新对话',exact:true}).waitFor();
   expect(await header.getByRole('button',{name:'运行状态',exact:true}).count()).toBe(0);
   await page.setViewportSize({width:380,height:760});
   await header.getByRole('button',{name:'新对话',exact:true}).click();
   expect(await header.locator('.status-dot').count()).toBe(0);
   expect(requests.some(r=>r.route==='/v1/activities')).toBe(false);
   await header.getByRole('button',{name:'打开导航',exact:true}).click();
   await page.getByRole('dialog',{name:'导航',exact:true}).getByRole('button',{name:'我的鱼',exact:true}).click();
   await page.getByRole('tab',{name:'活动计划',exact:true}).click();
   expect(await page.getByRole('button',{name:/审批/}).count()).toBe(0);
   const pause=page.getByRole('button',{name:'暂停全部活动',exact:true});
   await pause.click();
   await page.getByRole('button',{name:'恢复活动',exact:true}).click();
   await pause.waitFor();
   expect(requests.filter(r=>r.route==='/v1/activities/pause').map(r=>r.body.paused)).toEqual([true,false]);
   await page.setViewportSize({width:900,height:760});
   await page.getByRole('button',{name:'连接',exact:true}).click();
   await page.getByRole('article').filter({has:page.getByRole('heading',{name:'抖音',exact:true})}).getByRole('button',{name:'管理连接'}).click();
   await page.getByRole('tab',{name:'互动',exact:true}).click();
   await page.getByLabel('视频 ID',{exact:true}).fill('1234567890123456789');
   mkdirSync('build/approval-removal',{recursive:true});await page.screenshot({path:`build/approval-removal/${host}-interaction.png`});
   await page.getByRole('button',{name:'点赞',exact:true}).click();
   await page.getByRole('heading',{name:'操作记录',exact:true}).waitFor();await page.getByText('已完成',{exact:true}).waitFor();
   await page.getByRole('tab',{name:'互动',exact:true}).click();
   await page.getByRole('combobox',{name:'操作',exact:true}).click();await page.getByRole('option',{name:'评论',exact:true}).click();
   await page.getByLabel('正文',{exact:true}).fill('这是夹具评论');await page.getByRole('button',{name:'发送评论',exact:true}).click();
   await page.getByText('操作结果未知，请先在平台核对，勿直接重试。',{exact:true}).waitFor();
   await page.screenshot({path:`build/approval-removal/${host}-records.png`});
   const writes=requests.filter(r=>r.route==='/v1/douyin/write');expect(writes).toHaveLength(2);expect(writes[0]?.body).toMatchObject({tool:'douyin_like',requestId:expect.any(String)});expect(writes[1]?.body).toMatchObject({tool:'douyin_comment',args:{text:'这是夹具评论'}});expect(writes[0]?.body.requestId).not.toBe(writes[1]?.body.requestId);
   expect(requests.some(r=>r.route.includes('approvals'))).toBe(false);expect(await page.getByText(/审批/).count()).toBe(0);expect(errors).toEqual([]);
   await page.getByRole('button',{name:'设置',exact:true}).click();
   const logout=page.getByRole('button',{name:'退出登录',exact:true});
   if(host==='web'){
    await page.getByRole('tab',{name:'数据',exact:true}).click();
    expect(await logout.count()).toBe(0);
    await page.getByRole('tab',{name:'通用',exact:true}).click();
    await logout.click();
    await page.getByLabel('管理口令').waitFor();
   }else{
    await page.getByRole('tab',{name:'通用',exact:true}).click();
    expect(await logout.count()).toBe(0);
   }
   expect(errors).toEqual([]);
   await page.close();
 }finally{await browser.close();await server.close();}
},30000);
