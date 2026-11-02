import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface AclEntry { path: string; directory: boolean }
export function windowsAcl(operation: 'restrict' | 'verify', entries: AclEntry[]) {
  if (process.platform !== 'win32') throw new Error('WINDOWS_ACL_UNSUPPORTED');
  try {
    const script = readFileSync(new URL('./windows-acl.ps1', import.meta.url), 'utf8');
    const systemRoot = process.env.SystemRoot;
    if (!systemRoot) throw new Error('SYSTEM_ROOT_MISSING');
    const result = execFileSync(join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
      { input: JSON.stringify({ operation, entries }), encoding: 'utf8', windowsHide: true, timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] });
    if (result !== 'OK') throw new Error('ACL_NOT_VERIFIED');
  } catch { throw new Error('WINDOWS_ACL_UNSAFE'); }
}
