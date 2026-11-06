import { expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import type { ActivityOverview } from '../../apps/desktop/src/api/activities';
const executable = process.env.BFF_TEST_BROWSER ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
it.skipIf(!existsSync(executable))('keeps checkbox, menus and activity controls available without animation frames or schedules', async () => {
  const server = await createServer({ configFile: resolve('apps/desktop/vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false, fs: { allow: [resolve('.')] } } });
  await server.listen();
  const browser = await chromium.launch({ executablePath: executable, headless: true });
  try {
    const page = await browser.newPage();
    const errors: string[] = [], writes: boolean[] = [];
    page.on('pageerror', error => errors.push(error.message));
    let activity: ActivityOverview = { paused: false, schedules: [], tasks: [] };
    await page.route('**/api/v1/**', async route => {
      if (route.request().method() === 'POST') {
        activity = { ...activity, paused: route.request().postDataJSON().paused };
        writes.push(activity.paused);
      }
      await route.fulfill({ json: activity });
    });
    const url = `http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}/@fs/${resolve('tests/fixtures/desktop-usability.html')}?states`;
    await page.goto(url);
    await page.getByText('还没有活动计划。', { exact: true }).waitFor();
    await page.getByRole('button', { name: '暂停全部活动', exact: true }).waitFor();
    const checkbox = page.getByRole('checkbox', { name: '动态选择', exact: true });
    const selectedColor = await page.getByRole('checkbox', { name: '已选样例', exact: true }).evaluate(element => getComputedStyle(element).backgroundColor);
    const unselectedColor = await checkbox.evaluate(element => getComputedStyle(element).backgroundColor);
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
    for (const selection of ['on', 'mixed', 'off', 'mixed', 'on'] as const) {
      await page.getByRole('button', { name: selection, exact: true }).dispatchEvent('click');
      const checked = selection === 'mixed' ? 'mixed' : String(selection === 'on');
      await page.waitForFunction(expected => document.querySelector('[role="checkbox"]')?.getAttribute('aria-checked') === expected, checked, { polling: 20 });
      const visible = await checkbox.evaluate(element => {
        const svg = element.querySelector('svg'), path = element.querySelector('path');
        return { state: element.getAttribute('data-state'), color: getComputedStyle(element).backgroundColor, opacity: svg && getComputedStyle(svg).opacity, path: path?.getAttribute('d'), dash: path && getComputedStyle(path).strokeDasharray };
      });
      expect(visible.color).toBe(selection === 'off' ? unselectedColor : selectedColor);
      expect(visible.state).toBe(selection === 'mixed' ? 'indeterminate' : selection === 'on' ? 'checked' : 'unchecked');
      if (selection === 'off') expect(await checkbox.locator('svg').count()).toBe(0);
      else expect(visible).toMatchObject({ opacity: '1', path: selection === 'mixed' ? 'M6 12h12' : 'M5 13l4 4L19 7', dash: 'none' });
    }
    await checkbox.focus();
    await page.keyboard.press('Space');
    expect(await checkbox.getAttribute('aria-checked')).toBe('false');
    expect(await page.getByRole('checkbox', { name: '已选样例', exact: true }).isDisabled()).toBe(true);

    const trigger = page.getByRole('button', { name: '菜单样例', exact: true });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('dialog', { name: '菜单样例', exact: true });
    await menu.waitFor();
    expect(await trigger.getAttribute('aria-expanded')).toBe('true');
    expect(await menu.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight &&
        element.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
    })).toBe(true);
    await menu.getByRole('button', { name: '操作样例', exact: true }).focus();
    await page.keyboard.press('Escape');
    expect(await trigger.getAttribute('aria-expanded')).toBe('false');
    expect(await trigger.evaluate(element => document.activeElement === element)).toBe(true);
    expect(await menu.count()).toBe(0);
    await trigger.dispatchEvent('click');
    await menu.waitFor();
    await page.locator('body').dispatchEvent('pointerdown');
    expect(await trigger.getAttribute('aria-expanded')).toBe('false');
    expect(await menu.count()).toBe(0);

    activity = { paused: true, schedules: [], tasks: [] };
    await page.reload();
    await page.getByRole('button', { name: '恢复活动', exact: true }).click();
    await page.getByRole('button', { name: '恢复活动', exact: true }).waitFor({ state: 'detached' });
    expect(writes).toEqual([false]);
    for (const status of ['queued', 'running', 'understanding']) {
      activity = { paused: false, schedules: [], tasks: [{ id: status, platform: 'bilibili', kind: 'watch', mode: 'Activity', input: {}, status, result: null, error: null, createdAt: '2026-11-05T08:00:00Z' }] };
      await page.reload();
      await page.getByRole('button', { name: '暂停全部活动', exact: true }).click();
      await page.getByRole('button', { name: '恢复活动', exact: true }).waitFor();
    }
    expect(writes).toEqual([false, true, true, true]);
    activity = { ...activity, paused: false, tasks: activity.tasks.map(task => ({ ...task, status: 'completed' })) };
    await page.reload();
    await page.getByText('还没有活动计划。', { exact: true }).waitFor();
    await page.getByRole('button', { name: '暂停全部活动', exact: true }).waitFor();
    expect(errors).toEqual([]);
  } finally { await browser.close(); await server.close(); }
}, 30000);

it.skipIf(!existsSync(executable))('shows tabs without animation frames and preserves local chat and memory editing flows', async () => {
  const server = await createServer({ configFile: resolve('apps/desktop/vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false, fs: { allow: [resolve('.')] } } });
  await server.listen();
  const browser = await chromium.launch({ executablePath: executable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 680 } });
    const errors: string[] = [], writes: { route: string; body: Record<string, unknown> }[] = [];
    page.on('pageerror', error => errors.push(error.message));
    let revision = 0;
    let recallState = 'off';
    const recallWrites: boolean[] = [];
    const memories: Record<string, unknown>[] = [];
    let legacyRuntime = true;
    const streams: (string | null)[] = [];
    const sessions = [
      { id: 'external', title: 'QQ群会话', modelId: 'fixture', readOnly: true, createdAt: '2026-11-05T08:00:00Z' },
      { id: 'local', title: 'QQ 群 12345', modelId: 'fixture', readOnly: false, createdAt: '2026-11-04T08:00:00Z' },
    ];
    await page.route('**/api/v1/**', async route => {
      const name = new URL(route.request().url()).pathname.replace('/api', '');
      const body = route.request().postDataJSON() ?? {};
      if (name === '/v1/memory-recall') {
        if (route.request().method() === 'PUT') {
          recallWrites.push(body.enabled);
          recallState = body.enabled ? 'downloading' : 'off';
        }
        return route.fulfill({ json: { state: recallState } });
      }
      if (name === '/v1/memories' && route.request().method() === 'POST') {
        writes.push({ route: name, body }); revision++;
        memories.push({ ...body, id: 'm1', role:'general',scopeKey:'',personKey:'',status: 'confirmed', version: 1, visibility: 'private', conflicts: [], sources: [] });
      }
      if (name === '/v1/memories/search' && body.role === 'other') {
        return route.fulfill({json:[{id:'m2',role:'other',personKey:'qq:10001:30003',scopeKey:'qq:10001:group:41001',
          subject:'朋友的偏好',content:'喜欢花茶',kind:'preference',importance:4,status:'confirmed',visibility:'private',version:1,conflicts:[],sources:[]}]});
      }
      if (name === '/v1/conversations/local') {
        if (legacyRuntime) return route.fulfill({ status: 404, json: { error: 'Not Found' } });
        return route.fulfill({ json: sessions.filter(session => !session.readOnly) });
      }
      const data: Record<string, unknown> = {
        '/v1/model-routes': { chat: 'fixture' }, '/v1/conversations': sessions,
        '/v1/memories/search': memories, '/v1/memory-tasks': [], '/v1/life/updates': { revision: String(revision) },
      };
      return route.fulfill({ json: data[name] ?? {} });
    });
    await page.routeWebSocket('**/events?**', socket => {
      const conversationId = new URL(socket.url()).searchParams.get('conversationId');
      streams.push(conversationId);
      socket.send(JSON.stringify({ type: 'snapshot-start', conversationId }));
      socket.send(JSON.stringify({ type: 'snapshot-message', conversationId, message: { id: 'message', conversationId, role: 'user', content: '你好', status: 'completed' } }));
      socket.send(JSON.stringify({ type: 'snapshot-end', conversationId }));
    });
    await page.goto(`http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}/@fs/${resolve('tests/fixtures/desktop-usability.html')}`);
    await page.getByRole('heading', { name: 'QQ 群 12345' }).waitFor();
    const input = page.getByRole('textbox', { name: '消息', exact: true });
    await input.fill('保留本地草稿');
    await page.getByRole('button', { name: '历史对话', exact: true }).click();
    expect(await page.getByRole('button', { name: /QQ群会话/ }).count()).toBe(0);
    await page.getByRole('button', { name: /QQ 群 12345/ }).click();
    await page.getByText('你好', { exact: true }).waitFor();
    expect(streams).toEqual(['local']);
    expect(await input.inputValue()).toBe('保留本地草稿');
    await page.getByRole('button', { name: '声音', exact: true }).click();
    await page.getByLabel('声音名称', { exact: true }).fill('fixture-voice');
    await page.keyboard.press('Escape');
    legacyRuntime = false;
    await page.getByRole('tab', { name: '记忆', exact: true }).click();
    await page.getByText('没有符合条件的记忆。可整理对话，或直接添加。', { exact: true }).waitFor();
    const recallCard = page.getByRole('article').filter({ hasText: '按语义回忆' });
    await recallCard.getByRole('button', { name: '启用' }).click();
    await recallCard.getByRole('button', { name: '取消' }).waitFor();
    recallState = 'failed';
    await recallCard.getByRole('button', { name: '重试' }).click();
    recallState = 'ready';
    await recallCard.getByRole('button', { name: '停用' }).click();
    await recallCard.getByRole('button', { name: '启用' }).waitFor();
    expect(recallWrites).toEqual([true, true, false]);
    expect(await page.getByLabel('主题', { exact: true }).count()).toBe(0);
    expect(await page.getByRole('button', { name: '合并所选两条', exact: true }).count()).toBe(0);
    expect(await page.getByRole('button', { name: '下一页', exact: true }).count()).toBe(0);
    await page.getByRole('button', { name: '添加记忆', exact: true }).click();
    await page.getByLabel('主题', { exact: true }).fill('偏好');
    await page.getByLabel('内容', { exact: true }).fill('喜欢蓝色');
    await page.getByRole('button', { name: '收起', exact: true }).click();
    await page.getByRole('button', { name: '添加记忆', exact: true }).click();
    expect(await page.getByLabel('内容', { exact: true }).inputValue()).toBe('喜欢蓝色');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await page.getByRole('heading', { name: '偏好', exact: true }).waitFor();
    expect(writes).toHaveLength(1);
    expect(writes[0]?.body).toMatchObject({ subject: '偏好', content: '喜欢蓝色', allowConflict: false });
    await page.getByRole('checkbox').first().click();
    await page.getByRole('button', { name: '导出所选 JSON', exact: true }).waitFor();
    await page.getByRole('button', { name: '编辑', exact: true }).click();
    expect(await page.getByLabel('内容', { exact: true }).inputValue()).toBe('喜欢蓝色');
    await page.getByRole('button', { name: '取消编辑', exact: true }).click();
    await page.getByRole('combobox', { name:'归属', exact:true }).click();
    await page.getByRole('option', { name:'其他人', exact:true }).click();
    const friend = page.getByRole('article').filter({ hasText:'朋友的偏好' });
    await friend.getByText('QQ 30003 · QQ 群 41001', {exact:true}).waitFor();
    expect(await friend.getByRole('button', {name:'确认',exact:true}).count()).toBe(0);
    expect(await friend.getByRole('button', {name:'共享给 QQ',exact:true}).count()).toBe(0);
    await page.getByRole('button', { name: '从对话整理', exact: true }).click();
    await page.getByRole('combobox', { name: '选择对话', exact: true }).waitFor();
    // Pausing frame callbacks reproduces the native-background WebView condition.
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
    await page.getByRole('tab', { name: '聊天', exact: true }).dispatchEvent('click');
    await page.getByRole('heading', { name: 'QQ 群 12345' }).waitFor();
    expect(await page.getByRole('tabpanel').evaluate(element => getComputedStyle(element).opacity)).toBe('1');
    await page.getByRole('tab', { name: '记忆', exact: true }).dispatchEvent('click');
    expect(await page.getByRole('tabpanel').evaluate(element => getComputedStyle(element).opacity)).toBe('1');
    sessions.splice(1); // The only remaining conversation belongs to QQ.
    streams.length = 0;
    await page.reload();
    await page.getByRole('heading', { name: '新对话', exact: true }).waitFor();
    await page.getByRole('button', { name: '历史对话', exact: true }).click();
    await page.getByText('还没有对话', { exact: true }).waitFor();
    expect(streams).toEqual([]);
    await page.keyboard.press('Escape');
    expect(await input.isEnabled()).toBe(true);
    expect(errors).toEqual([]);
  } finally { await browser.close(); await server.close(); }
}, 30000);


it.skipIf(!existsSync(executable))('updates selected navigation and status feedback with animation frames paused', async () => {
  const server = await createServer({ configFile: resolve('apps/desktop/vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false, fs: { allow: [resolve('.')] } } });
  await server.listen();
  const browser = await chromium.launch({ executablePath: executable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 680 } });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/v1/**', route => route.fulfill({ json: route.request().url().endsWith('/model-routes') ? {} : route.request().url().endsWith('/life/updates') ? { revision: '1' } : [] }));
    await page.goto(`http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}/@fs/${resolve('tests/fixtures/desktop-usability.html')}`);
    await page.getByRole('heading', { name: '先为大肥鱼添加一个模型' }).waitFor();
    const activeColor = await page.getByRole('button', { name: '聊天导航' }).evaluate(element => getComputedStyle(element).backgroundColor);
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
    await page.getByRole('tab', { name: '记忆', exact: true }).dispatchEvent('click');
    await page.locator('[role="tab"][aria-selected="true"]').filter({ hasText: '记忆' }).waitFor();
    const state = await page.evaluate(() => {
      const tab = document.querySelector('[role="tab"][aria-selected="true"]')!;
      const indicator = document.querySelector('[data-tabs-indicator]')!;
      const label = document.querySelector('[data-testid="current-status"] [data-badge-label]')!;
      const panel = document.querySelector('[role="tabpanel"]:not([hidden])')!;
      const a = tab.getBoundingClientRect(), b = indicator.getBoundingClientRect();
      return { count: document.querySelectorAll('[data-tabs-indicator]').length, x: Math.abs(a.x-b.x), y: Math.abs(a.y-b.y), label: label.textContent, labelOpacity: getComputedStyle(label).opacity, panelOpacity: getComputedStyle(panel).opacity };
    });
    expect(state).toMatchObject({ count: 1, x: 0, y: 0, label: '记忆', labelOpacity: '1', panelOpacity: '1' });
    expect(await page.getByRole('button', { name: '记忆导航' }).evaluate(element => getComputedStyle(element).backgroundColor)).toBe(activeColor);
    expect(await page.getByRole('button', { name: '聊天导航' }).getAttribute('data-active')).toBe(null);
    await page.getByRole('button', { name: '设置样例' }).dispatchEvent('click');
    await page.locator('.sidebar-bottom button.active').waitFor();
    expect(await page.locator('.primary-nav [data-active]').count()).toBe(0);
    expect(await page.getByRole('button', { name: '设置样例' }).evaluate(element => getComputedStyle(element).backgroundColor)).toBe(activeColor);
    expect(await page.getByTestId('current-status').textContent()).toBe('设置');
    expect(errors).toEqual([]);
  } finally { await browser.close(); await server.close(); }
}, 30000);
