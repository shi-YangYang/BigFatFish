import { copyFileSync, mkdirSync, cpSync, rmSync } from 'node:fs';
// tsc does not delete JavaScript left behind by an older installation.
for (const obsolete of ['dist/web', 'dist/runtime/src/web', 'dist/cli/src/commands/web.js', 'dist/cli/src/web.js'])
  rmSync(obsolete, { recursive: true, force: true });
copyFileSync('apps/runtime/src/permissions/windows-acl.ps1', 'dist/runtime/src/permissions/windows-acl.ps1');
mkdirSync('dist/runtime/src/memory/recall', { recursive: true });
copyFileSync('apps/runtime/src/memory/recall/bge-worker.mjs', 'dist/runtime/src/memory/recall/bge-worker.mjs');
cpSync('apps/runtime/src/memory/recall/licenses', 'dist/runtime/src/memory/recall/licenses', { recursive: true });
mkdirSync('dist/runtime/src/ai/engine', { recursive: true });
copyFileSync('apps/runtime/src/ai/engine/dsh-bridge.mjs', 'dist/runtime/src/ai/engine/dsh-bridge.mjs');
rmSync('dist/plugins/qq', {recursive:true, force:true});
rmSync('dist/runtime/src/channels/plugin.js', {force:true});

cpSync('apps/runtime/src/bilibili/adapter','dist/plugins/bilibili',{recursive:true});

cpSync('apps/runtime/src/douyin/adapter','dist/plugins/douyin',{recursive:true});
cpSync('services/douyin','dist/services/douyin',{recursive:true,filter:source=>!source.includes('__pycache__')});

// Do not distribute obsolete installable copies on an incremental build.
for (const id of ['qq','bilibili','douyin']) rmSync(`dist/runtime/plugin-catalog/${id}.bff-plugin`,{force:true});
cpSync('plugins/sdk','dist/plugin-sdk',{recursive:true});

copyFileSync('scripts/build/pack-plugin.mjs','dist/plugin-sdk/pack-plugin.mjs');
cpSync('examples/hello-fish','dist/plugin-examples/hello-fish',{recursive:true});
copyFileSync('plugins/sdk/host.mjs','dist/plugin-examples/hello-fish/host.mjs');

mkdirSync('dist/runtime/src/channels/managed',{recursive:true});
copyFileSync('apps/runtime/src/channels/managed/unzip.ps1','dist/runtime/src/channels/managed/unzip.ps1');
copyFileSync('apps/runtime/src/channels/managed/windows-job.ps1','dist/runtime/src/channels/managed/windows-job.ps1');

cpSync('apps/runtime/src/channels/stickers/assets','dist/runtime/src/channels/stickers/assets',{recursive:true});
