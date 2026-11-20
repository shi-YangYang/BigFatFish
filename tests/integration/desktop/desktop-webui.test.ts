import { it, expect } from "vitest";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { chromium } from "playwright-core";
const executable =
  process.env.BFF_TEST_BROWSER ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
it.skipIf(!existsSync(executable))(
  "shared WebUI preserves drafts, request ownership, direct interactions and usable layouts",
  async () => {
    const root = resolve("apps/desktop/dist");
    const server = createServer((req, res) => {
      const file = resolve(
        root,
        "." + (req.url === "/" ? "/index.html" : (req.url ?? "")),
      );
      if (!file.startsWith(root + "/")) {
        res.writeHead(404).end();
        return;
      }
      try {
        res.setHeader(
          "content-type",
          (
            {
              ".js": "application/javascript",
              ".css": "text/css",
              ".png": "image/png",
              ".txt": "text/plain",
            } as Record<string, string>
          )[extname(file)] ?? "text/html",
        );
        res.end(readFileSync(file));
      } catch {
        res.writeHead(404).end();
      }
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const browser = await chromium.launch({
      executablePath: executable,
      headless: true,
    });
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    let setupComplete = true, online = true,
      unknown = false,
      hold = false,
      release = () => {};
    let onHold: (() => void) | undefined;
    const requests: { route: string; body: Record<string, unknown> }[] = [];
    const model = {
      id: "demo",
      label: "日常聊天",
      provider: "openai",
      baseURL: "https://example.invalid/v1",
      model: "demo",
      contextWindow: 32768,
      maxTokens: 4096,
      timeoutMs: 120000,
      vision: false,
      hasKey: false,
    };
    const sessions = [
      {
        id: "recent",
        title: "聊聊最近的生活",
        modelId: "demo",
        createdAt: "2026-11-03T08:00:00Z",
      },
      {
        id: "another-local",
        title: "另一个本地对话",
        modelId: "demo",
        createdAt: "2026-11-02T08:00:00Z",
      },
    ];
    const messages = [
      {
        id: "hello",
        role: "user",
        content: "今天想出去走走，换换心情。",
        status: "completed",
      },
      {
        id: "reply",
        role: "assistant",
        content:
          "那就去附近的公园吧。带一杯喜欢的茶，找一条安静的小路慢慢走。\n\n不必安排很多事，给自己一点空白也很好。",
        status: "completed",
      },
    ];
    const data: Record<string, unknown> = {
      "/v1/models": [model],
      "/v1/model-routes": { chat: "demo" },
      "/v1/status": { state: "running" },
      "/v1/activities": { paused: false, tasks: [], schedules: [] },
      "/v1/conversations/local": sessions,
      "/v1/conversations": sessions,
      "/v1/life/updates": { revision: "1" },
      "/v1/life": {
        persona: {
          name: "大肥鱼",
          role: "喜欢慢慢聊天，也喜欢新的发现。",
          avatar: "",
        },
        mood: null,
        activity: [],
        recent: [],
        diaries: [],
        interests: [],
        relationships: [],
        chattingCount: 0,
        confirmedCount: 0,
      },
      "/v1/persona": {
        name: "大肥鱼",
        avatar: "",
        role: "陪伴",
        traits: "好奇",
        style: "自然",
        likes: "",
        dislikes: "",
        boundaries: "",
        schedule: "",
        autonomy: "",
        version: 1,
      },
      "/v1/persona/history": [],
      "/v1/life/timeline": [],
      "/v1/diaries": [],
      "/v1/memory-tasks": [],
      "/v1/memories": [],
      "/v1/memories/search": [],
      "/v1/plugins": [],
      "/v1/logs": { lines: [] },
      "/v1/channels/qq": {
        config: null,
        revision: "1",
        health: { state: "stopped" },
      },
      "/v1/channels/qq/deliveries": [],
      "/v1/bilibili": {
        enabled: false,
        revision: "1",
        accountState: "unverified",
        health: { ffmpeg: false },
      },
      "/v1/bilibili/tasks": [],
      "/v1/douyin": {
        config: {
          enabled: false,
          executablePath: "",
          pythonPath: "",
          accountId: "",
          headless: false,
        },
        revision: "1",
        browser: { state: "closed" },
        accountState: "unverified",
      },
      "/v1/permissions/audit": [],
    };
    const context = await browser.newContext({
      viewport: { width: 1100, height: 760 },
    });
    await context.exposeBinding(
      "bffTestInvoke",
      async (
        _source,
        cmd: string,
        args: {
          route: string;
          method?: string;
          body?: Record<string, unknown>;
        } = { route: "" },
      ) => {
        if (cmd === "desktop_settings")
          return {
            complete: setupComplete,
            dataDir: "/isolated/fixture",
            background: true,
            autostart: false,
            version: "0.1.0",
          };
        if (cmd === "desktop_configure") { setupComplete = true; return {}; }
        if (!online) throw new Error("UNAVAILABLE");
        if (cmd === "runtime_status") return {};
        const route = args.route,
          method = args.method ?? "GET";
        if (method !== "GET") {
          requests.push({ route, body: args.body ?? {} });
          if (route === "/v1/memories/search") return data[route];
          if (route === "/v1/memory-scenes/search" || route === "/v1/memory-profile/search") return [];
          if (route === "/v1/model-routes") { data[route] = args.body; return args.body; }
          if (route.endsWith("/model") && method === "PUT") return { ...sessions.find(x => x.id === route.split("/")[3]), modelId: args.body?.modelId };
          if (route === "/v1/conversations") {
            const item = {
              id: "new-" + sessions.length,
              title: "新对话",
              modelId: "demo",
              createdAt: new Date().toISOString(),
            };
            sessions.unshift(item);
            return item;
          }
          if (route.endsWith("/messages")) {
            if (hold) {
              onHold?.();
              await new Promise<void>((r) => (release = r));
            }
            if (unknown) throw new Error("UNAVAILABLE");
            return {};
          }
          if (route === "/v1/models") {
            const list = data[route] as {id:string}[];
            data[route] = [...list.filter(x=>x.id !== args.body?.id), { ...args.body, hasKey:false }];
            return args.body;
          }
          return {};
        }
        if (route.endsWith("/messages"))
          return route.includes("/recent/") ? messages : [];
        if (route.endsWith("/tools")) return [];
        return structuredClone(data[route] ?? []);
      },
    );
    await context.addInitScript((initialMessages) => {
      type Stream = { conversationId: string; channel: { onmessage: (event: unknown) => void }; subscriptionId: string };
      const subscriptions = new Set<string>();
      const w = window as unknown as {
        bffTestInvoke: (cmd: string, args: unknown) => Promise<unknown>;
        __TAURI_INTERNALS__: unknown;
      };
      w.__TAURI_INTERNALS__ = {
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: (cmd: string, args: Stream) => {
          if (cmd === "runtime_stream_stop") {
            subscriptions.delete(args.subscriptionId);
            return Promise.resolve();
          }
          if (cmd === "runtime_stream_start") {
            const { conversationId, channel, subscriptionId } = args;
            subscriptions.add(subscriptionId);
            queueMicrotask(() => {
              if (!subscriptions.has(subscriptionId)) return;
              const snapshot = conversationId === "recent" ? initialMessages : [];
              for (const event of [
                { type: "snapshot-start" },
                ...snapshot.map(message => ({ type: "snapshot-message", message })),
                { type: "snapshot-end", tools: [] },
              ]) channel.onmessage({ ...event, conversationId });
            });
            return Promise.resolve();
          }
          return w.bffTestInvoke(cmd, args);
        },
      };
    }, messages);
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(4000);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(url);
      await page
        .getByText("今天想出去走走，换换心情。", { exact: true })
        .waitFor();
      mkdirSync("build/beui-interface", { recursive: true });
      for (const width of [1100, 820, 640]) {
        await page.setViewportSize({ width, height: 760 });
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              ),
            ),
        );
        expect(await page.locator(".topbar:visible").count()).toBe(1);
        const headerButtons = await page.locator(".topbar:visible button:visible").evaluateAll((buttons) => buttons.map((button) => ({
          height: button.getBoundingClientRect().height,
          radius: getComputedStyle(button).borderRadius,
          library: button.getAttribute("data-beui"),
        })));
        expect(headerButtons.length).toBeGreaterThan(0);
        expect(headerButtons.every((button) => Math.abs(button.height - 40) < 0.01 && button.radius === "8px" && button.library === "button")).toBe(true);

        if (width > 700) expect((await page.locator(".app-sidebar").boundingBox())!.width).toBeLessThanOrEqual(80);
        const box = await page
          .getByRole("button", { name: "发送", exact: true })
          .boundingBox();
        expect(box!.y + box!.height).toBeLessThanOrEqual(760);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `build/beui-interface/regression-chat-${width}.png`,
        });
      }
      expect(await page.locator(".topbar:visible").count()).toBe(1);
      expect(await page.locator(".session-list:visible").count()).toBe(0);
      const historyButton = page.getByRole("button", { name: "历史对话", exact: true });
      await historyButton.click();
      await page.getByRole("dialog", { name: "历史对话", exact: true }).waitFor();
      await page.keyboard.press("Escape");
      expect(await historyButton.evaluate((el) => el === document.activeElement)).toBe(true);
      await historyButton.click();
      await page.locator(".session-list button.active").click();
      expect(await page.getByRole("dialog").count()).toBe(0);
      // Narrow navigation closes via Escape and routes into the same shared content.
      await page.getByRole("button", { name: "打开导航" }).click();
      await page.getByRole("dialog", { name: "导航" }).waitFor();
      await page.keyboard.press("Escape");
      expect(await page.getByRole("dialog").count()).toBe(0);
      await page.setViewportSize({ width: 1100, height: 760 });
      const input = page.getByRole("textbox", { name: "消息", exact: true });
      await input.fill("第一行");
      await input.press("Enter");
      expect(await input.inputValue()).toBe("第一行\n");
      expect(requests.filter((r) => r.route.endsWith("/messages"))).toHaveLength(0);
      await input.dispatchEvent("keydown", { key: "Enter", code: "Enter", isComposing: true });
      expect(requests.filter((r) => r.route.endsWith("/messages"))).toHaveLength(0);
      await input.fill("保留的草稿");
      await page.getByRole("button", { name: "设置", exact: true }).click();
      await page.getByRole("button", { name: "新建配置", exact: true }).click();
      await page.getByRole("combobox", {name:"服务商",exact:true}).click(); await page.getByRole("option", {name:"自定义 / OpenAI 兼容",exact:true}).click();
      await page.getByLabel("服务地址", { exact: true }).waitFor();
      expect(
        await page
          .getByLabel("服务地址", { exact: true })
          .evaluate((el) => (el.closest(".ui-input") ?? el).getBoundingClientRect().height),
      ).toBeCloseTo(40, 2);
      await page.screenshot({ path: "build/beui-interface/regression-settings-1100.png" });
      await page.getByRole("dialog").getByRole("button", { name: "关闭", exact: true }).click();
      // General settings must not mix fields, toggles and a stretched action in a two-column grid.
      await page.getByRole("tab", { name: "通用", exact: true }).click();
      await page.getByText("/isolated/fixture", { exact: true }).waitFor();
      const preferences = await Promise.all([
        page.getByLabel("关闭窗口后继续在后台运行", { exact: true }).boundingBox(),
        page.getByLabel("登录电脑时启动", { exact: true }).boundingBox(),
        page.getByRole("button", { name: "保存设置", exact: true }).boundingBox(),
      ]);
      const form = await page.locator(".setup-form").boundingBox();
      expect(preferences.every(b => b && Math.abs(b.x - preferences[0]!.x) <= 1)).toBe(true);
      expect(preferences[2]!.height).toBeCloseTo(40, 2);
      expect(preferences[2]!.width).toBeLessThan(form!.width / 2);
      await page.getByRole("tab", { name: "数据与维护", exact: true }).click();
      const exportAction = await page.getByRole("button", { name: "创建备份", exact: true }).boundingBox();
      await page.getByRole("group", { name: "备份操作" }).getByRole("button", { name: "恢复数据", exact: true }).click();
      const restoreActions = await Promise.all(
        ["检查备份", "恢复数据"].map(name => page.locator(".ui-section-card").getByRole("button", { name, exact: true }).boundingBox()),
      );
      expect([exportAction, ...restoreActions].every(b => b && Math.abs(b.height - 40) < 0.01)).toBe(true);
      expect(restoreActions[0]!.y).toBe(restoreActions[1]!.y);
      await page.getByRole("button", { name: "我的鱼", exact: true }).click();
      await page.getByRole("tab", { name: "记忆", exact: true }).click();
      await page
        .getByText("还没有记忆", {
          exact: true,
        })
        .waitFor();
      await page.getByRole("button", { name: "浏览全部记忆", exact: true }).click();
      await page.getByRole("button", { name: "筛选", exact: true }).click();
      const filters = await page.locator(".memory-query-panel input:visible, .memory-query-panel button[role=combobox]:visible")
        .evaluateAll(elements => elements.map(el => {
          const box = (el.closest(".ui-input") ?? el).getBoundingClientRect();
          return { bottom: box.bottom, height: box.height };
        }));
      expect(filters).toHaveLength(4);
      expect(filters.every(r => Math.abs(r.height - 40) < 0.01)).toBe(true);
      expect(filters[0]!.bottom).toBe(filters[1]!.bottom);
      expect(filters[2]!.bottom).toBe(filters[3]!.bottom);
      await page.getByRole("button", { name: "聊天", exact: true }).click();
      expect(await input.inputValue()).toBe("保留的草稿");
      online = false;
      await page
        .getByText("连接已断开，当前内容与草稿已保留。", { exact: false })
        .waitFor({ timeout: 7000 });
      expect(await input.inputValue()).toBe("保留的草稿");
      expect(
        await page
          .getByRole("button", { name: "发送", exact: true })
          .isDisabled(),
      ).toBe(true);
      online = true;
      await page
        .getByRole("button", { name: "重新连接", exact: true })
        .last()
        .click();
      await page.getByRole("button", { name: "发送", exact: true }).waitFor();
      // A response to an earlier draft must not erase edits made during submission.
      hold = true;
      await page.getByRole("button", { name: "发送", exact: true }).click();
      await input.fill("发送期间的新草稿");
      await new Promise((r) => setTimeout(r, 100));
      release();
      hold = false;
      await page.getByRole("button", { name: "发送", exact: true }).waitFor();
      expect(await input.inputValue()).toBe("发送期间的新草稿");
      async function selectHistory(name: RegExp) {
        await page.getByRole("button", { name: "历史对话", exact: true }).click();
        await page.getByRole("dialog", { name: "历史对话", exact: true })
          .getByRole("button", { name }).click();
      }
      // Unknown transport result retains the idempotency key when returning to the session.
      unknown = true;
      await input.fill("需要核对的消息");
      await page.getByRole("button", { name: "发送", exact: true }).click();
      await page.getByText(/若发送结果未知/).waitFor();
      const first = requests.at(-1)!.body.requestId;
      await selectHistory(/另一个本地对话/);
      await selectHistory(/聊聊最近的生活/);
      expect(await input.inputValue()).toBe("需要核对的消息");
      unknown = false;
      await page.getByRole("button", { name: "发送", exact: true }).click();
      await new Promise((r) => setTimeout(r, 100));
      expect(requests.at(-1)!.body.requestId).toBe(first);
      await page.getByRole("button", { name: "新对话", exact: true }).click();
      await input.fill("第一句话");
      // Restoring an unsaved conversation must not keep its draft after it is sent.
      await selectHistory(/聊聊最近的生活/);
      await page.getByRole("button", { name: "新对话", exact: true }).click();
      expect(await input.inputValue()).toBe("第一句话");
      const before = requests.length;
      await page.getByRole("button", { name: "发送", exact: true }).click();
      await new Promise((r) => setTimeout(r, 100));
      expect(requests.slice(before).map((r) => r.route)).toEqual([
        "/v1/conversations",
        `/v1/conversations/${sessions[0].id}/messages`,
      ]);
      expect(await input.inputValue()).toBe("");
      await page.getByRole("button", { name: "新对话", exact: true }).click();
      expect(await input.inputValue()).toBe("");
      // Migration retains edits made during the first send in the new session.
      hold = true;
      const sendingHeld = new Promise<void>((resolve) => (onHold = resolve));
      await input.fill("新会话的第一条消息");
      await page.getByRole("button", { name: "发送", exact: true }).click();
      await sendingHeld;
      await input.fill("新会话发送期间继续写");
      release();
      hold = false;
      onHold = undefined;
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLButtonElement>(
            '.composer button[type="submit"]',
          )?.disabled === false,
      );
      expect(await input.inputValue()).toBe("新会话发送期间继续写");
      await page.getByRole("button", { name: "新对话", exact: true }).click();
      expect(await input.inputValue()).toBe("");
      await page.getByRole("button", { name: "历史对话", exact: true }).click();
      await page.locator(".session-list button").first().click();
      expect(await page.getByRole("dialog", { name: "历史对话" }).count()).toBe(0);
      expect(await input.inputValue()).toBe("新会话发送期间继续写");
      expect(await page.getByRole("button", { name: /待审批/ }).count()).toBe(0);
      expect(await page.getByRole("button", { name: "运行状态", exact: true }).count()).toBe(0);
      expect(await page.getByRole("button", { name: "审批与记录", exact: true }).count()).toBe(0);
      await page.setViewportSize({ width: 1100, height: 760 });
      await page.getByRole("button", { name: "连接", exact: true }).click();
      await page.screenshot({
        path: "build/beui-interface/regression-connections-1100.png",
      });
      expect(await page.getByRole("button", { name: "管理连接" }).count()).toBe(
        3,
      );
      await page.getByRole("button", { name: "我的鱼", exact: true }).click();
      await page.getByRole("tab", { name: "设定", exact: true }).click();

      await page.getByLabel("名字", { exact: true }).waitFor();
      await page.getByRole("tab", { name: "活动计划", exact: true }).click();
      await page
        .getByRole("button", { name: "暂停全部活动", exact: true })
        .waitFor();
      expect(errors).toEqual([]);
      // A missing historical model must not strand a local draft or force a new conversation.
      data["/v1/models"] = [model, {...model,id:"voice-only",label:"仅朗读"}];
      data["/v1/model-routes"] = {chat:model.id,tts:"voice-only"};
      data["/v1/conversations/local"] = [{...sessions.find(x => x.id === "recent"), modelId:"unavailable"}];
      await page.reload();
      await page.getByText("今天想出去走走，换换心情。", { exact:true }).waitFor();
      await input.fill("等换好模型再聊");
      await page.getByLabel("可用聊天模型").click();
      expect(await page.getByRole("option", {name:"仅朗读",exact:true}).count()).toBe(0);
      await page.getByRole("option", {name:model.label,exact:true}).click();
      await page.getByRole("button", {name:"使用这个模型"}).click();
      await page.getByText("这段对话的模型不可用。", {exact:false}).waitFor({state:"hidden"});
      expect(requests.find(r => r.route === "/v1/conversations/recent/model")?.body.modelId).toBe("demo");
      expect(await input.inputValue()).toBe("等换好模型再聊");
      await page.getByText("今天想出去走走，换换心情。", {exact:true}).waitFor();

      // Direct editor uses the source task's model purpose; no automatic provider request.
      const writesBefore = requests.length;
      data["/v1/models"] = []; data["/v1/model-routes"]={};
      data["/v1/conversations/local"] = []; data["/v1/conversations"] = [];
      await page.reload();
      await page.getByRole("button", { name: "添加聊天模型", exact: true }).click();
      await page.getByRole("dialog", {name:"设置聊天模型"}).waitFor();
      await page.getByRole("combobox", {name:"服务商",exact:true}).click(); await page.getByRole("option", {name:"自定义 / OpenAI 兼容",exact:true}).click();
      await page.getByLabel("服务地址", {exact:true}).fill("https://unused.invalid/v1"); await page.getByLabel("模型名称", {exact:true}).fill("my-chat");
      await page.getByRole("button",{name:"保存并回到聊天"}).click();
      await page.getByRole("dialog").waitFor({state:"hidden"});
      expect(await input.isEnabled()).toBe(true);
      await page.getByRole("button",{name:"设置",exact:true}).click();
      await page.getByRole("button",{name:"语音输入与朗读",exact:true}).click();
      for (const [title,purpose] of [["语音输入","asr"],["朗读","tts"]]) {
        await page.getByRole("button",{name:"设置"+title+"模型",exact:true}).click();
        await page.getByRole("dialog",{name:"设置"+title+"模型"}).waitFor();
        await page.getByLabel("服务地址",{exact:true}).fill("https://unused.invalid/v1");await page.getByLabel("模型名称",{exact:true}).fill("my-"+purpose);
        await page.getByRole("button",{name:"保存模型",exact:true}).click();
        await page.getByRole("dialog").waitFor({state:"hidden"});
        expect((data["/v1/model-routes"] as Record<string,string>)[purpose]).toBeTruthy();
      }
      // First run uses the system data directory and persona without presenting background controls.
      setupComplete = false; data["/v1/models"] = []; data["/v1/model-routes"] = {};
      await page.reload();
      await page.getByRole("heading",{name:"欢迎养一条自己的鱼"}).waitFor();
      expect(await page.getByRole("textbox", {name:"鱼的名字"}).count()).toBe(0);
      expect(await page.getByRole("button", {name:"自定义名字和数据目录"}).getAttribute("aria-expanded")).toBe("false");
      expect(await page.getByLabel("登录电脑时启动").count()).toBe(0);
      await page.getByRole("button",{name:"开始设置模型"}).click();
      await page.getByRole("dialog",{name:"设置聊天模型"}).waitFor();
      await page.getByRole("combobox",{name:"服务商",exact:true}).click();
      await page.getByRole("option",{name:"阿里云百炼（按量，北京）",exact:true}).click();
      expect(await page.getByRole("textbox",{name:"服务地址",exact:true}).count()).toBe(0);
      expect(await page.getByRole("combobox",{name:"聊天模型",exact:true}).innerText()).toBe("qwen3.7-plus");
      await page.getByLabel("API Key",{exact:true}).fill("sk-sp-fixture-only");
      expect(await page.getByRole("button",{name:"保存并回到聊天"}).isDisabled()).toBe(true);
      await page.getByLabel("API Key",{exact:true}).fill("fixture-payg-key");
      await page.getByRole("button",{name:"保存并回到聊天"}).click();
      await page.getByRole("dialog").waitFor({state:"hidden"});
      await page.getByRole("heading",{name:"今天想聊些什么？"}).waitFor();
      expect(requests.filter(r=>r.route==="/v1/models").at(-1)?.body).toMatchObject({provider:"openai",model:"qwen3.7-plus",baseURL:"https://dashscope.aliyuncs.com/compatible-mode/v1",apiKey:"fixture-payg-key"});
      await input.fill("第一条草稿");
      expect(await page.getByRole("button",{name:"发送",exact:true}).isEnabled()).toBe(true);
      expect(requests.slice(writesBefore).some(r=>r.route.endsWith("/test")||r.route.endsWith("/discover"))).toBe(false);
    } finally {
      await browser.close();
      await new Promise<void>((r) => server.close(() => r()));
    }
  },
  40000,
);
