import {it,expect} from 'vitest';
import {existsSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright-core';
const executable=process.env.BFF_TEST_BROWSER??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
it.skipIf(!existsSync(executable))('keeps QQ autonomy controls compact and issues inside the card',async()=>{
 const server=await createServer({configFile:resolve('apps/desktop/vite.config.ts'),server:{host:'127.0.0.1',port:0,strictPort:false,fs:{allow:[resolve('.')]}}});await server.listen();const browser=await chromium.launch({executablePath:executable,headless:true});
 try{const page=await browser.newPage({viewport:{width:900,height:720}});let options={accountId:'10001',profile:true,posts:true,visibility:'friends',revision:'one'};const saves:unknown[]=[];
 await page.route('**/api/v1/**',async route=>{const path=new URL(route.request().url()).pathname;if(path.endsWith('/self-options')){if(route.request().method()==='PUT'){saves.push(route.request().postDataJSON());options={...options,...route.request().postDataJSON(),revision:'two'};}return route.fulfill({json:options});}if(path.endsWith('/action-issues'))return route.fulfill({json:Array.from({length:20},(_,i)=>({id:'op-'+i,kind:'post',status:'unknown',at:new Date(Date.now()-i*1000).toISOString()}))});return route.fulfill({json:[]});});
 await page.goto(`http://127.0.0.1:${(server.httpServer!.address() as {port:number}).port}/@fs/${resolve('tests/fixtures/desktop-clarity.html')}?qqself`);await page.getByRole('checkbox',{name:'自己发说说'}).waitFor();await page.getByRole('combobox',{name:'说说可见范围'}).click();await page.getByRole('option',{name:'仅自己可见',exact:true}).click();await page.getByRole('button',{name:'保存设置'}).click();await page.getByText('已保存',{exact:true}).waitFor();expect(saves[0]).toMatchObject({visibility:'self',revision:'one'});await page.getByText('仅显示最近 20 条异常记录').waitFor();
 mkdirSync('build/qq-self-tools',{recursive:true});for(const width of [900,380]){await page.setViewportSize({width,height:720});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:`build/qq-self-tools/ui-${width}.png`,fullPage:false});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const scroll=page.getByRole('region',{name:'操作记录'});expect(await scroll.evaluate(el=>el.scrollHeight>el.clientHeight&&getComputedStyle(el).overscrollBehaviorY==='contain')).toBe(true);}
 }finally{await browser.close();await server.close();}
},30000);
