import {it,expect} from 'vitest';
import {existsSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright-core';
const executable=process.env.BFF_TEST_BROWSER??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
it.skipIf(!existsSync(executable))('keeps automatic diary settings compact, saves whole hours and supports old runtimes',async()=>{
 const server=await createServer({configFile:resolve('apps/desktop/vite.config.ts'),server:{host:'127.0.0.1',port:0,strictPort:false,fs:{allow:[resolve('.')]}}});await server.listen();const browser=await chromium.launch({executablePath:executable,headless:true});
 try{const page=await browser.newPage({viewport:{width:900,height:680}});let options={enabled:true,hour:23,timezone:'Asia/Shanghai',revision:'r1',since:'2026-11-07',last:null},missing=false;const saves:unknown[]=[];
 await page.route('**/api/v1/**',async route=>{const path=new URL(route.request().url()).pathname;
 if(path.endsWith('/diary-options')){if(missing)return route.fulfill({status:404,json:{error:'NOT_FOUND'}});if(route.request().method()==='PUT'){const body=route.request().postDataJSON();saves.push(body);options={...options,...body,revision:'r2'};}return route.fulfill({json:options});}
 return route.fulfill({json:path.endsWith('/life/updates')?{revision:'one'}:[]});});
 const url=`http://127.0.0.1:${(server.httpServer!.address() as {port:number}).port}/@fs/${resolve('tests/fixtures/desktop-clarity.html')}?life`;
 await page.goto(url);await page.getByRole('checkbox',{name:'自动写日记'}).waitFor();expect(await page.getByRole('region',{name:'手动写日记',exact:true}).count()).toBe(0);await page.getByRole('button',{name:'日记设置',exact:true}).click();await page.getByRole('combobox',{name:'写日记的时间'}).click();await page.getByRole('option',{name:'22:00',exact:true}).click();await page.getByRole('button',{name:'保存',exact:true}).click();await page.getByText('每天 22:00',{exact:true}).waitFor();expect(saves[0]).toMatchObject({hour:22,timezone:'Asia/Shanghai',enabled:true,revision:'r1'});
 mkdirSync('build/emotional-life',{recursive:true});for(const width of [900,380]){await page.setViewportSize({width,height:720});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:`build/emotional-life/diary-${width}.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.getByRole('button',{name:'手动写日记',exact:true}).click();await page.getByLabel('日记日期').waitFor();missing=true;await page.reload();await page.getByText('自动日记需要重启新版后台后使用。').waitFor();await page.getByRole('button',{name:'手动写日记',exact:true}).click();await page.getByLabel('日记日期').waitFor();expect(await page.getByRole('alert').count()).toBe(0);
 }finally{await browser.close();await server.close();}
},30000);
