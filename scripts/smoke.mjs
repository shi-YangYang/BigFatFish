import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const root = mkdtempSync(join(tmpdir(), 'bigfatfish smoke '));
const run = command => JSON.parse(execFileSync(process.execPath, ['dist/cli/src/main.js', command, '--data-dir', root, '--json'], { encoding: 'utf8' }));
try {
  const started = run('start'); assert.equal(started.state, 'running');
  assert.equal(run('status').instanceId, started.instanceId);
  assert.equal(run('doctor').nodeSupported, true);
  assert.ok(run('logs').lines.length);
  assert.notEqual(run('restart').instanceId, started.instanceId);
  assert.equal(run('stop').state, 'stopped');
  console.log(JSON.stringify({ result: 'PASS', platform: process.platform, arch: process.arch, node: process.version, commands: ['start', 'status', 'doctor', 'logs', 'restart', 'stop'] }));
} finally { try { run('stop'); } finally { rmSync(root, { recursive: true, force: true }); } }
