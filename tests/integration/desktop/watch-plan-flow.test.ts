import { installFixtureIPC } from '../../fixtures/desktop/ipc';
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright-core";
import { createServer } from "vite";
import { expect, it } from "vitest";
import { requestRuntime } from "../../../apps/runtime/src/host/connection.js";
import { startRuntime } from "../../../apps/runtime/src/host/lifecycle.js";
import { paths } from "../../../apps/runtime/src/storage/paths.js";

const executable = process.env.BFF_TEST_BROWSER ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

it.skipIf(!existsSync(executable))("creates interest or video plans on either platform only on submit", async () => {
  const data = mkdtempSync(join(tmpdir(), "bff-watch-plan-"));
  const runtime = await startRuntime(paths(data));
  const server = await createServer({configFile: resolve("apps/desktop/vite.config.ts"), server:{
    host:"127.0.0.1", port:0, fs:{allow:[resolve(".")]},
  }});
  await server.listen();
  const browser = await chromium.launch({executablePath:executable,headless:true});
  try {
    const page = await browser.newPage({viewport:{width:390,height:820}, reducedMotion:"reduce"});
    page.setDefaultTimeout(4500);
    const writes:string[] = [];
    await installFixtureIPC(page);
    await page.route("**/ipc/v1/**", async route => {
      const request = route.request(), path = new URL(request.url()).pathname.replace(/^\/ipc/, "");
      const method = request.method();
      if (method !== "GET") writes.push(path);
      const json = await requestRuntime(runtime.connection, path, method, request.postDataJSON() ?? undefined);
      await route.fulfill({json});
    });
    const url = server.resolvedUrls!.local[0]! + "@fs/" + resolve("tests/fixtures/desktop/desktop-usability.html") + "?fish";
    await page.goto(url);
    const dialog = page.getByRole("dialog",{name:"创建计划"});
    const mode = (name:string) => dialog.getByRole("tab", {name,exact:true});
    const save = dialog.getByRole("button",{name:"启用计划"});
    const topic = dialog.getByRole("textbox",{name:"兴趣主题"});
    const video = dialog.getByRole("textbox",{name:"视频链接或 ID"});
    const period = dialog.getByRole("spinbutton",{name:"间隔（分钟）"});
    const fixed = "看指定视频", interest = "按兴趣看";
    const open = (platform:string) => page.getByRole("button",{name:"从"+platform+"创建计划"}).click();
    const inputs = [
      {platform:"bilibili",label:"B站",first:"BV1234567890",second:"BVabc1234567",wrong:"https://www.douyin.com/video/9876543210"},
      {platform:"douyin",label:"抖音",first:"1234567890123456789",second:"2345678901234567890",wrong:"https://www.bilibili.com/video/BVabc1234567/"},
    ];
    const expected:object[] = [];
    for (const {platform,label,first,second,wrong} of inputs) {
      await open(platform);
      expect(await mode(interest).getAttribute("aria-selected")).toBe("true");
      expect(await dialog.getByRole("combobox",{name:"平台"}).textContent()).toContain(label);
      expect(await video.count()).toBe(0);
      await topic.fill("海洋生物");
      await mode(fixed).click(); expect(await topic.count()).toBe(0);
      await video.fill(first);
      await mode(interest).click(); expect(await topic.inputValue()).toBe("海洋生物");
      await period.fill("90");
      await save.click(); await dialog.waitFor({state:"hidden"});
      expected.push({enabled:true,mode:"Autonomous",intervalMinutes:90,choices:[{platform,query:"海洋生物"}]});

      await open(platform); await mode(fixed).click();
      const total = writes.length;
      await video.fill(first+"\n"+wrong);
      await save.click(); await dialog.getByRole("alert").getByText(/第 2 项不是有效的/).waitFor();
      await video.fill(`https://www.${platform}.com.invalid/video/${first}`);
      await save.click(); await dialog.getByRole("alert").getByText(/第 1 项不是有效的/).waitFor();
      await video.fill(Array(11).fill(first).join("\n"));
      await save.click(); await dialog.getByRole("alert").getByText(/最多指定 10 个/).waitFor();
      const entries = first+"\n"+`https://www.${platform}.com/video/${second}/?from=fixture`;
      await video.fill(entries);
      await page.keyboard.press("Escape"); await dialog.waitFor({state:"hidden"});
      expect(writes).toHaveLength(total);
      await page.getByRole("button",{name:"创建计划",exact:true}).click();
      expect(await mode(fixed).getAttribute("aria-selected")).toBe("true");
      expect(await video.inputValue()).toBe(entries);
      await save.click(); await dialog.waitFor({state:"hidden"});
      expected.push({enabled:true,mode:"Scheduled",intervalMinutes:60,choices:[{platform,videoId:first},{platform,videoId:second}]});
    }
    const overview = await requestRuntime<{schedules:object[],tasks:object[]}>(runtime.connection,"/v1/activities");
    expect(overview.schedules).toHaveLength(4);
    for (const schedule of expected) expect(overview.schedules).toContainEqual(expect.objectContaining(schedule));
    expect(overview.tasks).toEqual([]);
    expect(writes).toEqual(Array(4).fill("/v1/schedules"));
  } finally {
    await browser.close(); await server.close(); await runtime.stop(); rmSync(data,{recursive:true,force:true});
  }
},30000);
