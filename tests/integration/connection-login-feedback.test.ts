import { it, expect } from 'vitest';
import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import type { ChannelStatus } from '../../apps/runtime/src/channels/types';
import type { ManagedQQStatus } from '../../apps/runtime/src/channels/managed/types';

const browserPath = process.env.BFF_TEST_BROWSER ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
it.skipIf(!existsSync(browserPath))('shows the current login step and keeps failures on the corresponding connection card', async () => {
  const server = await createServer({ configFile: resolve('apps/web/vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false } });
  await server.listen();
  const browser = await chromium.launch({ executablePath: browserPath });
  try {
    const page = await browser.newPage({ viewport: { width: 1040, height: 800 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(7000);
    // The image encodes only this fixture string.
    const qr = await createRequire(import.meta.url)('qrcode').toDataURL('BigFatFish login feedback fixture');
    const config = { mode: 'managed' as const, url: 'ws://127.0.0.1:3001', accountId: '10001', ownerId: '10002', enabled: true, groups: [], replyEnabled: true, proactiveEnabled: false };
    const channel: ChannelStatus = { config, revision: 'fixture', manifest: {}, hasToken: true, health: { state: 'reconnecting', error: 'CONNECTION_LOST' } };
    const component: ManagedQQStatus = { phase: 'login', supported: true, engine: 'docker', busy: false, version: 'fixture', qr };
    const bili = { enabled: true, revision: 'fixture', health: { ffmpeg: true }, accountState: 'expired-or-unavailable',
      connection: { phase: 'login', login: { status: 'waiting', image: qr }, error: '' } };
    const douyin = { config: { enabled: true, accountId: '12345', executablePath: '', pythonPath: 'python3', headless: false },
      browser: { state: 'ready' }, accountState: 'login-required', revision: 'fixture', connection: { phase: 'login', loginState: 'verification', error: '' } };
    const responses: Record<string, unknown> = {
      '/v1/status': { state: 'running' }, '/v1/models': [], '/v1/conversations/local': [], '/v1/model-routes': {},
      '/v1/channels/qq': channel, '/v1/channels/qq/component': component, '/v1/channels/qq/component/contacts': { friends: [], groups: [] },
      '/v1/bilibili': bili, '/v1/bilibili/tasks': [], '/v1/douyin': douyin, '/v1/activities': { tasks: [], schedules: [] },
    };
    let rejectDouyinRead = false;
    await page.route('**/auth/session', route => route.fulfill({ json: { csrf: 'fixture' } }));
    await page.route('**/api/v1/**', route => {
      const path = new URL(route.request().url()).pathname.slice(4);
      if (path === '/v1/douyin' && rejectDouyinRead) return route.fulfill({ status: 503, json: { error: 'UNAVAILABLE' } });
      if (path === '/v1/channels/qq/component/refresh' || path === '/v1/channels/qq/component/settings') {
        const error = path.endsWith('/refresh') ? 'QQ_COMPONENT_REQUEST_FAILED' : 'QQ_ACCOUNT_CHANGED';
        Object.assign(component, { phase: 'error', error, operationError: error, qr: undefined });
      }
      if (path === '/v1/bilibili/connect') { bili.connection.phase = 'login'; bili.connection.login.status = 'waiting'; bili.connection.error = ''; }
      return route.fulfill({ json: responses[path] ?? {} });
    });
    await page.goto(`http://127.0.0.1:${(server.httpServer!.address() as {port: number}).port}`);
    const manage = (name: string) => page.locator('.connection-list [role=article]').filter({ has: page.getByRole('heading', { name, exact: true }) }).getByRole('button', { name: '管理连接' });
    const back = page.getByRole('button', { name: '← 所有连接' });
    const badge = (text: string) => page.getByText(text, { exact: true }).and(page.locator('[data-badge-label]'));
    const noAlert = async () => expect(await page.getByRole('alert').count()).toBe(0);

    await page.getByRole('button', { name: '连接', exact: true }).click();
    await page.locator('.connection-list [role=article]').first().getByText('等待扫码', { exact: true }).waitFor();
    await manage('QQ').click();
    await page.getByRole('img', { name: 'QQ 登录二维码' }).waitFor();
    await badge('等待扫码').waitFor();
    await noAlert();
    expect(await page.getByText('正在重连').count()).toBe(0);
    mkdirSync('build/connection-login-feedback', { recursive: true });
    await page.screenshot({ path: 'build/connection-login-feedback/qq-waiting.png' });

    component.loginPhase = 'qrcode_scanned';
    await badge('等待手机确认').waitFor();
    expect(await page.getByRole('img', { name: 'QQ 登录二维码' }).count()).toBe(0);
    component.error = 'QQ_LOGIN_FAILED';
    await page.locator('.qq-account-card').getByRole('alert').getByText(/刷新二维码/).waitFor();
    await page.getByRole('button', { name: '刷新二维码' }).click();
    await page.locator('.qq-account-card').getByRole('alert').getByText(/未能完成操作/).waitFor();
    // Successful polls clear the current error but retain the last operationError.
    Object.assign(component, { phase: 'login', loginPhase: 'waiting_qrcode', qr, error: undefined });
    await badge('等待扫码').waitFor();
    await noAlert();
    component.loginPhase = 'qrcode_scanned';
    await badge('等待手机确认').waitFor(); await noAlert();
    Object.assign(component, { phase: 'verifying', loginPhase: 'message_service', qr: undefined });
    await badge('正在连接消息服务').waitFor(); await noAlert();
    expect(await page.getByRole('button', { name: '刷新二维码' }).count()).toBe(0);
    expect(await page.getByRole('button', { name: '断开连接' }).isEnabled()).toBe(true);
    Object.assign(component, { phase: 'online', account: { id: '10001', name: '测试' }, qr: undefined, loginPhase: undefined });
    channel.health = { state: 'online' };
    await badge('已连接').waitFor(); await noAlert();
    await page.getByRole('button', { name: '保存设置' }).click();
    await page.locator('.qq-account-card').getByRole('alert').getByText(/核对回复设置/).waitFor();
    Object.assign(component, { phase: 'online', error: undefined });
    await badge('已连接').waitFor();
    await page.locator('.qq-reply-card').getByRole('alert').getByText(/核对回复设置/).waitFor();

    channel.config = { ...config, mode: 'external' }; channel.health = { state: 'error', error: 'TOKEN_REJECTED' };
    await back.click(); await manage('QQ').click();
    await page.getByRole('article').filter({ has: page.getByRole('button', { name: '使用扫码登录' }) }).getByRole('alert').getByText(/凭据被拒绝/).waitFor();
    await page.getByRole('button', { name: '使用扫码登录' }).click();
    expect(await page.getByText(/凭据被拒绝/).count()).toBe(0);

    await back.click(); await manage('B站').click();
    await page.getByRole('img', { name: 'B站登录二维码' }).waitFor();
    await noAlert();
    bili.connection.login.status = 'scanned';
    await badge('等待手机确认').waitFor();
    bili.connection.phase = 'expired';
    await page.getByRole('button', { name: '重新获取二维码' }).click();
    await badge('等待扫码').waitFor();
    bili.connection.phase = 'error'; bili.connection.error = 'BILI_LOGIN_FAILED';
    await page.locator('.platform-account-card').getByRole('alert').getByText(/登录验证失败/).waitFor();
    await page.getByRole('button', { name: '重试连接' }).click();
    await badge('等待扫码').waitFor(); await noAlert();

    await back.click(); await manage('抖音').click();
    await badge('等待验证').waitFor(); await noAlert();
    douyin.connection.loginState = 'confirmation';
    await badge('等待手机确认').waitFor();
    douyin.connection.phase = 'error'; douyin.connection.error = 'DOUYIN_ACCOUNT_CHANGED';
    await page.locator('.platform-account-card').getByRole('alert').getByText(/浏览器账号已变化/).waitFor();
    douyin.connection.phase = 'online'; douyin.connection.error = ''; douyin.accountState = 'verified';
    await badge('已连接').waitFor(); await noAlert();
    rejectDouyinRead = true;
    await page.locator('.platform-account-card').getByRole('alert').getByText(/暂时无法读取连接状态/).waitFor();
    expect(await page.locator('.notification-region [role=alert]').count()).toBe(0);
    rejectDouyinRead = false;
    await page.getByRole('button', { name: '重试', exact: true }).click();
    await badge('已连接').waitFor(); await noAlert();
  } finally {
    await browser.close(); await server.close();
  }
}, 65000);

it.skipIf(!existsSync(browserPath))('keeps connection settings failures in the dialog and reveals the next step after success', async () => {
  const server = await createServer({ configFile: resolve('apps/desktop/vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false, fs: { allow: [resolve('.')] } } });
  await server.listen();
  const browser = await chromium.launch({ executablePath: browserPath });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 680 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(5000);
    const bili = { enabled: true, hasCredentials: true, accountState: 'verified', revision: 'bili-1', account: { mid: '10001', name: '测试账号' }, connection: { phase: 'online' } };
    const douyin = { config: { enabled: false, executablePath: '', pythonPath: 'python3', accountId: '', headless: false }, accountState: 'unverified', revision: 'douyin-1', connection: { phase: 'idle', loginState: '' } };
    let rejectBili = true, rejectLogout = true, rejectDouyin = true;
    const requests: Array<{ path: string; body: Record<string, unknown> }> = [];
    await page.route('**/api/v1/**', async route => {
      const request = route.request(), path = new URL(request.url()).pathname.slice(4);
      if (request.method() === 'POST') requests.push({ path, body: request.postDataJSON() });
      if (path === '/v1/bilibili/connect') {
        if (rejectBili) return route.fulfill({ status: 400, json: { error: 'BILI_LOGIN_FAILED' } });
        bili.revision = 'bili-connected';
        return route.fulfill({ json: {} });
      }
      if (path === '/v1/bilibili/logout') {
        if (rejectLogout) return route.fulfill({ status: 503, json: { error: 'BILI_TIMEOUT' } });
        Object.assign(bili, { enabled: false, hasCredentials: false, accountState: 'signed-out', revision: 'bili-out', connection: { phase: 'idle' } });
        return route.fulfill({ json: {} });
      }
      if (path === '/v1/douyin/connect') {
        if (rejectDouyin) return route.fulfill({ status: 400, json: { error: 'BROWSER_LAUNCH_FAILED' } });
        douyin.config = { ...douyin.config, ...request.postDataJSON(), enabled: true };
        douyin.connection = { phase: 'login', loginState: 'confirmation' };
        douyin.revision = 'douyin-connecting';
        return route.fulfill({ json: {} });
      }
      const json = path === '/v1/bilibili' ? bili : path === '/v1/douyin' ? douyin : path === '/v1/activities' ? { tasks: [], schedules: [] } : [];
      return route.fulfill({ json });
    });
    const url = `http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}/@fs/${resolve('tests/fixtures/desktop-clarity.html')}`;
    await page.goto(`${url}?bili`);
    await page.getByRole('button', { name: '导入凭据', exact: true }).click();
    const biliDialog = page.getByRole('dialog', { name: '导入凭据', exact: true });
    await biliDialog.getByLabel('SESSDATA', { exact: true }).fill('fixture-sessdata');
    await biliDialog.getByLabel('bili_jct', { exact: true }).fill('fixture-csrf');
    await biliDialog.getByRole('button', { name: '验证并连接', exact: true }).click();
    await biliDialog.getByRole('alert').getByText(/登录验证失败/).waitFor();
    // A new polled revision must not erase the current form failure or its input.
    bili.revision = 'bili-poll'; bili.account.mid = '10002';
    await page.locator('.platform-account-card').getByText('10002', { exact: true }).waitFor();
    expect(await biliDialog.getByRole('alert').isVisible()).toBe(true);
    expect(await biliDialog.getByLabel('SESSDATA', { exact: true }).inputValue()).toBe('fixture-sessdata');
    expect(await biliDialog.getByLabel('bili_jct', { exact: true }).inputValue()).toBe('fixture-csrf');
    await biliDialog.getByRole('button', { name: '退出登录', exact: true }).click();
    await biliDialog.getByRole('alert').getByText('B站任务超时。', { exact: true }).waitFor();
    expect(await biliDialog.getByLabel('SESSDATA', { exact: true }).inputValue()).toBe('fixture-sessdata');
    rejectBili = false;
    await biliDialog.getByRole('button', { name: '验证并连接', exact: true }).click();
    await biliDialog.waitFor({ state: 'detached' });
    await page.locator('[data-badge-label]').getByText('已连接', { exact: true }).waitFor();
    expect(requests.filter(item => item.path === '/v1/bilibili/connect').at(-1)?.body).toEqual({ revision: 'bili-poll', credentials: { sessdata: 'fixture-sessdata', bili_jct: 'fixture-csrf' } });
    await page.getByRole('button', { name: '导入凭据', exact: true }).click();
    expect(await biliDialog.getByLabel('SESSDATA', { exact: true }).inputValue()).toBe('');
    expect(await biliDialog.getByLabel('bili_jct', { exact: true }).inputValue()).toBe('');
    expect(await biliDialog.getByRole('alert').count()).toBe(0);
    rejectLogout = false;
    await biliDialog.getByRole('button', { name: '退出登录', exact: true }).click();
    await biliDialog.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: '连接 B站', exact: true }).waitFor();

    await page.goto(`${url}?douyin`);
    await page.getByRole('button', { name: '连接设置', exact: true }).click();
    const douyinDialog = page.getByRole('dialog', { name: '连接设置', exact: true });
    await douyinDialog.getByLabel('浏览器路径', { exact: true }).fill('/fixture/chrome');
    await douyinDialog.getByRole('button', { name: '保存并连接', exact: true }).click();
    await douyinDialog.getByRole('alert').getByText(/浏览器无法启动/).waitFor();
    douyin.revision = 'douyin-poll'; douyin.config.accountId = '20002';
    await page.locator('.platform-account-card').getByText('20002', { exact: true }).waitFor();
    expect(await douyinDialog.getByRole('alert').isVisible()).toBe(true);
    expect(await douyinDialog.getByLabel('浏览器路径', { exact: true }).inputValue()).toBe('/fixture/chrome');
    expect(await douyinDialog.getByLabel('账号 ID', { exact: true }).inputValue()).toBe('');
    mkdirSync('build/desktop-clarity/browser', { recursive: true });
    await page.screenshot({ path: 'build/desktop-clarity/browser/connection-settings-error-r1.png' });
    rejectDouyin = false;
    await douyinDialog.getByRole('button', { name: '保存并连接', exact: true }).click();
    await douyinDialog.waitFor({ state: 'detached' });
    await page.getByText('请在手机上确认登录', { exact: true }).waitFor();
    expect(requests.filter(item => item.path === '/v1/douyin/connect').at(-1)?.body).toMatchObject({ executablePath: '/fixture/chrome', revision: 'douyin-1', accountId: '' });
    expect(await page.getByRole('alert').count()).toBe(0);
    await page.screenshot({ path: 'build/desktop-clarity/browser/connection-settings-success-r1.png' });
  } finally { await browser.close(); await server.close(); }
}, 25000);
