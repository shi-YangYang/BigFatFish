import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, statSync, writeFileSync, chmodSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { dataRoot, paths, preparePaths } from './paths.js';
import { migrate, migrations, openDatabase } from './storage/database.js';
import { createLogger, readLogs, redact } from './logger.js';
import { acquireInstance } from './instance.js';
import { createServer } from './server.js';
const roots: string[] = [];
const temp = () => { const p = paths(mkdtempSync(join(tmpdir(), 'bigfatfish unit '))); roots.push(p.root); preparePaths(p); return p; };
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
describe('data boundary', () => {
  it('selects explicit, environment, and platform paths in priority order', () => {
    expect(dataRoot('/explicit', { BIGFATFISH_DATA_DIR: '/env' })).toBe(resolve('/explicit'));
    expect(dataRoot(undefined, { BIGFATFISH_DATA_DIR: '/env' })).toBe(resolve('/env'));
    expect(dataRoot(undefined, {}, 'darwin', '/home')).toBe(join('/home', 'Library', 'Application Support', 'BigFatFish'));
    expect(dataRoot(undefined, { XDG_DATA_HOME: '/xdg' }, 'linux', '/home')).toBe(join('/xdg', 'bigfatfish'));
    expect(dataRoot(undefined, { LOCALAPPDATA: '/local' }, 'win32', '/home')).toBe(join('/local', 'BigFatFish'));
    expect(() => dataRoot(' ')).toThrow('EMPTY_DATA_DIR');
  });
  it.skipIf(process.platform === 'win32')('restricts permissions and rejects redirected sensitive files', () => {
    const p = temp();
    expect(statSync(p.root).mode & 0o777).toBe(0o700);
    expect(statSync(p.database).mode & 0o777).toBe(0o600);
    rmSync(p.log); symlinkSync(p.database, p.log);
    expect(() => preparePaths(p)).toThrow('UNSAFE_DATA_PATH');
  });
});
describe('persistence and single instance', () => {
  it('persists configuration across reopening and records migration once', () => {
    const p = temp(); const db = openDatabase(p.database);
    db.prepare('INSERT INTO settings VALUES (?,?)').run('example', 'persisted'); db.close();
    const reopened = openDatabase(p.database);
    expect(reopened.prepare('SELECT value FROM settings WHERE key=?').get('example')?.value).toBe('persisted');
    expect(reopened.prepare('SELECT count(*) AS n FROM schema_migrations').get()?.n).toBe(1); reopened.close();
  });
  it('rolls back failed migrations and rejects newer databases without modifying version', () => {
    const db = new DatabaseSync(':memory:');
    expect(() => migrate(db, [migrations[0]!, 'INVALID SQL'])).toThrow();
    expect(db.prepare('PRAGMA user_version').get()?.user_version).toBe(0);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).toHaveLength(0);
    db.exec('PRAGMA user_version=99'); expect(() => migrate(db)).toThrow('DATABASE_VERSION_TOO_NEW');
    expect(db.prepare('PRAGMA user_version').get()?.user_version).toBe(99); db.close();
  });
  it('holds an exclusive lock until explicitly released', () => {
    const p = temp(); const release = acquireInstance(p.lock);
    expect(() => acquireInstance(p.lock)).toThrow('ALREADY_RUNNING'); release();
    const again = acquireInstance(p.lock); again();
  });
});
describe('local API boundary', () => {
  it('requires bearer auth, rejects cross-site and forged hosts, validates input, and limits logs', async () => {
    const p = temp(); const log = createLogger(p.log); log('hello');
    const app = createServer(p, { version: 1, pid: 1, port: 9999, token: 'a'.repeat(64), instanceId: 'test', startedAt: new Date().toISOString() }, () => {});
    const headers = { host: '127.0.0.1:9999', authorization: `Bearer ${'a'.repeat(64)}` };
    try {
      expect((await app.inject({ url: '/health', headers: { host: headers.host } })).json()).toEqual({ status: 'ok' });
      for (const url of ['/v1/status', '/v1/logs', '/unknown']) expect((await app.inject({ url, headers: { host: headers.host } })).statusCode).toBe(401);
      expect((await app.inject({ url: '/v1/status', headers: { ...headers, authorization: 'Bearer wrong' } })).statusCode).toBe(401);
      expect((await app.inject({ url: '/health', headers: { ...headers, origin: 'https://evil.example' } })).statusCode).toBe(403);
      expect((await app.inject({ url: '/v1/status', headers: { ...headers, host: 'evil.example' } })).statusCode).toBe(403);
      expect((await app.inject({ url: '/v1/status', headers: { ...headers, 'sec-fetch-site': 'cross-site' } })).statusCode).toBe(403);
      expect((await app.inject({ url: '/v1/status', headers })).statusCode).toBe(200);
      for (const url of ['/v1/logs?lines=201', '/v1/logs?lines=nope', '/v1/logs?extra=1']) expect((await app.inject({ url, headers })).statusCode).toBe(400);
      expect((await app.inject({ url: '/v1/shutdown', method: 'POST', headers, payload: { extra: 1 } })).statusCode).toBe(400);
      expect((await app.inject({ url: '/v1/logs?lines=1', headers })).json().lines).toHaveLength(1);
    } finally { await app.close(); }
  });
  it('redacts sensitive keys and bearer values and caps log reads', () => {
    const p = temp(); const log = createLogger(p.log);
    log('example', { nested: { apiKey: 'hidden123' }, detail: 'Bearer secret123 token=secret456' });
    const content = readFileSync(p.log, 'utf8');
    expect(content).not.toContain('hidden123'); expect(content).not.toContain('secret123'); expect(content).not.toContain('secret456');
    expect(redact({ password: 'x' })).toEqual({ password: '[REDACTED]' });
    writeFileSync(p.log, 'line\n'.repeat(100000)); expect(readLogs(p.log, 3)).toHaveLength(3);
    chmodSync(p.log, 0o600);
  });
});
