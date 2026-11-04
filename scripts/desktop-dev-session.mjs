import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, lstatSync, existsSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { launch, terminateProcess, isProjectRuntime, withTimeout, launchWindowsJob } from './desktop-dev-processes.mjs';

export function desktopConfigPath(env = process.env, platform = process.platform, home = homedir()) {
  const base = platform === 'darwin' ? join(home, 'Library/Application Support')
    : platform === 'win32' ? env.APPDATA : env.XDG_CONFIG_HOME || join(home, '.config');
  if (!base) throw new Error('DEV_CONFIG_PATH_UNAVAILABLE');
  return join(base, 'org.bigfatfish.desktop', 'desktop.json');
}
export function resolveDevDataDir(env = process.env, platform = process.platform, home = homedir()) {
  let directory = env.BIGFATFISH_DATA_DIR;
  if (directory !== undefined && !directory.trim()) throw new Error('INVALID_DATA_DIR');
  const file = desktopConfigPath(env, platform, home);
  if (directory === undefined && existsSync(file)) {
    directory = JSON.parse(readFileSync(file, 'utf8')).dataDir;
    if (typeof directory !== 'string' || !directory.trim()) throw new Error('DEV_SETTINGS_INVALID');
  }
  if (directory === undefined) directory = platform === 'darwin' ? join(home, 'Library/Application Support/BigFatFish')
    : platform === 'win32' ? join(env.LOCALAPPDATA || join(home, 'AppData/Local'), 'BigFatFish')
      : join(env.XDG_DATA_HOME || join(home, '.local/share'), 'bigfatfish');
  return resolve(directory);
}
function lockDevelopment(directory) {
  for (const path of [directory, join(directory, 'runtime')]) {
    mkdirSync(path, { recursive: true, mode: 0o700 });
    if (lstatSync(path).isSymbolicLink()) throw new Error('UNSAFE_DATA_PATH');
  }
  const file = join(directory, 'runtime/desktop-dev.sqlite');
  if (existsSync(file) && lstatSync(file).isSymbolicLink()) throw new Error('UNSAFE_DATA_PATH');
  const db = new DatabaseSync(file);
  try { db.exec('PRAGMA busy_timeout=0; BEGIN EXCLUSIVE;'); }
  catch { db.close(); throw new Error('DEV_ALREADY_RUNNING'); }
  return () => { db.exec('ROLLBACK'); db.close(); };
}
export async function prepareNode(root, track, signal) {
  for (const args of [['node_modules/typescript/bin/tsc', '-p', 'tsconfig.node.json'], ['scripts/copy-runtime-assets.mjs']]) {
    const handle = track(launch(process.execPath, args, { cwd: root, detached: process.platform !== 'win32' }));
    const result = await handle.exited;
    signal?.throwIfAborted();
    if (result.error || result.code !== 0) throw new Error('DEV_NODE_BUILD_FAILED');
  }
}
async function frontend(root) {
  const { createServer } = await import('vite');
  const server = await createServer({ configFile: join(root, 'apps/desktop/vite.config.ts') });
  try { await server.listen(); } catch (error) { await server.close(); throw error; }
  return server;
}
export function managedTauriArgs(args) {
  const boundary = args.indexOf('--');
  const cliArgs = boundary < 0 ? args : args.slice(0, boundary);
  if (cliArgs.includes('--release')) throw new Error('DEV_RELEASE_UNSUPPORTED');
  const override = JSON.stringify({ build: { beforeDevCommand: '' }, bundle: { resources: [] } });
  return ['dev', ...cliArgs, '--config', override, ...(boundary < 0 ? [] : args.slice(boundary))];
}
export function launchDesktop(root, args, env) {
  const nodeArgs = [join(root, 'node_modules/@tauri-apps/cli/tauri.js'), ...managedTauriArgs(args)];
  const options = { cwd: join(root, 'apps/desktop'), env, detached: process.platform !== 'win32' };
  return process.platform === 'win32' ? launchWindowsJob(root, process.execPath, nodeArgs, options) : launch(process.execPath, nodeArgs, options);
}

