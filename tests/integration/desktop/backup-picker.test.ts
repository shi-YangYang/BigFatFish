import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { expect, it } from 'vitest';

const executable = process.env.BFF_TEST_BROWSER ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
it.skipIf(!existsSync(executable))('selects archive paths without running maintenance and keeps restore confirmation separate', async () => {
  const server = await createServer({ configFile: resolve('apps/desktop/vite.config.ts'),
    server: { host: '127.0.0.1', port: 0, strictPort: false, fs: { allow: [resolve('.')] } } });
  await server.listen();
  const browser = await chromium.launch({ executablePath: executable, headless: true });
  try {
    const page = await browser.newPage();
    const actions: { action: string; input: { file: string; password?: string } }[] = [];
    const chosen = { export: [null, '/sample/out.bff'], restore: ['/sample/in.bff', null] };
    await page.exposeFunction('archiveInvoke', (cmd: string, args: { mode: keyof typeof chosen } & typeof actions[number]) => {
      if (cmd === 'desktop_pick_backup_file') return chosen[args.mode].shift();
      if (cmd !== 'desktop_maintenance') throw Error('Unexpected command: ' + cmd);
      actions.push(args);
      return { rollback: '/sample/rollback' };
    });
    await page.addInitScript(() => {
      const w = window as unknown as { __TAURI_INTERNALS__: object; archiveInvoke: (...args: unknown[]) => unknown };
      w.__TAURI_INTERNALS__ = { invoke: (...args: unknown[]) => w.archiveInvoke(...args) };
    });
    await page.goto(server.resolvedUrls!.local[0] + '@fs/' + resolve('tests/fixtures/desktop/desktop-clarity.html') + '?backup');
    const button = (name: string) => page.getByRole('button', { name, exact: true });
    await button('选择保存位置').click(); // Cancel a native save dialog.
    expect(await button('创建备份').isDisabled()).toBe(true);
    await button('选择保存位置').click();
    await page.getByText('/sample/out.bff', { exact: true }).waitFor();
    await page.getByLabel('加密密码（可选，至少 12 个字符）', { exact: true }).fill('example-password-only');
    await button('创建备份').click();
    await expect.poll(() => actions.length).toBe(1);
    expect(actions[0]).toMatchObject({ action: 'export', input: { file: '/sample/out.bff', password: 'example-password-only' } });

    await page.getByRole('group', { name: '备份操作' }).getByRole('button', { name: '恢复数据' }).click();
    const restore = page.locator('.ui-section-card').getByRole('button', { name: '恢复数据' });
    expect(await restore.isDisabled()).toBe(true);
    expect(await page.getByLabel('备份密码', { exact: false }).inputValue()).toBe('');
    await button('选择备份文件').click();
    await page.getByText('/sample/in.bff', { exact: true }).waitFor();
    await button('选择备份文件').click(); // A cancelled re-selection must keep the old path.
    await restore.click();
    await page.getByRole('alertdialog').getByRole('button', { name: '取消' }).click();
    expect(actions).toHaveLength(1);
    await restore.click();
    await button('确认继续').click();
    await expect.poll(() => actions.length).toBe(2);
    expect(actions[1]).toMatchObject({ action: 'restore', input: { file: '/sample/in.bff' } });
    expect(actions[1]!.input.password).toBeUndefined();
  } finally { await browser.close(); await server.close(); }
});
