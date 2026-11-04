import { spawn } from 'node:child_process';
import { closeSync, openSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { getStatus, readConnection, requestRuntime, type RuntimeStatus } from '../../runtime/src/connection.js';
import { preparePaths, privateFile, type DataPaths } from '../../runtime/src/paths.js';
import { join } from 'node:path';
import { acquireInstance } from '../../runtime/src/instance.js';
import type { StartupResult } from '../../runtime/src/startup.js';
export async function start(p: DataPaths, port: number): Promise<RuntimeStatus> {
  try { return await getStatus(p); } catch { /* An absent or stale connection is handled by the locked daemon. */ }
  preparePaths(p);
  const entry = fileURLToPath(new URL('../../runtime/src/main.js', import.meta.url));
  if (!existsSync(entry)) throw new Error('BUILD_REQUIRED');
  const logPath = join(p.logs, 'bootstrap.log');
  privateFile(logPath);
  const fd = openSync(logPath, 'a', 0o600);
  let child;
  try { child = spawn(process.execPath, [entry, '--data-dir', p.root, '--port', String(port)], { detached: true, stdio: ['ignore', fd, fd, 'ipc'], windowsHide: true }); }
  finally { closeSync(fd); }
  let startup: StartupResult['state'] | undefined;
  child.on('message', (message: unknown) => {
    const result = message as Partial<StartupResult> | null;
    if (result?.type === 'bigfatfish.startup' && ['ready', 'contended', 'failed'].includes(result.state ?? '')) startup = result.state;
  });
  let launchError: Error | undefined;
  child.on('error', (error) => { launchError = error; });
  child.unref();
  child.channel?.unref();
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    if (launchError) throw new Error('SPAWN_FAILED');
    if (startup === 'failed') throw new Error('START_FAILED');
    if ((child.exitCode !== null || child.signalCode !== null) && startup !== 'contended') throw new Error('START_FAILED');
    if (startup === 'ready' || startup === 'contended') {
      try { return await getStatus(p); } catch { /* Wait for authenticated readiness, including a competing winner. */ }
    }
    await delay(80);
  }
  throw new Error('START_TIMEOUT');
}
export async function stop(p: DataPaths, expectedInstanceId?: string): Promise<{ state: 'stopped'; alreadyStopped: boolean }> {
  const readCurrent = () => {
    try { return readConnection(p); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
  };
  const readinessDeadline = Date.now() + 12000;
  let connection;
  while (!(connection = readCurrent())) {
    if (!existsSync(p.lock)) return { state: 'stopped', alreadyStopped: true };
    try { const release = acquireInstance(p.lock); release(); return { state: 'stopped', alreadyStopped: true }; }
    catch (error) { if (!(error instanceof Error) || error.message !== 'ALREADY_RUNNING') throw error; }
    if (Date.now() > readinessDeadline) throw new Error('STOP_TIMEOUT');
    await delay(80);
  }
  if (expectedInstanceId && connection.instanceId !== expectedInstanceId) throw new Error('INSTANCE_CHANGED');
  let alreadyStopped = false;
  try { await requestRuntime(connection, '/v1/shutdown', 'POST'); }
  catch (error) {
    // Refusal can mean shutdown is still draining. Auth failures must never mean success.
    const cause = (error as { cause?: { code?: string } }).cause?.code;
    if (cause !== 'ECONNREFUSED') throw error;
    alreadyStopped = true;
  }
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const current = readCurrent();
    if (current && current.instanceId !== connection.instanceId) throw new Error('INSTANCE_CHANGED');
    // Connection deletion and socket closure precede DB cleanup. Only the kernel
    // lock proves that the old owner finished; maintenance still acquires its own lock.
    let release;
    try { release = acquireInstance(p.lock); }
    catch (error) { if (!(error instanceof Error) || error.message !== 'ALREADY_RUNNING') throw error; }
    if (release) {
      try {
        // A replacement may have published between our read and lock acquisition.
        const latest = readCurrent();
        if (latest && latest.instanceId !== connection.instanceId) throw new Error('INSTANCE_CHANGED');
        return { state: 'stopped', alreadyStopped };
      } finally { release(); }
    }
    await delay(80);
  }
  throw new Error('STOP_TIMEOUT');
}
