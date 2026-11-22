import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright-core";
import { createServer, preview } from "vite";
import { expect, it } from "vitest";

const executable = process.env.BFF_TEST_BROWSER ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

it.skipIf(!existsSync(executable))("previews the WebView offline in development; the production bundle needs the desktop host", async () => {
  const configFile = resolve("apps/desktop/vite.config.ts");
  const loopback = {host:"127.0.0.1",port:0,strictPort:false};
  const dev = await createServer({configFile, server:{...loopback, hmr:false}});
  await dev.listen();
  const bundle = await preview({configFile, preview:loopback});
  const browser = await chromium.launch({executablePath:executable,headless:true});
  try {
    const page = await browser.newPage();
    const network:string[]=[];
    page.on("request", req => {if (["xhr","fetch"].includes(req.resourceType())) network.push(req.url());});
    page.on("websocket", ws => network.push(ws.url()));
    await page.goto(dev.resolvedUrls!.local[0]!);
    await page.getByRole("heading",{name:"新对话",exact:true}).waitFor();
    expect(await page.getByRole("button",{name:"新对话",exact:true}).count()).toBe(0);
    await page.getByRole("button",{name:"我的鱼",exact:true}).click();
    await page.getByText("今天还没有记下心情",{exact:true}).waitFor();
    await page.getByRole("tab",{name:"设定",exact:true}).click();
    await page.getByRole("heading",{name:"鱼的设定",exact:true}).waitFor();
    await page.getByRole("button",{name:"连接",exact:true}).click();
    await page.locator(".connection-list [role=article]").filter({has:page.getByRole("heading",{name:"B站",exact:true})}).getByRole("button",{name:"打开 B站 连接",exact:true}).click();
    await page.getByRole("button",{name:"连接 B站",exact:true}).waitFor();
    expect(await page.getByRole("alert").count()).toBe(0);
    await page.getByRole("button",{name:"设置",exact:true}).click();
    await page.getByRole("tab",{name:"通用",exact:true}).click();
    await page.getByRole("button",{name:"保存设置",exact:true}).click();
    await page.getByRole("alert").getByText(/请在桌面应用中操作/).waitFor();
    await page.goto(bundle.resolvedUrls!.local[0]!);
    await page.getByText("请在大肥鱼桌面应用中打开。",{exact:true}).waitFor();
    expect(await page.getByRole("button").count()).toBe(0);
    expect(await page.evaluate(()=>"__TAURI_INTERNALS__" in window)).toBe(false);
    // Vite may still open its own local hot-reload socket; this is not an app transport.
    const devHost = new URL(dev.resolvedUrls!.local[0]!).host;
    const appTraffic = network.filter(raw => {
      const url = new URL(raw);
      return !(url.protocol === "ws:" && url.host === devHost && url.pathname === "/" && url.searchParams.has("token"));
    });
    expect(appTraffic).toEqual([]);
  } finally {
    await browser.close(); await dev.close();
    await new Promise<void>((resolve,reject)=>bundle.httpServer.close(err=>err?reject(err):resolve()));
  }
});
