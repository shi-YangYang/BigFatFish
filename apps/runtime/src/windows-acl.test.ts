import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { paths, preparePaths, privateFile } from './paths.js';
import { readConnection } from './connection.js';
import { windowsAcl, type AclEntry } from './windows-acl.js';
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function powershell(script: string, input: unknown) {
  return execFileSync(join(process.env.SystemRoot!, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    { input: JSON.stringify(input), encoding: 'utf8', windowsHide: true });
}
function widen(entries: AclEntry[]) {
  powershell(`$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$entries = [Console]::In.ReadToEnd() | ConvertFrom-Json
foreach ($entry in $entries) {
  $acl = Get-Acl -LiteralPath $entry.path
  $acl.SetAccessRuleProtection($true, $false)
  foreach ($sid in @('S-1-1-0', 'S-1-5-32-545')) {
    $inherit = [System.Security.AccessControl.InheritanceFlags]::None
    if ($entry.directory) { $inherit = [System.Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit' }
    $acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new(
      [System.Security.Principal.SecurityIdentifier]::new($sid),
      [System.Security.AccessControl.FileSystemRights]::FullControl, $inherit,
      [System.Security.AccessControl.PropagationFlags]::None, [System.Security.AccessControl.AccessControlType]::Allow))
  }
  Set-Acl -LiteralPath $entry.path -AclObject $acl
}`, entries);
}
// These exercise real Windows ACLs on Windows CI, never a mocked platform/mode bit.
describe.skipIf(process.platform !== 'win32')('Windows DACL boundary', () => {
  it('removes explicit broad ACEs, repairs protected product files, and rejects unsafe reads', () => {
    const root = mkdtempSync(join(tmpdir(), "bigfatfish ACL 中文 ' $() ")); roots.push(root);
    const p = paths(root); preparePaths(p);
    const value = { version: 1, pid: 1, port: 12345, token: 'a'.repeat(64), instanceId: 'acl-test', startedAt: new Date().toISOString() };
    writeFileSync(p.connection, JSON.stringify(value)); privateFile(p.connection);
    const sidecar = `${p.database}-wal`; writeFileSync(sidecar, 'existing sidecar');
    const entries = [
      ...[p.root, p.config, p.data, p.runtime, p.logs].map(path => ({ path, directory: true })),
      ...[p.database, p.lock, p.log, p.connection, sidecar].map(path => ({ path, directory: false })),
    ];
    widen(entries);
    expect(() => windowsAcl('verify', entries)).toThrow('WINDOWS_ACL_UNSAFE');
    expect(() => readConnection(p)).toThrow('WINDOWS_ACL_UNSAFE');
    // A protected unrelated sibling file must not be changed by preparePaths.
    const unrelated = join(root, 'user-owned.txt'); writeFileSync(unrelated, 'keep');
    widen([{ path: unrelated, directory: false }]);
    const inspect = `[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$path = [Console]::In.ReadToEnd() | ConvertFrom-Json
[Console]::Out.Write((Get-Acl -LiteralPath $path).Sddl)`;
    const originalAcl = powershell(inspect, unrelated);
    preparePaths(p);
    windowsAcl('verify', entries);
    // Independently inspect ACE SIDs instead of relying only on the production verifier.
    const aclSummary = powershell(`[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$entries = [Console]::In.ReadToEnd() | ConvertFrom-Json
@($entries | ForEach-Object { (Get-Acl -LiteralPath $_.path).GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]) | ForEach-Object { $_.IdentityReference.Value } }) | ConvertTo-Json -Compress`, entries);
    expect(aclSummary).not.toContain('S-1-1-0'); expect(aclSummary).not.toContain('S-1-5-32-545');
    expect(readConnection(p)).toEqual(value);
    expect(readFileSync(sidecar, 'utf8')).toBe('existing sidecar');
    expect(powershell(inspect, unrelated)).toBe(originalAcl);
    expect(readFileSync(unrelated, 'utf8')).toBe('keep');
    // A later permission change must be detected at the read boundary, without repair.
    widen([{ path: p.connection, directory: false }]);
    expect(() => readConnection(p)).toThrow('WINDOWS_ACL_UNSAFE');
  });
  it('refuses reparse points instead of changing a path outside the data directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'bigfatfish acl link ')); roots.push(root);
    const p = paths(root); preparePaths(p);
    const external = mkdtempSync(join(tmpdir(), 'bigfatfish acl target ')); roots.push(external);
    const before = powershell('[Console]::Out.Write((Get-Acl -LiteralPath ([Console]::In.ReadToEnd() | ConvertFrom-Json)).Sddl)', external);
    rmSync(p.runtime, { recursive: true });
    powershell(`$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
New-Item -ItemType Junction -Path $request.link -Target $request.target | Out-Null`, { link: p.runtime, target: external });
    expect(() => preparePaths(p)).toThrow('UNSAFE_DATA_PATH');
    expect(powershell('[Console]::Out.Write((Get-Acl -LiteralPath ([Console]::In.ReadToEnd() | ConvertFrom-Json)).Sddl)', external)).toBe(before);
  });
});
