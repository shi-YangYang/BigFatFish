import { parseArgs } from 'node:util';
export function parseOptions(args: string[]) {
  const result = parseArgs({ args, allowPositionals: true, options: { 'data-dir': { type: 'string' }, port: { type: 'string' }, json: { type: 'boolean', default: false }, lines: { type: 'string' }, help: { type: 'boolean', short: 'h', default: false } } });
  const port = Number(result.values.port ?? '0');
  const lines = Number(result.values.lines ?? '50');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('INVALID_PORT');
  if (!Number.isInteger(lines) || lines < 1 || lines > 200) throw new Error('INVALID_LINES');
  return { ...result.values, port, lines, command: result.positionals[0], positionals: result.positionals };
}
export function publicError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  // Never return raw library errors that may contain credentials or request bodies.
  if (/^[A-Z][A-Z0-9_]+$/.test(message)) return message;
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  if (code === 'EACCES' || code === 'EPERM') return 'PERMISSION_DENIED';
  if (code === 'EADDRINUSE') return 'PORT_IN_USE';
  if (code === 'ENOENT') return 'NOT_RUNNING';
  return 'RUNTIME_UNAVAILABLE';
}
