import { expect, it } from 'vitest';
import { fork } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { stop } from '../../apps/cli/src/runtime/process.js';
import { paths } from '../../apps/runtime/src/paths.js';
import { acquireInstance } from '../../apps/runtime/src/instance.js';

async function fixture(mode: string) {
  const root = mkdtempSync(join(tmpdir(), 'bff stop completion '));
  const child = fork(resolve('tests/fixtures/stop-lock.mjs'), [root, mode], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  const exited = new Promise<void>((resolve, reject) => { child.once('exit', code => code === 0 ? resolve() : reject(new Error(`fixture exit ${code}`))); child.once('error', reject); });
  const states = new Set<string>();
  child.on('message', (message: { state: string }) => states.add(message.state));
  const until = async (state: string) => {
    const deadline = Date.now() + 5000;
    while (!states.has(state)) { if (Date.now() > deadline) throw new Error('fixture readiness timeout'); await delay(10); }
  };
  await until('ready');
  return { p: paths(root), until, release: async () => { child.send('release'); await exited; }, cleanup: async () => {
    if (child.connected) { child.send('release'); await exited; }
    rmSync(root, { recursive: true, force: true });
  } };
}

for (const mode of ['deleted', 'refused', 'startup']) {
  it(`waits for the kernel lock after ${mode}, then permits immediate maintenance`, async () => {
    const f = await fixture(mode);
    const stopping = stop(f.p);
    try {
      if (mode === 'deleted') await f.until('listener-closed-lock-held');
      expect(() => acquireInstance(f.p.lock)).toThrow('ALREADY_RUNNING');
      // The fixture cannot release until IPC below, so an early success is a deterministic bug.
      expect(await Promise.race([stopping.then(() => 'early-success'), delay(200, 'waiting')])).toBe('waiting');
      await f.release();
      expect(await stopping).toEqual({ state: 'stopped', alreadyStopped: mode !== 'deleted' });
      const release = acquireInstance(f.p.lock); release();
    } finally { await f.cleanup(); await stopping.catch(() => {}); }
  });
}

for (const [mode, error] of [['auth', 'UNAUTHORIZED'], ['changed', 'INSTANCE_CHANGED']] as const) {
  it(`rejects ${mode} without releasing or stopping the lock owner`, async () => {
    const f = await fixture(mode);
    try {
      await expect(stop(f.p)).rejects.toThrow(error);
      expect(() => acquireInstance(f.p.lock)).toThrow('ALREADY_RUNNING');
    } finally { await f.cleanup(); }
  });
}

it('times out while a shutting-down instance still holds the lock', async () => {
  const f = await fixture('deleted');
  try {
    await expect(stop(f.p)).rejects.toThrow('STOP_TIMEOUT');
    expect(() => acquireInstance(f.p.lock)).toThrow('ALREADY_RUNNING');
  } finally { await f.cleanup(); }
});
