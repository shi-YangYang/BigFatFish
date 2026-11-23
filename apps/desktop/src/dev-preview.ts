// Vite dev server only. Preview the actual WebView UI with empty, read-only data.
import { mockIPC } from "@tauri-apps/api/mocks";

import { defaultPersona } from "../../runtime/src/ai/persona/presets";

export function installPreview() {
  document.title = "大肥鱼 · 界面预览";
  const values: Record<string, unknown> = {
    "/v1/status": { state: "running" }, "/v1/models": [], "/v1/model-routes": {}, "/v1/conversations/local": [],
    "/v1/persona": defaultPersona, "/v1/life/updates": { revision: "preview" },
    "/v1/life/timeline": [], "/v1/diaries": [], "/v1/memory-tasks": [], "/v1/conversations": [],
    "/v1/memory-recall": { state: "off" }, "/v1/diary-options": { enabled: false, hour: 23, timezone: "Asia/Shanghai", revision: "preview" },
    "/v1/plugins": [], "/v1/logs": { lines: [] },
    "/v1/life": { persona: { name: "大肥鱼" }, activity: [], interests: [], relationships: [], recent: [], diaries: [] },
    "/v1/activities": { paused: false, tasks: [], schedules: [] },
    "/v1/channels/qq": { config: null, health: { state: "stopped" } }, "/v1/channels/qq/component": { phase: "ready", supported: true },
    "/v1/channels/qq/component/contacts": { friends: [], groups: [] }, "/v1/bilibili/tasks": [],
    "/v1/bilibili": { enabled: false, accountState: "unverified", health: {}, connection: { phase: "idle" } },
    "/v1/douyin": { config: { enabled: false }, accountState: "unverified", browser: {state:"closed"}, connection: { phase: "idle" } },
  };
  mockIPC((command, args) => {
    if (command === "desktop_settings") return { complete: true, dataDir: "界面预览", autostart: false, background: false };
    if (command === "runtime_status") return values["/v1/status"];
    const request = args as { route?: string; method?: string } | undefined;
    if (command === "runtime_request" && request?.method === "GET" && typeof request.route === "string"
      && Object.hasOwn(values, request.route)) return values[request.route];
    if (command === "runtime_request" && request?.method === "POST" &&
      ["/v1/memories/search", "/v1/memory-scenes/search", "/v1/memory-profile/search"].includes(request.route ?? "")) return [];
    throw new Error("界面预览不连接本机服务，请在桌面应用中操作。");
  });
}
