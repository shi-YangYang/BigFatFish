import { it, expect } from 'vitest';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { defaultPersona } from '../../apps/runtime/src/ai/persona-presets';
const executable = process.env.BFF_TEST_BROWSER ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
it.skipIf(!existsSync(executable))('keeps existing persona details while simplifying editing and shows experiences without transport receipts', async () => {
  const server = await createServer({ configFile: resolve('apps/desktop/vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false, fs: { allow: [resolve('.')] } } });
  await server.listen();
  const browser = await chromium.launch({ executablePath: executable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 680 } });
    let persona = { ...defaultPersona, avatar: 'https://example.invalid/avatar.png', boundaries: '保留的行为边界', schedule: '保留的作息', autonomy: '保留的活动偏好' };
    const changes: unknown[] = [];
    await page.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/persona')) {
        if (route.request().method() === 'PUT') { persona = { ...route.request().postDataJSON(), version: persona.version + 1 }; changes.push(persona); }
        return route.fulfill({ json: persona });
      }
      const recent = [
        { id: 'received', kind: 'qq.received', summary: '收到 QQ 群聊消息' },
        { id: 'sent', kind: 'qq.sent', summary: 'QQ 消息发送已由协议服务确认' },
        { id: 'chat', kind: 'chat.completed', summary: '完成对话：一起去看海' },
      ].map(item => ({ ...item, sourceId: item.id, occurredAt: '2026-11-07T08:00:00Z' }));
      const json = path.endsWith('/life/updates') ? { revision: '1' } : path.endsWith('/life') ? {
        persona: { ...persona, avatar: '' }, recent, activity: [], diaries: [], interests: [], relationships: [], chattingCount: 0, confirmedCount: 0,
      } : { paused: false, tasks: [], schedules: [] };
      return route.fulfill({ json });
    });
    const url = `http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}/@fs/${resolve('tests/fixtures/desktop-clarity.html')}`;
    await page.goto(url);
    await page.getByLabel('名字', { exact: true }).fill('小肥鱼');
    expect(await page.getByText('编辑详细设定', { exact: true }).count()).toBe(0);
    expect(await page.getByLabel('头像地址', { exact: true }).count()).toBe(0);
    await page.getByRole('button', { name: '保存设定', exact: true }).click();
    await page.getByText('已保存', { exact: true }).waitFor();
    expect(changes[0]).toMatchObject({ name: '小肥鱼', avatar: 'https://example.invalid/avatar.png', boundaries: '保留的行为边界', schedule: '保留的作息', autonomy: '保留的活动偏好', cardPrompt: defaultPersona.cardPrompt });
    const customize = page.getByRole('button', { name: '自定义人设', exact: true });
    await customize.click();
    const prompt = page.getByLabel('完整人设', { exact: true });
    expect(await prompt.inputValue()).toBe(defaultPersona.cardPrompt);
    await prompt.fill('完整的自定义人设');
    await page.getByRole('button', { name: '关闭编辑', exact: true }).click();
    expect(await customize.evaluate(element => element === document.activeElement)).toBe(true);
    await customize.click();
    expect(await prompt.inputValue()).toBe('完整的自定义人设');
    await page.getByRole('button', { name: '保存人设', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    expect(changes[1]).toMatchObject({ cardPrompt: '完整的自定义人设', schedule: '保留的作息' });
    mkdirSync('build/desktop-clarity/browser', { recursive: true });
    for (const width of [900, 380]) {
      await page.setViewportSize({ width, height: 680 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `build/desktop-clarity/browser/persona-${width}.png` });
    }
    await page.goto(`${url}?home`);
    await page.getByText('聊了聊：一起去看海', { exact: true }).waitFor();
    expect(await page.getByText('QQ 消息发送已由协议服务确认', { exact: true }).count()).toBe(0);
    expect(await page.getByText('收到 QQ 群聊消息', { exact: true }).count()).toBe(0);
  } finally { await browser.close(); await server.close(); }
}, 30000);

