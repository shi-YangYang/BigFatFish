import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { it, expect } from "vitest";
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { installFixtureIPC } from "../../fixtures/desktop/ipc";

const executable = process.env.BFF_TEST_BROWSER ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
it.skipIf(!existsSync(executable))("saves a diary schedule once, keeps the existing timezone when paused, and spaces the real settings drawer", async () => {
  const server = await createServer({configFile:resolve("apps/desktop/vite.config.ts"),server:{host:"127.0.0.1",port:0,strictPort:false,fs:{allow:[resolve(".")]}}});
  await server.listen();
  const browser = await chromium.launch({executablePath:executable,headless:true});
  try {
    const page = await browser.newPage({viewport:{width:900,height:720},reducedMotion:"reduce"});
    const options = {enabled:true,hour:23,timezone:"Australia/Brisbane",revision:"r1",last:null};
    const saves:unknown[] = [];
    let missing = false;
    await installFixtureIPC(page);
    await page.route("**/ipc/v1/**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/diary-options")) {
        if (missing) return route.fulfill({status:404,json:{error:"NOT_FOUND"}});
        if (route.request().method() === "PUT") {
          const body = route.request().postDataJSON(); saves.push(body);
          Object.assign(options,body,{revision:"r"+(saves.length+1)});
        }
        return route.fulfill({json:options});
      }
      return route.fulfill({json:path.endsWith("/life/updates") ? {revision:"one"} : []});
    });
    await page.goto(server.resolvedUrls!.local[0]+"@fs/"+resolve("tests/fixtures/desktop/desktop-clarity.html")+"?life");
    await page.getByText("还没有日记。",{exact:true}).waitFor();
    const open = () => page.getByRole("button",{name:"日记设置",exact:true}).click();
    const dialog = page.getByRole("dialog",{name:"日记设置"});
    const toggle = dialog.getByRole("checkbox",{name:"自动写日记"});
    const time = dialog.getByRole("combobox",{name:"写日记的时间"});
    const zone = dialog.getByRole("textbox",{name:"时区"});
    const save = dialog.getByRole("button",{name:"保存",exact:true});
    expect(await toggle.count()).toBe(0);
    await open();
    await toggle.waitFor();
    expect(await save.isDisabled()).toBe(true);
    expect(await zone.inputValue()).toBe("Australia/Brisbane");
    await time.click(); await page.getByRole("option",{name:"22:00",exact:true}).click();

    const output = resolve("build/ui-density-fix");
    mkdirSync(output,{recursive:true});
    const measurements = [];
    for (const width of [900,390]) {
      await page.setViewportSize({width,height:740});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const rect = (await zone.boundingBox())!;
      const action = (await save.boundingBox())!;
      const fieldGap = action.y - rect.y - rect.height;
      expect(fieldGap).toBeGreaterThanOrEqual(12);
      expect(fieldGap).toBeLessThanOrEqual(24);
      expect(await dialog.getByText(/^每天 \d\d?:00$/).count()).toBe(0);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      measurements.push({width,inputToSave:fieldGap});
      await dialog.screenshot({path:output+"/after-diary-"+width+".png"});
    }
    writeFileSync(output+"/after-diary.json",JSON.stringify(measurements));
    expect(saves).toEqual([]);
    await save.click(); await dialog.waitFor({state:"hidden"});
    expect(saves).toEqual([{enabled:true,hour:22,timezone:"Australia/Brisbane",revision:"r1"}]);
    await open(); await zone.fill("Europe/Paris"); await toggle.uncheck();
    expect(await time.count()).toBe(0);
    await save.click(); await dialog.waitFor({state:"hidden"});
    expect(saves[1]).toEqual({enabled:false,hour:22,timezone:"Australia/Brisbane",revision:"r2"});
    await open(); await toggle.check(); expect(await zone.inputValue()).toBe("Australia/Brisbane");
    await zone.fill("Europe/Paris"); await save.click(); await dialog.waitFor({state:"hidden"});
    expect(saves[2]).toEqual({enabled:true,hour:22,timezone:"Europe/Paris",revision:"r3"});
    await open(); await toggle.uncheck(); await page.keyboard.press("Escape");
    expect(saves).toHaveLength(3);
    missing=true;
    await open(); await dialog.getByText("自动日记需要重启新版后台后使用。").waitFor();
    await page.keyboard.press("Escape"); await page.getByRole("button",{name:"手动写日记",exact:true}).click();
    await page.getByLabel("日记日期").waitFor();
  } finally {await browser.close(); await server.close();}
},30000);

it.skipIf(!existsSync(executable))("reloads a conflicting diary schedule only on request without writing over it", async () => {
  const server = await createServer({configFile:resolve("apps/desktop/vite.config.ts"),server:{host:"127.0.0.1",port:0,fs:{allow:[resolve(".")]}}});
  await server.listen();
  const browser = await chromium.launch({executablePath:executable,headless:true});
  try {
    const page = await browser.newPage({reducedMotion:"reduce"});
    await installFixtureIPC(page);
    const options = {enabled:true,hour:22,timezone:"Asia/Shanghai",revision:"old",last:null};
    const attempts:string[] = [];
    await page.route("**/ipc/v1/**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (!path.endsWith("/diary-options")) return route.fulfill({json:path.endsWith("/life/updates") ? {revision:"one"} : []});
      if (route.request().method()==="PUT") {
        const body = route.request().postDataJSON();
        attempts.push(body.revision);
        if(body.revision!==options.revision) return route.fulfill({status:409,json:{error:"DIARY_SETTINGS_CHANGED"}});
        Object.assign(options,body,{revision:"saved"});
      }
      return route.fulfill({json:options});
    });
    await page.goto(server.resolvedUrls!.local[0]+"@fs/"+resolve("tests/fixtures/desktop/desktop-clarity.html")+"?life");
    await page.getByRole("button",{name:"日记设置",exact:true}).click();
    const dialog = page.getByRole("dialog",{name:"日记设置"});
    const zone = dialog.getByRole("textbox",{name:"时区"}), save = dialog.getByRole("button",{name:"保存",exact:true});
    await zone.fill("Europe/Paris");
    Object.assign(options,{hour:20,timezone:"Australia/Brisbane",revision:"other"});
    await save.click();
    await dialog.getByRole("alert").getByText(/未保存/).waitFor();
    expect(await save.count()).toBe(0);
    expect(await zone.inputValue()).toBe("Europe/Paris");
    expect(options.timezone).toBe("Australia/Brisbane");
    await dialog.getByRole("button",{name:"重新载入",exact:true}).click();
    await save.waitFor();
    expect(await zone.inputValue()).toBe("Australia/Brisbane");
    expect(await save.isDisabled()).toBe(true);
    expect(attempts).toEqual(["old"]);
    await zone.fill("Europe/Paris"); await save.click(); await dialog.waitFor({state:"hidden"});
    expect(attempts).toEqual(["old","other"]);
    expect(options.timezone).toBe("Europe/Paris");
  } finally {await browser.close(); await server.close();}
},15000);