// Dependency seams are ordinary function parameters, only used by isolated tests.
export async function startDevelopment({ root, dataDir = resolveDevDataDir(), args = [], signal,
  prepare = prepareNode, startFrontend = frontend, startDesktop = launchDesktop, log = console.log } = {}) {
  managedTauriArgs(args); // Reject incompatible modes before touching an existing runtime.
  root = realpathSync(root);
  dataDir = resolve(dataDir);
  let release, vite, runtime, desktop, connection, runtimeStopped = false, stopping = false, cleanup;
  const preparations = new Set();
  const track = handle => { preparations.add(handle); void handle.exited.then(() => preparations.delete(handle)); return handle; };
  let initializing = true, pendingFailure;
  const check = () => { signal?.throwIfAborted(); if (pendingFailure) throw pendingFailure; };
  let complete, fail;
  const finished = new Promise((resolve, reject) => { complete = resolve; fail = reject; });
  void finished.catch(() => {});
  let stopInstance, paths, readConnection, getStatus;
  const stop = (failure) => {
    if (cleanup) return cleanup;
    stopping = true;
    cleanup = (async () => {
      const errors = failure ? [failure] : [];
      async function attempt(fn) { try { await fn(); } catch (error) { errors.push(error); } }
      await attempt(() => terminateProcess(desktop, true));
      await attempt(async () => { if (vite) await vite.close(); });
      // The child is ours, but the data directory may now belong to a replacement.
      if (runtime && !runtimeStopped) {
        await attempt(async () => {
          if (connection) await stopInstance(paths(dataDir), connection.instanceId);
          else if (runtime.child.connected) runtime.child.send({ type: 'stop' }, () => {});
          const result = await withTimeout(runtime.exited, 12000, null);
          if (!result) { await terminateProcess(runtime); throw new Error('DEV_RUNTIME_STOP_TIMEOUT'); }
          if (result.error || (result.code !== 0 && !failure)) throw new Error('DEV_RUNTIME_STOP_FAILED');
        });
        // Even if authenticated stop failed, disconnect only our worker, never its replacement.
        if (runtime.child.connected) runtime.child.disconnect();
        await attempt(() => terminateProcess(runtime));
      }
      for (const handle of preparations) await attempt(() => terminateProcess(handle, true));
      await attempt(async () => { release?.(); });
      signal?.removeEventListener('abort', onAbort);
      if (errors.length) { const error = errors[0]; fail(error); throw error; }
      complete();
    })();
    void cleanup.catch(() => {});
    return cleanup;
  };
  const onAbort = () => {
    if (initializing) {
      for (const handle of preparations) void terminateProcess(handle, true).catch(() => {});
      if (runtime?.child.connected) runtime.child.send({ type: 'stop' }, () => {});
    } else void stop(signal.reason).catch(() => {});
  };
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    check();
    release = lockDevelopment(dataDir);
    log('[dev] 正在构建当前后台代码…');
    await prepare(root, track, signal);
    check();
    ({ paths } = await import(pathToFileURL(join(root, 'dist/runtime/src/paths.js')).href));
    ({ readConnection, getStatus } = await import(pathToFileURL(join(root, 'dist/runtime/src/connection.js')).href));
    ({ stop: stopInstance } = await import(pathToFileURL(join(root, 'dist/cli/src/process.js')).href));
    const p = paths(dataDir);
    if (existsSync(p.connection)) {
      const previous = readConnection(p);
      let status;
      try { status = await getStatus(p); } catch (error) {
        if (error.cause?.code !== 'ECONNREFUSED') throw new Error('DEV_EXISTING_RUNTIME_UNVERIFIED');
      }
      if (status) {
        if (status.pid !== previous.pid || status.instanceId !== previous.instanceId || !await isProjectRuntime(previous.pid, root)) throw new Error('DEV_EXTERNAL_RUNTIME');
        check();
        log('[dev] 正在停止本项目的旧后台…');
        await stopInstance(p, previous.instanceId);
      }
    }
    check();
    const env = { ...process.env, BIGFATFISH_DATA_DIR: dataDir, BIGFATFISH_DEV_MANAGED: '1',
      BIGFATFISH_DEV_NODE: process.execPath, BIGFATFISH_DEV_CLI: join(root, 'dist/cli/src/main.js') };
    runtime = launch(process.execPath, [join(root, 'scripts/desktop-dev-runtime.mjs')], { cwd: root, env, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    const ready = new Promise((resolveReady, reject) => {
      runtime.child.on('message', message => {
        if (message?.type === 'ready') resolveReady(message);
        if (message?.type === 'failed') reject(new Error(message.error));
      });
      runtime.exited.then(() => reject(new Error('DEV_RUNTIME_EXITED')));
    });
    const first = await withTimeout(ready, 15000, null);
    if (!first) throw new Error('DEV_RUNTIME_START_TIMEOUT');
    check();
    connection = readConnection(p);
    const status = await getStatus(p);
    if (connection.pid !== runtime.child.pid || status.pid !== runtime.child.pid || connection.instanceId !== first.instanceId || status.instanceId !== first.instanceId) throw new Error('DEV_RUNTIME_IDENTITY_CHANGED');
    runtime.exited.then(result => {
      runtimeStopped = true;
      if (!stopping) {
        pendingFailure = new Error(result.error ? 'DEV_RUNTIME_FAILED' : 'DEV_RUNTIME_EXITED');
        if (!initializing) void stop(pendingFailure).catch(() => {});
      }
    });
    log('[dev] 当前后台已就绪，正在启动桌面…');
    vite = await startFrontend(root);
    check();
    if (stopping) throw new Error('DEV_RUNTIME_EXITED');
    desktop = startDesktop(root, args, env);
    desktop.exited.then(result => {
      if (!stopping) void stop(result.error || result.code !== 0 ? new Error('DEV_DESKTOP_EXITED') : undefined).catch(() => {});
    });
    initializing = false;
    check();
    return { connection, finished, stop, runtime, desktop };
  } catch (error) { initializing = false; await stop(error); throw error; }
}
