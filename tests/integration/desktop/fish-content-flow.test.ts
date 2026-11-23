import { installFixtureIPC } from '../../fixtures/desktop/ipc';
import { expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright-core";

const executable = process.env.BFF_TEST_BROWSER ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
it.skipIf(!existsSync(executable))("opens the promised fish task, reads memories first, and consumes each platform plan once", async () => {
  const server = await createServer({configFile: resolve("apps/desktop/vite.config.ts"), server: { host: "127.0.0.1", port: 0, strictPort: false, fs: {allow:[resolve(".")]} }});
  await server.listen();
  const browser = await chromium.launch({executablePath: executable, headless:true});
  try {
    const page = await browser.newPage({viewport:{width:390,height:820}, reducedMotion:"reduce"});
    page.setDefaultTimeout(4000);
    const button = (name: string) => page.getByRole("button", {name, exact:true});
    const tab = (name: string) => page.getByRole("tab", {name, exact:true}).click();
    const writes: string[] = [];
    let hasMemory = false, sceneOnly = false, broken = false;
    const records = [{ id:"manual", subject:"手动记录", sources:[{type:"user",id:"manual",quote:"手填"}] },
      { id:"auto", subject:"喜欢海边", sources:[{type:"message",id:"conversation-1",quote:"周末想去看海。"}] }]
      .map(row => ({...row,role:"owner",personKey:"owner",scopeKey:"owner",kind:"preference",content:row.subject+"的内容",importance:3,status:"confirmed",visibility:"private",version:1,conflicts:[]}));
    await installFixtureIPC(page);
    await page.route("**/ipc/v1/**", async r => {
      const path = new URL(r.request().url()).pathname, body = r.request().postDataJSON() ?? {};
      if(r.request().method() !== "GET" && !path.endsWith("/search")) writes.push(path);
      if (broken && path.endsWith("/memories/search")) return r.fulfill({status:503,json:{error:"UNAVAILABLE"}});
      const json = path.endsWith("/life/updates") ? {revision:"1"} : path === "/ipc/v1/life" ?
        { persona:{name:"大肥鱼",avatar:""},mood:{mood:"开心",reason:"一起看海"},activity:[],recent:[],diaries:[],interests:[],relationships:[],confirmedCount:0,chattingCount:0 }
        : path.endsWith("/memories/search") ? hasMemory && !body.query ? records : [] : path.endsWith("/memory-scenes/search") ? sceneOnly ? [{id:"scene"}] : []
        : path.endsWith("/activities") ? { paused:false, tasks:[], schedules:[] } : [];
      return r.fulfill({ json });
    });
    const url = `http://127.0.0.1:${(server.httpServer!.address() as {port:number}).port}/@fs/${resolve("tests/fixtures/desktop/desktop-usability.html")}?fish`;
    await page.goto(url);
    await page.getByText("开心 · 一起看海",{exact:true}).waitFor();
    expect(await page.getByText("暂无经历",{exact:true}).count()).toBe(0);
    await button("去写第一篇").click();
    await page.getByRole("dialog",{name:"手动写日记"}).getByLabel("日记日期").waitFor();
    expect(await page.getByRole("tab",{name:"日记",exact:true}).getAttribute("aria-selected")).toBe("true");
    await page.keyboard.press("Escape");
    await tab("概览");await tab("经历");
    expect(await page.getByRole("dialog").count()).toBe(0);
    await tab("记忆");
    await page.getByRole("heading",{name:"还没有记忆",exact:true}).waitFor();
    expect(await button("从对话整理").count()).toBe(0);
    expect(await page.getByRole("textbox",{name:"搜索",exact:true}).count()).toBe(0);
    await button("和它聊聊").click();await page.getByRole("heading",{name:"回到聊天"}).waitFor();
    sceneOnly=true;await page.reload();await tab("记忆");
    await page.getByText("还没有已记住的事项",{exact:true}).waitFor();
    expect(await page.getByRole("heading",{name:"还没有记忆",exact:true}).count()).toBe(0);
    await tab("概览");hasMemory=true;await tab("记忆");
    await page.getByRole("heading",{name:"喜欢海边",exact:true}).waitFor();
    expect(await page.getByText("手动记录",{exact:true}).count()).toBe(0);
    await button("浏览全部记忆").click();await page.getByRole("heading",{name:"手动记录",exact:true}).waitFor();
    await page.getByLabel("搜索",{exact:true}).fill("没有的词");
    await button("清除筛选").click();await page.getByRole("heading",{name:"喜欢海边",exact:true}).waitFor();
    expect(await page.getByLabel("搜索",{exact:true}).inputValue()).toBe("");
    await tab("概览");broken=true;await tab("记忆");await page.getByRole("alert").waitFor();
    expect(await page.getByRole("heading",{name:"还没有记忆",exact:true}).count()).toBe(0);
    for(const [platform,label] of [["bilibili","B站"],["douyin","抖音"],["douyin","抖音"]]){
      await button("从"+platform+"创建计划").click();
      const dialog=page.getByRole("dialog",{name:"创建计划"});
      expect(await dialog.getByRole("combobox",{name:"平台"}).textContent()).toContain(label);
      await page.keyboard.press("Escape");await tab("概览");await tab("活动计划");
      expect(await page.getByRole("dialog").count()).toBe(0);
    }
    expect(writes).toEqual([]);
  } finally { await browser.close();await server.close(); }
}, 30000);

it.skipIf(!existsSync(executable))("separates the diary from experiences and keeps observed interests and relationships off the overview", async () => {
  const server = await createServer({configFile:resolve("apps/desktop/vite.config.ts"),server:{host:"127.0.0.1",port:0,fs:{allow:[resolve(".")]}}});
  await server.listen();
  const browser = await chromium.launch({executablePath:executable,headless:true});
  try {
    const page = await browser.newPage({viewport:{width:320,height:720},reducedMotion:"reduce"});
    page.setDefaultTimeout(4000);
    await installFixtureIPC(page);
    const diary = {id:"d1",day:"2026-11-21",content:"今天和朋友看了日落。",copyStatus:"failed",sources:[{type:"activity",id:"a1",quote:"海边日落"}]};
    const recent = [{id:"a1",kind:"chat.completed",summary:"完成对话：海边散步",occurredAt:"2026-11-21T18:02:00Z"}];
    const requests:string[] = [];
    await page.route("**/ipc/v1/**", async route => {
      const path = new URL(route.request().url()).pathname.replace("/ipc/v1/", "");
      requests.push(path);
      if (path === "diaries/d1/rebuild") diary.copyStatus = "ready";
      const response:Record<string,unknown> = {
        "life/updates":{revision:"1"},
        life:{persona:{name:"小肥鱼"},mood:{mood:"平静"},diaries:[diary],activity:[],recent,
          interests:[{id:"i",content:"喜欢喝茶"}],relationships:[{id:"r",content:"新认识的朋友"}],confirmedCount:2,chattingCount:0},
        activities:{paused:false,tasks:[],schedules:[]}, "life/timeline":recent, diaries:[diary],
        "memory-tasks":[{id:"t1",kind:"diary",status:"completed"},{id:"t2",kind:"extract",status:"running"}],
        "life/source":{content:"那天的原始活动",occurredAt:recent[0].occurredAt}
      };
      return route.fulfill({json:response[path] ?? {}});
    });
    await page.goto(server.resolvedUrls!.local[0]+"@fs/"+resolve("tests/fixtures/desktop/desktop-usability.html")+"?fish");
    const button = (name:string) => page.getByRole("button",{name,exact:true});
    const tab = (name:string) => page.getByRole("tab",{name,exact:true});
    await page.getByText(diary.content,{exact:true}).waitFor();
    for (const text of ["最近经历","兴趣与关系","喜欢喝茶","新认识的朋友","聊了聊：海边散步"])
      expect(await page.getByText(text,{exact:true}).count()).toBe(0);

    await button("向右滚动分类").waitFor();
    await button("查看全部日记").click();
    await button("重试保存副本").waitFor();
    expect(await tab("日记").getAttribute("aria-selected")).toBe("true");
    expect(requests).not.toContain("life/timeline");
    await button("查看来源（1）").click();
    await button("打开原文").click();
    await page.getByText("那天的原始活动",{exact:true}).waitFor();
    await button("重试保存副本").click();
    await button("重试保存副本").waitFor({state:"hidden"});
    await button("日记生成记录").click();
    await page.getByText("日记 · 已完成",{exact:true}).waitFor();
    expect(await page.getByText("记忆整理 · 正在整理",{exact:true}).count()).toBe(0);

    requests.length = 0;
    await tab("日记").focus();
    await page.keyboard.press("ArrowLeft");
    await page.getByText("聊了聊：海边散步",{exact:true}).waitFor();
    expect(await tab("经历").getAttribute("aria-selected")).toBe("true");
    expect(await page.getByText(diary.content,{exact:true}).count()).toBe(0);
    expect(await button("手动写日记").count()).toBe(0);
    expect(requests).toContain("life/timeline");
    expect(requests).not.toContain("diaries");
    expect(requests).not.toContain("memory-tasks");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  } finally { await browser.close(); await server.close(); }
}, 30000);
