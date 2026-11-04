import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, realpath } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const exec = promisify(execFile);

export async function withTimeout(promise, milliseconds, fallback) {
  let timer;
  try { return await Promise.race([promise, new Promise(resolve => { timer = setTimeout(() => resolve(fallback), milliseconds); })]); }
  finally { clearTimeout(timer); }
}

export function launch(command, args, options = {}) {
  const child = spawn(command, args, { stdio: 'inherit', windowsHide: true, ...options });
  const exited = new Promise(resolveExit => {
    child.once('error', error => resolveExit({ error }));
    child.once('exit', (code, signal) => resolveExit({ code, signal }));
  });
  return { child, exited };
}

// Only signal the process/group created by this supervisor, never a process-name match.
export async function terminateProcess(handle, group = false) {
  if (!handle) return;
  const { child, exited } = handle;
  if (!child.pid) return;
  if (process.platform === 'win32') {
    if (child.exitCode !== null || child.signalCode !== null) return;
    // Windows has no POSIX group signals. /T is bounded to this owned child tree.
    await exec('taskkill.exe', ['/PID', String(child.pid), '/T', '/F']).catch(error => {
      if (child.exitCode === null && child.signalCode === null) throw error;
    });
  } else {
    const send = signal => {
      try { process.kill(group ? -child.pid : child.pid, signal); }
      catch (error) { if (error.code !== 'ESRCH') throw error; }
    };
    if (group || (child.exitCode === null && child.signalCode === null)) send('SIGTERM');
    const outcome = await withTimeout(exited, 4000, null);
    if (!outcome) send('SIGKILL');
    // A CLI may exit before its descendants. The dedicated group is still ours.
    if (group) send('SIGKILL');
  }
  if (!await withTimeout(exited, 4000, null)) throw new Error('DEV_CHILD_STOP_TIMEOUT');
}

export function knownRuntimeEntries(root) {
  return [
    'dist/runtime/src/main.js',
    'apps/desktop/src-tauri/target/debug/runtime/dist/runtime/src/main.js',
    'build/portable/dist/runtime/src/main.js',
  ].map(path => resolve(root, path));
}

// macOS ps renders argv joined by spaces; compare the full executable+entry prefix,
// with an argument boundary, rather than searching for a repository substring.
export function commandMatchesEntry(command, executable, entry, platform) {
  if (platform === 'win32') {
    const quoted = value => value.includes(' ') ? `"${value}"` : value;
    const prefixes = [`${quoted(executable)} ${quoted(entry)}`, `"${executable}" "${entry}"`, `"${executable}" ${quoted(entry)}`];
    return prefixes.some(prefix => command.toLowerCase().startsWith(`${prefix.toLowerCase()} --data-dir `));
  }
  return command.startsWith(`${executable} ${entry} --data-dir `);
}

export async function isProjectRuntime(pid, root) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  const entries = knownRuntimeEntries(root);
  try {
    if (process.platform === 'linux') {
      const argv = (await readFile(`/proc/${pid}/cmdline`, 'utf8')).split('\0');
      return entries.includes(argv[1]) && argv[2] === '--data-dir';
    }
    if (process.platform === 'win32') {
      const { stdout } = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        `Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}" | Select-Object ExecutablePath,CommandLine | ConvertTo-Json -Compress`]);
      const value = JSON.parse(stdout);
      return typeof value.ExecutablePath === 'string' && entries.some(entry => commandMatchesEntry(value.CommandLine ?? '', value.ExecutablePath, entry, 'win32'));
    }
    const [{ stdout: executable }, { stdout: command }] = await Promise.all([
      exec('ps', ['-p', String(pid), '-o', 'comm=']),
      exec('ps', ['-ww', '-p', String(pid), '-o', 'args=']),
    ]);
    // ps may spell a symlink differently; accept both verified executable spellings.
    const name = executable.trim();
    const canonical = await realpath(name).catch(() => name);
    return entries.some(entry => [name, canonical].some(exe => commandMatchesEntry(command.trim(), exe, entry, 'darwin')));
  } catch { return false; }
}

// Windows CreateProcess quoting (not shell quoting); all arguments are data.
export function windowsCommandLine(values) {
  return values.map(value => '"' + value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1') + '"').join(' ');
}
export function launchWindowsJob(root, command, args, options) {
  const payload = Buffer.from(JSON.stringify({ executable: command, command: windowsCommandLine([command, ...args]), cwd: options.cwd })).toString('base64');
  if (!process.env.SystemRoot) throw new Error('DEV_WINDOWS_SYSTEM_ROOT_MISSING');
  const script = readFileSync(resolve(root, 'scripts/desktop-dev-windows.ps1'), 'utf8');
  const powershell = resolve(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe');
  return launch(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    { ...options, env: { ...options.env, BIGFATFISH_DEV_WINDOWS_LAUNCH: payload } });
}
