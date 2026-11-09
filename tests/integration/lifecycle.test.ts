import { afterEach, expect, it } from 'vitest';
import { execFile, fork } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { paths, preparePaths } from '../../apps/runtime/src/paths.js';
import { acquireInstance } from '../../apps/runtime/src/instance.js';
const exec = promisify(execFile);
const entry = resolve('dist/cli/src/main.js');
const roots: string[] = [];
function temp() { const root = mkdtempSync(join(tmpdir(), 'bigfatfish integration ')); roots.push(root); return root; }
async function cli(root: string, command: string, extra: string[] = []) {
  try { const result = await exec(process.execPath, [entry, command, '--data-dir', root, '--json', ...extra]); return { code: 0, value: JSON.parse(result.stdout) }; }
  catch (error) { const e = error as { code: number; stdout: string }; return { code: e.code, value: JSON.parse(e.stdout) }; }
}
afterEach(async () => {
  for (const root of roots.splice(0)) { await cli(root, 'stop'); rmSync(root, { recursive: true, force: true }); }
});
it('executes a real detached lifecycle, concurrent starts, auth, persistence, and crash recovery', async () => {
  const root = temp();
  expect(await cli(root, 'status')).toEqual({ code: 3, value: { state: 'stopped' } });
  const results = await Promise.all(Array.from({ length: 4 }, () => cli(root, 'start')));
  expect(results.map(r => r.code)).toEqual([0, 0, 0, 0]);
  expect(new Set(results.map(r => r.value.instanceId)).size).toBe(1);
  const first = results[0]!.value;
  expect(first.state).toBe('running');
  expect((await cli(root, 'status')).value.instanceId).toBe(first.instanceId);
  expect((await cli(root, 'doctor')).code).toBe(0);
  const metadata = JSON.parse(readFileSync(join(root, 'runtime/connection.json'), 'utf8'));
  const health = await fetch(`http://127.0.0.1:${metadata.port}/health`);
  expect(await health.json()).toEqual({ status: 'ok' });
  expect((await fetch(`http://127.0.0.1:${metadata.port}/v1/shutdown`, { method: 'POST', headers: { authorization: 'Bearer wrong', 'content-type': 'application/json' }, body: '{}' })).status).toBe(401);
  const logs = await cli(root, 'logs'); expect(logs.code).toBe(0); expect(JSON.stringify(logs)).not.toContain(metadata.token);
  const restarted = await cli(root, 'restart'); expect(restarted.code).toBe(0); expect(restarted.value.instanceId).not.toBe(first.instanceId);
  expect((await cli(root, 'stop')).code).toBe(0);
  expect((await cli(root, 'stop')).value.alreadyStopped).toBe(true);
  const db = new DatabaseSync(join(root, 'data/bigfatfish.sqlite'));
  expect(db.prepare("SELECT count(*) AS n FROM audit WHERE event='runtime.started'").get()?.n).toBe(2);
  db.prepare('INSERT INTO settings VALUES (?,?)').run('persistent', 'yes'); db.close();
  const doomed = await cli(root, 'start'); expect(doomed.code).toBe(0);
  // This PID came from an authenticated status in this test's private directory.
  process.kill(doomed.value.pid, 'SIGKILL'); await delay(200);
  const recovered = await cli(root, 'start'); expect(recovered.code).toBe(0); expect(recovered.value.instanceId).not.toBe(doomed.value.instanceId);
  expect((await cli(root, 'stop')).code).toBe(0);
  const reopened = new DatabaseSync(join(root, 'data/bigfatfish.sqlite'));
  expect(reopened.prepare('SELECT value FROM settings WHERE key=?').get('persistent')?.value).toBe('yes'); reopened.close();
});
it('rejects invalid arguments, refuses occupied ports and recovers from startup failure', async () => {
  const root = temp(); const listener = createServer();
  await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
  const address = listener.address(); if (!address || typeof address === 'string') throw new Error('missing port');
  try { expect((await cli(root, 'start', ['--port', String(address.port)])).code).toBe(1); }
  finally { await new Promise<void>(resolve => listener.close(() => resolve())); }
  expect((await cli(root, 'start', ['--port', '-1'])).code).toBe(1);
  expect((await cli(root, 'start')).code).toBe(0);
  expect((await cli(root, 'logs', ['--lines', '999'])).code).toBe(1);
});
it('never reports success or stops a daemon with an invalid token', async () => {
  const root = temp(); expect((await cli(root, 'start')).code).toBe(0);
  const file = join(root, 'runtime/connection.json'); const original = readFileSync(file, 'utf8');
  try {
    const data = JSON.parse(original); data.token = 'f'.repeat(64); writeFileSync(file, JSON.stringify(data));
    expect((await cli(root, 'stop')).code).toBe(1);
    expect((await cli(root, 'status')).code).toBe(1);
  } finally { writeFileSync(file, original); }
  expect((await cli(root, 'status')).code).toBe(0);
});

