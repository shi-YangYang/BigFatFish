import { appendFileSync, existsSync, readFileSync, renameSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { assertRegular } from './paths.js';
const sensitive = /token|secret|password|authorization|cookie|api.?key/i;
export function redact(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]').replace(/((?:token|api[_-]?key|password|secret)\s*[=:]\s*)[^\s&,"']+/gi, '$1[REDACTED]');
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sensitive.test(key) ? '[REDACTED]' : redact(item)]));
  return value;
}
export function createLogger(file: string) {
  return (event: string, fields: Record<string, unknown> = {}) => {
    assertRegular(file);
    if (existsSync(file) && statSync(file).size > 2 * 1024 * 1024) renameSync(file, `${file}.1`);
    appendFileSync(file, JSON.stringify(redact({ at: new Date().toISOString(), event, ...fields })) + '\n', { mode: 0o600 });
  };
}
export function readLogs(file: string, lines: number): string[] {
  assertRegular(file);
  if (!existsSync(file)) return [];
  // Bound I/O and response size even if a previous run left an oversized log.
  const size = statSync(file).size;
  if (size <= 262144) return readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).slice(-lines);
  const fd = openSync(file, 'r');
  try {
    const bytes = Buffer.alloc(262144);
    readSync(fd, bytes, 0, bytes.length, size - bytes.length);
    return bytes.toString('utf8').split('\n').slice(1).filter(Boolean).slice(-lines);
  } finally { closeSync(fd); }
}
