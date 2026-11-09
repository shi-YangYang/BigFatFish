import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { lstatSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { paths, preparePaths, privateFile } from './paths.js';
import { readConnection } from './connection.js';
import { windowsAcl, type AclEntry } from './windows-acl.js';
vi.mock('node:child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, execFileSync: vi.fn(actual.execFileSync) };
});
const roots: string[] = [];
const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
afterEach(() => {
  Object.defineProperty(process, 'platform', platform); vi.unstubAllEnvs(); vi.mocked(execFileSync).mockReset();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function powershell(script: string, input: unknown) {
  // Match hidden production processes: decode stdin without a console/code page.
  script = `$ErrorActionPreference = 'Stop'
[Console]::SetIn([System.IO.StreamReader]::new([Console]::OpenStandardInput(), [System.Text.UTF8Encoding]::new($false, $true), $false))
$readSections = [System.Security.AccessControl.AccessControlSections]'Access, Owner, Group'
function Read-TestAcl([string]$path, [bool]$directory) {
  if ($directory) { [System.IO.Directory]::GetAccessControl($path, $readSections) }
  else { [System.IO.File]::GetAccessControl($path, $readSections) }
}
` + script;
  return execFileSync(join(process.env.SystemRoot!, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    { input: JSON.stringify(input), encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
}
function widen(entries: AclEntry[]) {
  powershell(`$ErrorActionPreference = 'Stop'
$entries = [Console]::In.ReadToEnd() | ConvertFrom-Json
foreach ($entry in $entries) {
  $acl = Read-TestAcl $entry.path $entry.directory
  $acl.SetAccessRuleProtection($true, $false)
  foreach ($sid in @('S-1-1-0', 'S-1-5-32-545')) {
    $inherit = [System.Security.AccessControl.InheritanceFlags]::None
    if ($entry.directory) { $inherit = [System.Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit' }
    $acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new(
      [System.Security.Principal.SecurityIdentifier]::new($sid),
      [System.Security.AccessControl.FileSystemRights]::FullControl, $inherit,
      [System.Security.AccessControl.PropagationFlags]::None, [System.Security.AccessControl.AccessControlType]::Allow))
  }
  if ($entry.directory) { [System.IO.Directory]::SetAccessControl($entry.path, $acl) }
  else { [System.IO.File]::SetAccessControl($entry.path, $acl) }
}`, entries);
}
// These check the child-process protocol, not Windows ACL semantics.
describe('Windows ACL process protocol', () => {
  function pretendWindows() {
    Object.defineProperty(process, 'platform', { ...platform, value: 'win32' });
    vi.stubEnv('SystemRoot', 'C:\\Windows');
  }
  it('passes Unicode and shell-looking paths only through UTF-8 stdin to the hidden process', () => {
    pretendWindows(); vi.mocked(execFileSync).mockReturnValueOnce('OK');
    const entries = [{ path: "C:\\私有目录\\fish ' $() [1]", directory: true }];
    windowsAcl('restrict', entries);
    const [, args, options] = vi.mocked(execFileSync).mock.calls.at(-1)!;
    expect(args).not.toContain(entries[0]!.path);
    expect(options).toMatchObject({ input: JSON.stringify({ operation: 'restrict', entries }), encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const script = Buffer.from((args as string[]).at(-1)!, 'base64').toString('utf16le');
    expect(script).toContain('[Console]::OpenStandardInput()');
    expect(script).not.toContain('[Console]::InputEncoding =');
    expect(script).not.toMatch(/\bGet-Acl\b/);
  });
  it.each([
    ['WINDOWS_ACL_UNSAFE:ACL_WRITE', 'ACL_WRITE'],
    ['WINDOWS_ACL_UNSAFE:UNSAFE_OWNER', 'UNSAFE_OWNER'],
    ['WINDOWS_ACL_UNSAFE:SECRET_ACCOUNT', 'EXECUTION_FAILED'],
    ['WINDOWS_ACL_UNSAFE:ACL_READ\nC:\\private\\token', 'EXECUTION_FAILED'],
  ])('accepts only bounded failure reasons from stdout (%s)', (stdout, reason) => {
    pretendWindows();
    vi.mocked(execFileSync).mockImplementationOnce(() => { throw Object.assign(new Error('secret account/path'), { stdout, stderr: 'secret stderr' }); });
    try { windowsAcl('verify', []); throw new Error('expected rejection'); }
    catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('WINDOWS_ACL_UNSAFE');
      expect((error as Error).cause).toEqual(new Error(`WINDOWS_ACL_${reason}`));
      expect(JSON.stringify(error)).not.toContain('secret');
    }
  });
  it('fails closed for malformed success, timeouts and a missing SystemRoot', () => {
    pretendWindows(); vi.mocked(execFileSync).mockReturnValueOnce('OK\nextra');
    expect(() => windowsAcl('verify', [])).toThrow(expect.objectContaining({ message: 'WINDOWS_ACL_UNSAFE', cause: new Error('WINDOWS_ACL_INVALID_RESPONSE') }));
    vi.mocked(execFileSync).mockImplementationOnce(() => { throw Object.assign(new Error('secret'), { code: 'ETIMEDOUT' }); });
    expect(() => windowsAcl('verify', [])).toThrow(expect.objectContaining({ cause: new Error('WINDOWS_ACL_TIMEOUT') }));
    vi.stubEnv('SystemRoot', '');
    expect(() => windowsAcl('verify', [])).toThrow(expect.objectContaining({ cause: new Error('WINDOWS_ACL_SYSTEM_ROOT_MISSING') }));
  });
  function connectionFixture() {
    const root = mkdtempSync(join(tmpdir(), 'bff connection ACL race ')); roots.push(root);
    const p = paths(root); preparePaths(p);
    privateFile(p.connection);
    writeFileSync(p.connection, JSON.stringify({ version: 1, pid: 1, port: 12345, token: 'a'.repeat(64), instanceId: 'race', startedAt: new Date().toISOString() }));
    pretendWindows();
    return p;
  }
  it.each(['PATH_CHECK', 'ACL_READ'])('reports ENOENT when the connection disappears during ACL %s', reason => {
    const p = connectionFixture();
    vi.mocked(execFileSync).mockImplementationOnce(() => {
      unlinkSync(p.connection);
      throw Object.assign(new Error('fixture failure'), { stdout: `WINDOWS_ACL_UNSAFE:${reason}` });
    });
    expect(() => readConnection(p)).toThrow(expect.objectContaining({ code: 'ENOENT' }));
  });
  it.each(['PATH_CHECK', 'ACL_READ'])('preserves ACL %s when the connection still exists', reason => {
    const p = connectionFixture();
    vi.mocked(execFileSync).mockImplementationOnce(() => { throw Object.assign(new Error('fixture failure'), { stdout: `WINDOWS_ACL_UNSAFE:${reason}` }); });
    expect(() => readConnection(p)).toThrow(expect.objectContaining({ message: 'WINDOWS_ACL_UNSAFE', cause: new Error(`WINDOWS_ACL_${reason}`) }));
    expect(lstatSync(p.connection).isFile()).toBe(true);
  });
  it.each(['UNSAFE_OWNER', 'UNSAFE_DACL', 'REPARSE_POINT', 'UNSAFE_INHERITANCE', 'UNPROTECTED_DIRECTORY', 'WRONG_PATH_TYPE'])('preserves explicit ACL %s even if the connection disappears', reason => {
    const p = connectionFixture();
    vi.mocked(execFileSync).mockImplementationOnce(() => {
      unlinkSync(p.connection);
      throw Object.assign(new Error('fixture failure'), { stdout: `WINDOWS_ACL_UNSAFE:${reason}` });
    });
    expect(() => readConnection(p)).toThrow(expect.objectContaining({ message: 'WINDOWS_ACL_UNSAFE', cause: new Error(`WINDOWS_ACL_${reason}`) }));
  });
  it('preserves ACL failure when the connection becomes a dangling link', () => {
    const p = connectionFixture();
    vi.mocked(execFileSync).mockImplementationOnce(() => {
      unlinkSync(p.connection);
      // A directory junction needs no symlink privilege on Windows; neither kind may be treated as absence.
      symlinkSync(join(p.root, 'missing-target'), p.connection, 'junction');
      expect(lstatSync(p.connection).isSymbolicLink()).toBe(true);
      expect(() => statSync(p.connection)).toThrow(expect.objectContaining({ code: 'ENOENT' }));
      throw Object.assign(new Error('fixture failure'), { stdout: 'WINDOWS_ACL_UNSAFE:PATH_CHECK' });
    });
    expect(() => readConnection(p)).toThrow(expect.objectContaining({ message: 'WINDOWS_ACL_UNSAFE', cause: new Error('WINDOWS_ACL_PATH_CHECK') }));
  });
});
// These exercise real Windows ACLs on Windows CI, never a mocked platform/mode bit.
describe.skipIf(process.platform !== 'win32')('Windows DACL boundary', () => {
  it('restricts and verifies actual ACLs when Security cmdlets are unavailable', () => {
    const root = mkdtempSync(join(tmpdir(), 'bff ACL no Security module ')); roots.push(root);
    const file = join(root, 'credential.json'); writeFileSync(file, 'isolated fixture');
    const entries = [{ path: root, directory: true }, { path: file, directory: false }];
    const script = `function Get-Acl { throw 'SECURITY_CMDLET_UNAVAILABLE' }
function Set-Acl { throw 'SECURITY_CMDLET_UNAVAILABLE' }
` + readFileSync(new URL('./windows-acl.ps1', import.meta.url), 'utf8');
    expect(powershell(script, { operation: 'restrict', entries })).toBe('OK');
    expect(powershell(script, { operation: 'verify', entries })).toBe('OK');
    widen(entries);
    expect(() => powershell(script, { operation: 'verify', entries })).toThrow('WINDOWS_ACL_UNSAFE');
  });
  it('restricts a Unicode path from hidden PowerShell repeatedly without changing owner or group', () => {
    const root = mkdtempSync(join(tmpdir(), "bff ACL 中文 ' $() [1] ")); roots.push(root);
    const file = join(root, 'credential.json'); writeFileSync(file, 'isolated fixture');
    const entries = [{ path: root, directory: true }, { path: file, directory: false }];
    const identities = `$entries = [Console]::In.ReadToEnd() | ConvertFrom-Json
@($entries | ForEach-Object { $acl = Read-TestAcl $_.path $_.directory; $acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value; $acl.GetGroup([System.Security.Principal.SecurityIdentifier]).Value }) | ConvertTo-Json -Compress`;
    const before = powershell(identities, entries);
    const identitySids = JSON.parse(before) as string[];
    expect(identitySids).toHaveLength(entries.length * 2);
    for (const sid of identitySids) expect(sid).toMatch(/^S-1-\d+(?:-\d+)+$/);
    for (let i = 0; i < 2; i++) { windowsAcl('restrict', entries); windowsAcl('verify', entries); }
    expect(powershell(identities, entries)).toBe(before);
    expect(readFileSync(file, 'utf8')).toBe('isolated fixture');
  });
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
    const inspect = `$path = [Console]::In.ReadToEnd() | ConvertFrom-Json
[Console]::Out.Write((Read-TestAcl $path $false).GetSecurityDescriptorSddlForm($readSections))`;
    const originalAcl = powershell(inspect, unrelated);
    expect(originalAcl).toMatch(/^O:.+G:.+D:/);
    preparePaths(p);
    windowsAcl('verify', entries);
    // Independently inspect ACE SIDs instead of relying only on the production verifier.
    const aclSummary = powershell(`$entries = [Console]::In.ReadToEnd() | ConvertFrom-Json
@($entries | ForEach-Object { (Read-TestAcl $_.path $_.directory).GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]) | ForEach-Object { $_.IdentityReference.Value } }) | ConvertTo-Json -Compress`, entries);
    expect(JSON.parse(aclSummary).length).toBeGreaterThan(0);
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
    const inspectDirectory = '$path = [Console]::In.ReadToEnd() | ConvertFrom-Json\n[Console]::Out.Write((Read-TestAcl $path $true).GetSecurityDescriptorSddlForm($readSections))';
    const before = powershell(inspectDirectory, external);
    expect(before).toMatch(/^O:.+G:.+D:/);
    rmSync(p.runtime, { recursive: true });
    powershell(`$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
New-Item -ItemType Junction -Path $request.link -Target $request.target | Out-Null`, { link: p.runtime, target: external });
    expect(() => preparePaths(p)).toThrow('UNSAFE_DATA_PATH');
    expect(powershell(inspectDirectory, external)).toBe(before);
  });
});