async function freePort() {
  const listener = createServer();
  await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
  const address = listener.address(); if (!address || typeof address === 'string') throw new Error('missing port');
  await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return address.port;
}
async function assertReleased(root: string, port: number) {
  expect(existsSync(paths(root).connection)).toBe(false);
  const release = acquireInstance(paths(root).lock); release();
  const listener = createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(port, '127.0.0.1', resolve);
  });
  await new Promise<void>(resolve => listener.close(() => resolve()));
}
for (const mode of ['during-listen', 'repeat-stop', 'shutdown-error']) {
  it(`closes the actual process and port after ${mode}`, async () => {
    const root = temp(); const port = await freePort();
    // execFile completes only when the child actually exits; a leaked socket times out.
    const result = await exec(process.execPath, [resolve('tests/fixtures/interrupted-start.mjs'), root, String(port), mode], { timeout: 15000, killSignal: 'SIGKILL' });
    if (mode === 'during-listen') expect(result.stdout).toContain('START_INTERRUPTED');
    await assertReleased(root, port);
  });
}
it.skipIf(process.platform === 'win32')('gracefully exits and releases its port on a real OS SIGTERM', async () => {
  const root = temp(); const port = await freePort();
  const child = fork(resolve('tests/fixtures/interrupted-start.mjs'), [root, String(port), 'os-signal'], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  const exited = new Promise<number | null>((resolve, reject) => { child.once('exit', resolve); child.once('error', reject); });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('fixture readiness timeout')), 10000);
      child.once('message', () => { clearTimeout(timer); resolve(); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('fixture exited before readiness')); });
    });
    child.kill('SIGTERM');
    expect(await Promise.race([exited, delay(5000).then(() => { throw new Error('signal exit timeout'); })])).toBe(0);
    await assertReleased(root, port);
  } finally { if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited; } }
});
it('waits for a contending winner through real slow database initialization', async () => {
  const root = temp(); const p = paths(root); preparePaths(p);
  const db = new DatabaseSync(p.database);
  db.exec('PRAGMA journal_mode=WAL; BEGIN IMMEDIATE');
  let locked = true;
  const starts = Promise.all(Array.from({ length: 3 }, () => cli(root, 'start')));
  try {
    // Wait for a daemon to own the instance lock while blocked by our real DB transaction.
    const deadline = Date.now() + 10000;
    while (true) {
      try { const release = acquireInstance(p.lock); release(); }
      catch (error) { if (error instanceof Error && error.message === 'ALREADY_RUNNING') break; throw error; }
      if (Date.now() >= deadline) throw new Error('winner did not acquire lock');
      await delay(40);
    }
    await delay(1400);
    db.exec('ROLLBACK'); locked = false;
    const results = await starts;
    expect(results.map(result => result.code)).toEqual([0, 0, 0]);
    expect(new Set(results.map(result => result.value.instanceId)).size).toBe(1);
    expect((await cli(root, 'status')).value.instanceId).toBe(results[0]!.value.instanceId);
  } finally { if (locked) db.exec('ROLLBACK'); db.close(); await starts; }
});
