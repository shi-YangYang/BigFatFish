import { lstatSync, readFileSync, statSync } from 'node:fs';
import { assertRegular, type DataPaths } from './paths.js';
import { windowsAcl } from './windows-acl.js';
export interface Connection { version: 1; pid: number; port: number; token: string; instanceId: string; startedAt: string }
export interface RuntimeStatus { state: 'running'; pid: number; instanceId: string; startedAt: string; uptimeSeconds: number; schemaVersion: number }
export function readConnection(p: DataPaths): Connection {
  assertRegular(p.root, true);
  assertRegular(p.runtime, true);
  assertRegular(p.connection);
  const stat = statSync(p.connection);
  if (process.platform !== 'win32' && (stat.mode & 0o077)) throw new Error('INSECURE_CONNECTION_FILE');
  if (process.platform === 'win32') {
    try {
      windowsAcl('verify', [
        { path: p.root, directory: true }, { path: p.runtime, directory: true }, { path: p.connection, directory: false },
      ]);
    } catch (error) {
      // Shutdown can unlink the connection while PowerShell starts or reads its ACL.
      // Only a confirmed absence has ENOENT semantics; keep explicit security refusals.
      if (error instanceof Error && error.message === 'WINDOWS_ACL_UNSAFE' && error.cause instanceof Error
          && ['WINDOWS_ACL_PATH_CHECK', 'WINDOWS_ACL_ACL_READ'].includes(error.cause.message)) {
        try { lstatSync(p.connection); }
        catch (missing) { if ((missing as NodeJS.ErrnoException).code === 'ENOENT') throw missing; }
      }
      throw error;
    }
  }
  const value = JSON.parse(readFileSync(p.connection, 'utf8')) as Connection;
  if (value.version !== 1 || !Number.isInteger(value.port) || value.port < 1 || value.port > 65535 || !Number.isInteger(value.pid) || typeof value.token !== 'string' || !/^[a-f0-9]{64}$/.test(value.token) || typeof value.instanceId !== 'string') throw new Error('INVALID_CONNECTION_FILE');
  return value;
}
export async function requestRuntime<T>(connection: Connection, route: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`http://127.0.0.1:${connection.port}${route}`, {
    method, headers: { authorization: `Bearer ${connection.token}`, ...(['POST','PUT'].includes(method) ? { 'content-type': 'application/json' } : {}) },
    ...(['POST','PUT'].includes(method) ? { body: JSON.stringify(body ?? {}) } : {}), signal: AbortSignal.timeout(route==='/v1/channels/qq/send'?50000:(route.startsWith('/v1/media')||route.startsWith('/v1/plugins')||route.startsWith('/v1/bilibili')) ? 190000 : (route==='/v1/douyin'||route==='/v1/douyin/close'||route==='/v1/activities/pause')?30000:2500), redirect: 'error',
  });
  if (!response.ok) { const value = await response.json().catch(() => ({})) as { error?: string }; throw new Error(value.error && /^[A-Z][A-Z0-9_]+$/.test(value.error) ? value.error : `RUNTIME_HTTP_${response.status}`); }
  return await response.json() as T;
}
export async function getStatus(p: DataPaths): Promise<RuntimeStatus> {
  const connection = readConnection(p);
  const status = await requestRuntime<RuntimeStatus>(connection, '/v1/status');
  if (status.instanceId !== connection.instanceId) throw new Error('INSTANCE_MISMATCH');
  return status;
}
