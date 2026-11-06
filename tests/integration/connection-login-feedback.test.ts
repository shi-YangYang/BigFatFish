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
