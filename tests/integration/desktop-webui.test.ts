import { it, expect } from "vitest";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { chromium } from "playwright-core";
const executable =
  process.env.BFF_TEST_BROWSER ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
it.skipIf(!existsSync(executable))(
  "shared WebUI preserves drafts, request ownership, approval context and usable layouts",
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
    let online = true,
      unknown = false,
      hold = false,
      approvalError = "",
      release = () => {};
    let onHold: (() => void) | undefined;
    const requests: { route: string; body: Record<string,unknown> }[] = [];
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
        id: "qq",
        title: "QQ 里的对话",
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
    let pending = true;
    const data: Record<string, unknown> = {
      "/v1/models": [model],
      "/v1/model-routes": { chat: "demo" },
      "/v1/status": { state: "running" },
      "/v1/activities": { paused: false, tasks: [], schedules: [] },
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
      "/v1/douyin/approvals": [],
      "/v1/permissions/audit": [],
    };
    const context = await browser.newContext({
      viewport: { width: 1100, height: 760 },
    });
    await context.exposeBinding(
      "bffTestInvoke",
      async (_source, cmd: string, args: {route:string;method?:string;body?:Record<string,unknown>} = {route:""}) => {
        if (cmd === "desktop_settings")
          return {
            complete: true,
            dataDir: "/isolated/fixture",
            background: true,
            autostart: false,
            version: "0.1.0",
          };
        if (!online) throw new Error("UNAVAILABLE");
        if (cmd === "runtime_status") return {};
        const route = args.route,
          method = args.method ?? "GET";
        if (method !== "GET") {
          requests.push({ route, body: args.body??{} });
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
          if (route === "/v1/permissions/approvals/approval") {
            if (approvalError) throw new Error(approvalError);
            pending = false;
            return {};
          }
          if (route === "/v1/douyin/approvals/douyin-approval/decide")
            throw new Error("ACTION_UNKNOWN");
          if (route === "/v1/conversations/qq/messages")
            throw new Error("EXTERNAL_CONVERSATION_READ_ONLY");
          if (route.endsWith("/messages")) {
            if (hold) {
              onHold?.();
              await new Promise<void>((r) => (release = r));
            }
            if (unknown) throw new Error("UNAVAILABLE");
            return {};
          }
          if (route === "/v1/models") {
            data[route] = [{ ...args.body, hasKey: false }];
            return args.body;
          }
          return {};
        }
        if (route === "/v1/permissions/approvals")
          return pending
            ? [
                {
                  id: "approval",
                  payload: {
                    target: { kind: "private", id: "123456" },
                    segments: [
                      { type: "text", data: { text: "一起看这段视频吧" } },
                    ],
                  },
                  status: "pending",
                  digest: "fixture-digest",
                  expiresAt: Date.now() + 300000,
                },
              ]
            : [];
        if (route.endsWith("/messages"))
          return route.includes("/recent/") ? messages : [];
        if (route.endsWith("/tools")) return [];
        return structuredClone(data[route] ?? []);
      },
    );
    await context.addInitScript(() => {
      const w = window as unknown as {bffTestInvoke:(cmd:string,args:unknown)=>Promise<unknown>;__TAURI_INTERNALS__:unknown};
      w.__TAURI_INTERNALS__ = {
        invoke: (cmd: string, args: unknown) => w.bffTestInvoke(cmd, args),
      };
    });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(4000);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(url);
      await page
        .getByText("今天想出去走走，换换心情。", { exact: true })
        .waitFor();
      mkdirSync("build/desktop-webui", { recursive: true });
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
          path: `build/desktop-webui/chat-${width}.png`,
        });
      }
      // Narrow navigation closes via Escape and routes into the same shared content.
      await page.getByRole("button", { name: "打开导航" }).click();
      await page.getByRole("dialog", { name: "导航" }).waitFor();
      await page.keyboard.press("Escape");
      expect(await page.getByRole("dialog").count()).toBe(0);
      await page.setViewportSize({ width: 1100, height: 760 });
      const input = page.getByRole("textbox", { name: "消息", exact: true });
      await input.fill("保留的草稿");
      await page.getByRole("button", { name: "设置", exact: true }).click();
      await page.getByLabel("服务地址", { exact: true }).waitFor();
      expect(
        await page
          .getByLabel("服务地址", { exact: true })
          .evaluate((el) => el.getBoundingClientRect().height),
      ).toBe(40);
      await page.screenshot({ path: "build/desktop-webui/settings-1100.png" });
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
      // Unknown transport result retains the idempotency key when returning to the session.
      unknown = true;
      await input.fill("需要核对的消息");
      await page.getByRole("button", { name: "发送", exact: true }).click();
      await page.getByText(/若发送结果未知/).waitFor();
      const first = requests.at(-1)!.body.requestId;
      await page.getByRole("button", { name: /QQ 里的对话/ }).click();
      await page.getByRole("button", { name: /聊聊最近的生活/ }).click();
      expect(await input.inputValue()).toBe("需要核对的消息");
      unknown = false;
      await page.getByRole("button", { name: "发送", exact: true }).click();
      await new Promise((r) => setTimeout(r, 100));
      expect(requests.at(-1)!.body.requestId).toBe(first);
      await page.getByRole("button", { name: /QQ 里的对话/ }).click();
      await input.fill("从本机发送");
      await page.getByRole("button", { name: "发送", exact: true }).click();
      await page.getByText("此会话仅供查看，请从 QQ 继续。").waitFor();
      expect(await input.isDisabled()).toBe(true);
      await page.getByRole("button", { name: "新对话", exact: true }).click();
      await input.fill("第一句话");
      // Restoring an unsaved conversation must not keep its draft after it is sent.
      await page.getByRole("button", { name: /聊聊最近的生活/ }).click();
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
      await page.waitForFunction(() => document.querySelector<HTMLButtonElement>('.composer button[type="submit"]')?.disabled === false);
      expect(await input.inputValue()).toBe("新会话发送期间继续写");
      await page.getByRole("button", { name: "新对话", exact: true }).click();
      expect(await input.inputValue()).toBe("");
      await page.locator(".session-list button").first().click();
      expect(await input.inputValue()).toBe("新会话发送期间继续写");
      data["/v1/douyin/approvals"] = [{
        id: "douyin-approval",
        payload: { tool: "douyin_comment", accountId: "fixture-account", args: { aweme_id: "12345", text: "一条待审批评论" } },
        status: "pending",
        digest: "douyin-digest",
        expiresAt: Date.now() + 300000,
      }];
      await page.getByRole("button", { name: /待审批/ }).click();
      await page.getByText("一起看这段视频吧", { exact: true }).waitFor();
      await page.screenshot({ path: "build/desktop-webui/approval-1100.png" });
      const dialog = page.getByRole("dialog", { name: "审批与记录" });
      approvalError = "CHANNEL_OFFLINE";
      await dialog.getByRole("button", { name: "批准发送", exact: true }).click();
      await dialog.getByRole("alert").getByText("QQ 尚未在线，请检查连接和登录状态。", { exact: true }).waitFor();
      expect(await dialog.isVisible()).toBe(true);
      await dialog.getByRole("button", { name: "关闭提示", exact: true }).click();
      approvalError = "";
      await page.getByRole("button", { name: "批准发送", exact: true }).click();
      expect(requests.at(-1)!.body).toEqual({
        digest: "fixture-digest",
        decision: "approve",
      });
      await dialog.getByRole("button", { name: "批准这次操作", exact: true }).click();
      await dialog.getByRole("alert").getByText("操作结果未知，请先在平台核对，勿直接重试。", { exact: true }).waitFor();
      await page.setViewportSize({ width: 640, height: 760 });
      const alertBox = await dialog.getByRole("alert").boundingBox();
      expect(alertBox!.x).toBeGreaterThanOrEqual(0);
      expect(alertBox!.x + alertBox!.width).toBeLessThanOrEqual(640);
      expect(alertBox!.y + alertBox!.height).toBeLessThanOrEqual(760);
      await page.screenshot({ path: "build/desktop-webui/approval-error-640.png" });
      await page.keyboard.press("Escape");
      await page.setViewportSize({ width: 1100, height: 760 });
      await page.getByRole("button", { name: "连接", exact: true }).click();
      await page.screenshot({
        path: "build/desktop-webui/connections-1100.png",
      });
      expect(await page.getByRole("button", { name: "管理连接" }).count()).toBe(
        3,
      );
      await page.getByRole("button", { name: "我的鱼", exact: true }).click();
      await page.getByRole("button", { name: "设定", exact: true }).click();

      await page.getByLabel("名字", { exact: true }).waitFor();
      await page.getByRole("button", { name: "活动计划", exact: true }).click();
      await page
        .getByRole("button", { name: "暂停全部活动", exact: true })
        .waitFor();
      expect(errors).toEqual([]);
      // A clean launch without a model leads directly to configuration.
      data["/v1/models"] = [];
      data["/v1/conversations"] = [];
      await page.reload();
      await page
        .getByRole("button", { name: "添加聊天模型", exact: true })
        .click();
      await page.getByLabel("服务地址", { exact: true }).waitFor();
    } finally {
      await browser.close();
      await new Promise<void>((r) => server.close(() => r()));
    }
  },
  40000,
);
