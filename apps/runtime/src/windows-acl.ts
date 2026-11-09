import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface AclEntry { path: string; directory: boolean }
const scriptReasons = new Set([
  'INPUT_READ', 'IDENTITY', 'PATH_CHECK', 'ACL_READ', 'ACL_WRITE', 'ACL_VERIFY',
  'INVALID_OPERATION', 'REPARSE_POINT', 'WRONG_PATH_TYPE', 'UNSAFE_OWNER',
  'UNSAFE_DACL', 'UNSAFE_INHERITANCE', 'UNPROTECTED_DIRECTORY',
]);
export function windowsAcl(operation: 'restrict' | 'verify', entries: AclEntry[]) {
  if (process.platform !== 'win32') throw new Error('WINDOWS_ACL_UNSUPPORTED');
  let reason = 'SCRIPT_READ';
  try {
    const script = readFileSync(new URL('./windows-acl.ps1', import.meta.url), 'utf8');
    reason = 'SYSTEM_ROOT_MISSING';
    const systemRoot = process.env.SystemRoot;
    if (!systemRoot) throw new Error('SYSTEM_ROOT_MISSING');
    reason = 'EXECUTION_FAILED';
    const result = execFileSync(join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
      { input: JSON.stringify({ operation, entries }), encoding: 'utf8', windowsHide: true, timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] });
    if (result !== 'OK') { reason = 'INVALID_RESPONSE'; throw new Error('ACL_NOT_VERIFIED'); }
  } catch (error) {
    // Only our bounded protocol can contribute diagnostics, never native stderr
    // or Error.cause (both may contain data paths or account identities).
    if (reason === 'EXECUTION_FAILED' && error && typeof error === 'object') {
      if ('code' in error && error.code === 'ETIMEDOUT') reason = 'TIMEOUT';
      else if ('stdout' in error && typeof error.stdout === 'string') {
        const match = /^WINDOWS_ACL_UNSAFE:([A-Z_]+)$/.exec(error.stdout);
        if (match?.[1] && scriptReasons.has(match[1])) reason = match[1];
      }
    }
    throw new Error('WINDOWS_ACL_UNSAFE', { cause: new Error(`WINDOWS_ACL_${reason}`) });
  }
}
