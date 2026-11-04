import { test, expect } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'node:http';
import { readConnection, getStatus, requestRuntime } from '../../apps/runtime/src/connection.js';
import { paths } from '../../apps/runtime/src/paths.js';
const root = resolve('.');
const sessionModule = pathToFileURL(join(root, 'scripts/desktop-dev-session.mjs')).href;
const processModule = pathToFileURL(join(root, 'scripts/desktop-dev-processes.mjs')).href;
const { startDevelopment, resolveDevDataDir, managedTauriArgs } = await import(sessionModule);
const { launch, terminateProcess, commandMatchesEntry, windowsCommandLine } = await import(processModule);
const prepare = async () => {};
const fakeDesktop = () => launch(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { detached: process.platform !== 'win32', stdio: 'ignore' });
async function frontend() {
  const server = createServer((_req, res) => res.end('ready'));
  await new Promise<void>(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  return { close: () => new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose())) };
}
const options = { root, prepare, startFrontend: frontend, startDesktop: fakeDesktop, log: () => {} };
async function waitReady(dataDir: string) {
  for (let i = 0; i < 120; i++) {
    try { return await getStatus(paths(dataDir)); } catch { await delay(50); }
  }
  throw new Error('TEST_RUNTIME_NOT_READY');
}
async function temporary(run: (dir: string) => Promise<void>) {
  const dir = mkdtempSync(join(tmpdir(), 'bigfatfish-dev-'));
  try { await run(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('data override and exact process boundaries include spaces without accepting lookalikes', () => {
  expect(resolveDevDataDir({ BIGFATFISH_DATA_DIR: '/tmp/data one', APPDATA: '/tmp/app' }, 'win32', '/tmp/home')).toBe('/tmp/data one');
  expect(commandMatchesEntry('/node /repo one/dist/runtime/src/main.js --data-dir /data --port 0', '/node', '/repo one/dist/runtime/src/main.js', 'darwin')).toBe(true);
  expect(commandMatchesEntry('/node /repo one/dist/runtime/src/main.js.evil --data-dir /data', '/node', '/repo one/dist/runtime/src/main.js', 'darwin')).toBe(false);
  expect(commandMatchesEntry('"C:\\Node Tools\\node.exe" "C:\\Fish App\\dist\\runtime\\src\\main.js" --data-dir "C:\\Data"', 'C:\\Node Tools\\node.exe', 'C:\\Fish App\\dist\\runtime\\src\\main.js', 'win32')).toBe(true);
});

test('takes over a real repository daemon, serves new stream, protects duplicate session and cleans up', async () => temporary(async dataDir => {
  const legacy = launch(process.execPath, [join(root, 'dist/runtime/src/main.js'), '--data-dir', dataDir, '--port', '0'], { stdio: 'ignore' });
  let session;
  try {
    const before = await waitReady(dataDir);
    session = await startDevelopment({ ...options, dataDir });
    expect(session.connection.pid).not.toBe(before.pid);
    const legacyResult = await legacy.exited;
    expect(legacyResult.code).toBe(0);
    await expect(startDevelopment({ ...options, dataDir })).rejects.toThrow('DEV_ALREADY_RUNNING');
    await requestRuntime(session.connection, '/v1/models', 'POST', { id: 'fixture', label: 'fixture', provider: 'openai', baseURL: 'http://127.0.0.1:1/v1', model: 'fixture', apiKey: 'local-only' });
    await requestRuntime(session.connection, '/v1/model-routes', 'PUT', { chat: 'fixture' });
    const conversation = await requestRuntime<{ id: string }>(session.connection, '/v1/conversations', 'POST', {});
    const response = await fetch(`http://127.0.0.1:${session.connection.port}/v1/events/stream?conversationId=${conversation.id}`, { headers: { authorization: `Bearer ${session.connection.token}` }, signal: AbortSignal.timeout(3000) });
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();
    const chunk = await reader.read();
    expect(new TextDecoder().decode(chunk.value)).toContain('snapshot');
    await reader.cancel();
    await session.stop();
    await session.finished;
    expect(existsSync(paths(dataDir).connection)).toBe(false);
    expect(session.runtime.child.exitCode).toBe(0);
    expect(session.desktop.child.exitCode !== null || session.desktop.child.signalCode !== null).toBe(true);
  } finally { await session?.stop().catch(() => {}); await terminateProcess(legacy); }
}));

test('refuses a real external-entry runtime without stopping it', async () => temporary(async dataDir => {
  const entry = pathToFileURL(join(root, 'dist/runtime/src/lifecycle.js')).href;
  const pathsEntry = pathToFileURL(join(root, 'dist/runtime/src/paths.js')).href;
  const code = `const {startRuntime}=await import(${JSON.stringify(entry)});const {paths}=await import(${JSON.stringify(pathsEntry)});const r=await startRuntime(paths(process.argv[1]));await r.finished;`;
  const external = launch(process.execPath, ['--input-type=module', '-e', code, dataDir], { stdio: 'ignore' });
  try {
    const before = await waitReady(dataDir);
    await expect(startDevelopment({ ...options, dataDir })).rejects.toThrow('DEV_EXTERNAL_RUNTIME');
    expect((await getStatus(paths(dataDir))).instanceId).toBe(before.instanceId);
  } finally { await terminateProcess(external); }
}));

test('frontend failure drains the already started runtime and releases dev lock', async () => temporary(async dataDir => {
  await expect(startDevelopment({ ...options, dataDir, startFrontend: async () => { throw new Error('EADDRINUSE'); } })).rejects.toThrow('EADDRINUSE');
  expect(existsSync(paths(dataDir).connection)).toBe(false);
  const next = await startDevelopment({ ...options, dataDir });
  await next.stop();
}));

test('abort during asynchronous frontend initialization waits then closes acquired resources', async () => temporary(async dataDir => {
  const controller = new AbortController(); let closed = false;
  await expect(startDevelopment({ ...options, dataDir, signal: controller.signal, startFrontend: async () => {
    controller.abort(new Error('DEV_INTERRUPTED')); await delay(30);
    return { close: async () => { closed = true; } };
  } })).rejects.toThrow('DEV_INTERRUPTED');
  expect(closed).toBe(true);
  expect(existsSync(paths(dataDir).connection)).toBe(false);
}));

test('Ctrl+C equivalent abort and desktop normal exit both clean the session', async () => temporary(async dataDir => {
  const controller = new AbortController();
  const session = await startDevelopment({ ...options, dataDir, signal: controller.signal });
  controller.abort(new Error('DEV_INTERRUPTED'));
  await expect(session.finished).rejects.toThrow('DEV_INTERRUPTED');
  expect(existsSync(paths(dataDir).connection)).toBe(false);
  const next = await startDevelopment({ ...options, dataDir, startDesktop: () => launch(process.execPath, ['-e', 'process.exit(0)'], { detached: process.platform !== 'win32', stdio: 'ignore' }) });
  await next.finished;
  expect(existsSync(paths(dataDir).connection)).toBe(false);
}));

test('unexpected runtime termination closes desktop and fails the session', async () => temporary(async dataDir => {
  const session = await startDevelopment({ ...options, dataDir });
  session.runtime.child.kill('SIGTERM');
  await expect(session.finished).rejects.toThrow('DEV_RUNTIME_EXITED');
  expect(session.desktop.child.exitCode !== null || session.desktop.child.signalCode !== null).toBe(true);
  expect(existsSync(paths(dataDir).connection)).toBe(false);
}));

test('expected-instance shutdown refuses a replacement before sending shutdown', async () => temporary(async dataDir => {
  const session = await startDevelopment({ ...options, dataDir });
  const { stop } = await import('../../apps/cli/src/process.js');
  try {
    await expect(stop(paths(dataDir), 'a-different-instance')).rejects.toThrow('INSTANCE_CHANGED');
    expect(readConnection(paths(dataDir)).instanceId).toBe(session.connection.instanceId);
    expect((await getStatus(paths(dataDir))).state).toBe('running');
  } finally { await session.stop(); }
}));

test('abort while preparing terminates owned build process and allows a retry', async () => temporary(async dataDir => {
  const controller = new AbortController(); let build;
  await expect(startDevelopment({ ...options, dataDir, signal: controller.signal, prepare: async (_root: string, track: (value: unknown) => unknown) => {
    build = launch(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { detached: process.platform !== 'win32', stdio: 'ignore' });
    track(build); controller.abort(new Error('DEV_INTERRUPTED')); await build.exited;
  } })).rejects.toThrow('DEV_INTERRUPTED');
  expect(build.child.exitCode !== null || build.child.signalCode !== null).toBe(true);
  const next = await startDevelopment({ ...options, dataDir }); await next.stop();
}));


test('Tauri managed config precedes runner boundary and release fails before preparation', async () => temporary(async dataDir => {
  const args = managedTauriArgs(['--no-watch', '--', '--features', 'test', '--', '--background']);
  expect(args.indexOf('--config')).toBeLessThan(args.indexOf('--'));
  expect(args.slice(-2)).toEqual(['--', '--background']);
  let prepared = false;
  await expect(startDevelopment({ ...options, dataDir, args: ['--release'], prepare: async () => { prepared = true; } })).rejects.toThrow('DEV_RELEASE_UNSUPPORTED');
  expect(prepared).toBe(false);
  expect(windowsCommandLine(['C:\\path with space\\', 'a"b'])).toBe('"C:\\path with space\\\\" "a\\"b"');
}));
