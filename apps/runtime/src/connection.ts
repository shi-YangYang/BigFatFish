import { readFileSync, statSync } from 'node:fs';
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
  if (process.platform === 'win32') windowsAcl('verify', [
    { path: p.root, directory: true }, { path: p.runtime, directory: true }, { path: p.connection, directory: false },
  ]);
  const value = JSON.parse(readFileSync(p.connection, 'utf8')) as Connection;
  if (value.version !== 1 || !Number.isInteger(value.port) || value.port < 1 || value.port > 65535 || !Number.isInteger(value.pid) || typeof value.token !== 'string' || !/^[a-f0-9]{64}$/.test(value.token) || typeof value.instanceId !== 'string') throw new Error('INVALID_CONNECTION_FILE');
  return value;
}
export async function requestRuntime<T>(connection: Connection, route: string, method = 'GET'): Promise<T> {
  const response = await fetch(`http://127.0.0.1:${connection.port}${route}`, {
    method, headers: { authorization: `Bearer ${connection.token}`, ...(method === 'POST' ? { 'content-type': 'application/json' } : {}) },
    ...(method === 'POST' ? { body: '{}' } : {}), signal: AbortSignal.timeout(2500), redirect: 'error',
  });
  if (!response.ok) throw new Error(`RUNTIME_HTTP_${response.status}`);
  return await response.json() as T;
}
export async function getStatus(p: DataPaths): Promise<RuntimeStatus> {
  const connection = readConnection(p);
  const status = await requestRuntime<RuntimeStatus>(connection, '/v1/status');
  if (status.instanceId !== connection.instanceId) throw new Error('INSTANCE_MISMATCH');
  return status;
}