it.skipIf(!existsSync(executable))('keeps optional settings out of the primary flow and retains backup and sharing contracts', async () => {
  const server = await createServer({ configFile: resolve('apps/desktop/vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false, fs: { allow: [resolve('.')] } } });
  await server.listen();
  const browser = await chromium.launch({ executablePath: executable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 680 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(4000);
    const calls: { command: string; args: Record<string, unknown> }[] = [];
    let routes = {};
    await page.exposeFunction('fixtureInvoke', (command: string, args: Record<string, unknown> = {}) => {
      calls.push({ command, args });
      if (command === 'desktop_settings') return { complete: true, dataDir: '/fixture/data', background: true, autostart: false };
      if (command === 'desktop_maintenance') return { scopes: ['persona', 'models', 'sessions', 'memories', 'life', 'plugins'], conversations: 4 };
      if (command === 'runtime_request') {
        const data: Record<string, unknown> = {
          '/v1/model-routes': routes,
          '/v1/plugins': [{ id: 'qq', manifest: { name: 'QQ', version: '1.0', source: 'bundled plugins/qq', license: 'MIT', permissions: ['channel.qq'], tools: [] }, installed: true, enabled: true, health: 'ready', config: {} }],
          '/v1/bilibili': { enabled: false, revision: 'fixture', accountState: 'unverified', health: {} },
          '/v1/bilibili/tasks': [{ id: 'v1', bvid: 'BVfixture', status: 'completed', result: { evidence: { title: '一段海边视频' }, summary: '海边日落' }, createdAt: '2026-11-07T08:00:00Z' }],
          '/v1/bilibili/tasks/v1/share': { status: 'sent' },
          '/v1/douyin': { revision: 'fixture', config: { enabled: false, accountId: '', executablePath: '', pythonPath: 'python3', headless: false }, accountState: 'unverified', browser: { state: 'stopped' } },
          '/v1/activities': { tasks: [], schedules: [] },
        };
        return data[String(args.route)] ?? {};
      }
      return {};
    });
    await page.addInitScript(() => { Object.assign(window, { __TAURI_INTERNALS__: { invoke: (command: string, args: unknown) => (window as unknown as { fixtureInvoke: (command: string, args: unknown) => unknown }).fixtureInvoke(command, args) } }); });
    const url = `http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}/@fs/${resolve('tests/fixtures/desktop-clarity.html')}`;
    await page.goto(`${url}?plugins`);
    await page.getByRole('heading', { name: 'QQ', exact: true }).waitFor();
    expect(await page.getByText('bundled plugins/qq', { exact: true }).count()).toBe(0);
    await page.getByRole('button', { name: '插件信息', exact: true }).click();
    await page.getByText('channel.qq', { exact: true }).waitFor();
    expect(await page.getByRole('button', { name: '高级配置', exact: true }).count()).toBe(0);
    await page.keyboard.press('Escape');
    await page.goto(`${url}?media`);
    await page.getByText('先配置语音输入模型。', { exact: true }).waitFor();
    expect(await page.getByRole('button', { name: '选择文件', exact: true }).count()).toBe(0);
    await page.getByRole('button', { name: '设置模型', exact: true }).first().click();
    await page.getByRole('heading', { name: '模型设置', exact: true }).waitFor();
    routes = { asr: 'speech', tts: 'voice' };
    await page.reload();
    await page.getByLabel('朗读内容', { exact: true }).waitFor();
    expect(await page.getByRole('article').count()).toBe(2);
    await page.goto(`${url}?setup`);
    await page.getByText('/fixture/data', { exact: true }).waitFor();
    expect(await page.getByLabel('数据目录', { exact: true }).count()).toBe(0);
    expect(await page.getByRole('checkbox').count()).toBe(2);
    await page.goto(`${url}?backup`);
    expect(await page.getByRole('checkbox', { name: '模型设置', exact: true }).count()).toBe(0);
    await page.getByLabel('保存到', { exact: true }).fill('/fixture/backup.bff');
    await page.getByRole('button', { name: '创建备份', exact: true }).click();
    await page.getByRole('status').waitFor();
    expect(calls.find(call => call.command === 'desktop_maintenance')?.args).toMatchObject({ action: 'export', input: { file: '/fixture/backup.bff', scopes: ['persona', 'models', 'sessions', 'memories', 'life', 'plugins'], credentials: false } });
    await page.getByRole('group', { name: '备份操作' }).getByRole('button', { name: '恢复数据', exact: true }).click();
    expect(await page.getByRole('button', { name: '选择备份内容', exact: true }).count()).toBe(0);
    expect(await page.getByRole('checkbox').count()).toBe(0);
    await page.goto(`${url}?bili`);
    await page.getByRole('button', { name: '分享到 QQ', exact: true }).waitFor();
    expect(await page.getByLabel('接收 QQ 或群号', { exact: true }).count()).toBe(0);
    await page.getByRole('button', { name: '分享到 QQ', exact: true }).click();
    await page.getByLabel('接收 QQ 或群号', { exact: true }).fill('10002');
    await page.getByRole('button', { name: '确认分享', exact: true }).click();
    await page.getByText('已分享到 QQ。', { exact: true }).waitFor();
    expect(calls.find(call => call.args.route === '/v1/bilibili/tasks/v1/share')?.args).toMatchObject({ method: 'POST', body: { target: { kind: 'private', id: '10002' } } });
    await page.goto(`${url}?douyin`);
    await page.getByRole('tab', { name: '互动', exact: true }).click();
    await page.getByText('连接抖音后可点赞或评论。', { exact: true }).waitFor();
    expect(await page.getByLabel('视频 ID', { exact: true }).count()).toBe(0);
    await page.getByRole('button', { name: '连接设置', exact: true }).click();
    await page.getByRole('dialog', { name: '连接设置', exact: true }).waitFor();
    await page.getByLabel('浏览器路径', { exact: true }).waitFor();
    for (const width of [900, 380]) {
      await page.setViewportSize({ width, height: 680 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `build/desktop-clarity/browser/connection-${width}.png` });
    }
  } finally { await browser.close(); await server.close(); }
}, 30000);
