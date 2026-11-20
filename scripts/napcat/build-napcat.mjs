import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root, sha256, inventory, verifySource } from './napcat-source.mjs';
const source = verifySource(), out = join(root, 'build/napcat');
const toolRoot = join(root, 'scripts/napcat/tools'), runtimeRoot = join(root, 'scripts/napcat/runtime');
const inputs = ['scripts/napcat/build-napcat.mjs', 'scripts/napcat/napcat-source.mjs', 'third_party/napcat-source.json',
  'scripts/napcat/tools/package-lock.json', 'scripts/napcat/runtime/package-lock.json'];
const key = sha256(Buffer.concat(inputs.map(path => readFileSync(join(root, path)))));
function validCache() {
  try {
    const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
    if (manifest.buildKey !== key) return false;
    const files = inventory(out); delete files['manifest.json'];
    return JSON.stringify(files) === JSON.stringify(manifest.files);
  } catch { return false; }
}
function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' && command.endsWith('.cmd'),
    env: { ...process.env, NAPCAT_VERSION: source.version, CI: '1' } });
}
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
if (!validCache()) {
  run(npm, ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], toolRoot);
  const work = join(root, 'build/napcat-work');
  // Upstream build plugins generate files in source directories. Never run them in third_party.
  rmSync(work, { recursive: true, force: true }); mkdirSync(work, { recursive: true });
  cpSync(join(root, 'third_party/napcat'), work, { recursive: true });
  const pnpm = join(toolRoot, 'node_modules/pnpm/bin/pnpm.cjs');
  run(process.execPath, [pnpm, 'install', '--frozen-lockfile', '--ignore-scripts'], work);
  for (const name of ['napcat-webui-frontend', 'napcat-shell', 'napcat-plugin-builtin'])
    run(process.execPath, [pnpm, '--filter', name, 'run', 'build'], work);
  const staging = `${out}-staging`; rmSync(staging, { recursive: true, force: true }); mkdirSync(staging, { recursive: true });
  cpSync(join(work, 'packages/napcat-shell/dist'), join(staging, 'shell'), { recursive: true });
  // Do not ship upstream's default config or plugins over user-managed data.
  rmSync(join(staging, 'shell/config'), { recursive: true, force: true });
  cpSync(join(work, 'packages/napcat-plugin-builtin/dist'), join(staging, 'builtin-plugin'), { recursive: true });
  for (const name of ['package.json', 'package-lock.json']) cpSync(join(runtimeRoot, name), join(staging, 'shell', name));
  run(npm, ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], join(staging, 'shell'));
  for (const path of ['LICENSE', 'packages/napcat-dpapi/LICENSE', 'packages/napcat-webui-frontend/LICENSE']) {
    const destination = join(staging, 'licenses', path); mkdirSync(join(destination, '..'), { recursive: true });
    cpSync(join(work, path), destination);
  }
  cpSync(join(root, 'third_party/napcat-source.json'), join(staging, 'source.json'));
  for (const required of ['shell/napcat.mjs', 'shell/loadNapCat.js', 'shell/static/index.html', 'builtin-plugin/index.mjs'])
    if (!existsSync(join(staging, required))) throw new Error(`NAPCAT_BUILD_INCOMPLETE: ${required}`);
  const files = inventory(staging);
  writeFileSync(join(staging, 'manifest.json'), JSON.stringify({ schema: 1, version: source.version, commit: source.commit,
    buildKey: key, node: process.version, pnpm: '9.15.9', files }, null, 2) + '\n');
  rmSync(out, { recursive: true, force: true }); renameSync(staging, out);
  console.log(`Built NapCat ${source.version} from ${source.commit}`);
} else console.log(`Using verified NapCat build ${key}`);
if (process.argv.includes('--copy-runtime')) {
  const destination = join(root, 'dist/runtime/src/channels/managed/napcat');
  rmSync(destination, { recursive: true, force: true }); cpSync(out, destination, { recursive: true });
  console.log(`Prepared Runtime NapCat: ${destination}`);
}
