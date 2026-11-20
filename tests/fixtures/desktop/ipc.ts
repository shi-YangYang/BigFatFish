// Only Playwright installs this bridge. Requests are intercepted by the test,
// never forwarded to a real desktop Runtime or an account.
import type { Page } from 'playwright-core';

export async function installFixtureIPC(page: Page, snapshot?: (id: string) => unknown[]) {
  if (snapshot) await page.exposeFunction('fixtureChatSnapshot', snapshot);
  await page.addInitScript(() => {
    const w = window as unknown as {__TAURI_INTERNALS__: unknown; fixtureChatSnapshot?: (id: string) => Promise<unknown[]>};
    let channelId = 0;
    w.__TAURI_INTERNALS__ = {
      transformCallback: () => ++channelId, unregisterCallback: () => {},
      invoke: async (cmd: string, args: {route?: string; method?: string; body?: unknown; conversationId: string; channel?: {onmessage: (event: unknown) => void}}) => {
        if (cmd === 'desktop_settings') return {complete:true, dataDir:'test', background:false, autostart:false};
        if (cmd === 'runtime_status') return {state:'running'};
        if (cmd === 'runtime_stream_stop') return;
        if (cmd === 'runtime_stream_start') {
          const events = await w.fixtureChatSnapshot?.(args.conversationId) ?? [];
          for (const event of events) args.channel?.onmessage(event);
          return;
        }
        if (cmd !== 'runtime_request' || !args.route?.startsWith('/v1/')) throw new Error('Unexpected fixture command: '+cmd);
        const response = await fetch('/ipc' + args.route, {
          method:args.method ?? 'GET', headers:{'content-type':'application/json'},
          body:args.body === undefined ? undefined : JSON.stringify(args.body),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'UNAVAILABLE');
        return data;
      },
    };
  });
}
