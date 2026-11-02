import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { chmodSync, lstatSync, mkdirSync, openSync, closeSync, existsSync } from 'node:fs';
import { windowsAcl } from './windows-acl.js';

export function dataRoot(explicit?: string, env = process.env, platform: NodeJS.Platform = process.platform, home = homedir()): string {
  const selected = explicit ?? env.BIGFATFISH_DATA_DIR;
  if (selected !== undefined) {
    if (!selected.trim()) throw new Error('EMPTY_DATA_DIR');
    return resolve(selected);
  }
  if (platform === 'win32') return join(env.LOCALAPPDATA || join(home, 'AppData', 'Local'), 'BigFatFish');
  if (platform === 'darwin') return join(home, 'Library', 'Application Support', 'BigFatFish');
  return join(env.XDG_DATA_HOME || join(home, '.local', 'share'), 'bigfatfish');
}
export function paths(root: string) {
  return { root, config: join(root, 'config'), data: join(root, 'data'), runtime: join(root, 'runtime'), logs: join(root, 'logs'), database: join(root, 'data', 'bigfatfish.sqlite'), lock: join(root, 'runtime', 'instance.sqlite'), connection: join(root, 'runtime', 'connection.json'), log: join(root, 'logs', 'runtime.jsonl') };
}
export type DataPaths = ReturnType<typeof paths>;
export function assertRegular(path: string, directory = false) {
  let stat;
  try { stat = lstatSync(path); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile())) throw new Error('UNSAFE_DATA_PATH');
  if (process.platform !== 'win32' && stat.uid !== process.getuid?.()) throw new Error('DATA_OWNER_MISMATCH');
}
export function privateFile(path: string) {
  assertRegular(path);
  closeSync(openSync(path, 'a', 0o600));
  if (process.platform !== 'win32') chmodSync(path, 0o600);
  else windowsAcl('restrict', [{ path, directory: false }]);
}
export function preparePaths(p: DataPaths) {
  const directories = [p.root, p.config, p.data, p.runtime, p.logs];
  for (const directory of directories) {
    assertRegular(directory, true);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (process.platform !== 'win32') chmodSync(directory, 0o700);
  }
  const files = [p.database, p.lock, p.log];
  for (const file of files) {
    assertRegular(file);
    closeSync(openSync(file, 'a', 0o600));
    if (process.platform !== 'win32') chmodSync(file, 0o600);
  }
  // Only product-owned paths: do not recurse into unrelated user data.
  for (const file of [p.connection, join(p.config, 'master.key'), join(p.logs, 'bootstrap.log'), ...[p.database, p.lock].flatMap(file => ['-wal', '-shm', '-journal'].map(suffix => file + suffix))]) {
    assertRegular(file);
    if (existsSync(file)) files.push(file);
  }
  if (process.platform === 'win32') windowsAcl('restrict', [
    ...directories.map(path => ({ path, directory: true })),
    ...files.map(path => ({ path, directory: false })),
  ]);
}
