import { copyFileSync, mkdirSync, cpSync } from 'node:fs';
copyFileSync('apps/runtime/src/windows-acl.ps1', 'dist/runtime/src/windows-acl.ps1');
mkdirSync('dist/runtime/src/memory', { recursive: true });
copyFileSync('apps/runtime/src/memory/bge-worker.mjs', 'dist/runtime/src/memory/bge-worker.mjs');
cpSync('apps/runtime/src/memory/licenses', 'dist/runtime/src/memory/licenses', { recursive: true });
mkdirSync('dist/runtime/src/ai', { recursive: true });
copyFileSync('apps/runtime/src/ai/dsh-bridge.mjs', 'dist/runtime/src/ai/dsh-bridge.mjs');
mkdirSync('dist/plugins/qq', { recursive: true });
copyFileSync('plugins/qq/index.mjs', 'dist/plugins/qq/index.mjs');

cpSync('plugins/bilibili','dist/plugins/bilibili',{recursive:true});

cpSync('plugins/douyin','dist/plugins/douyin',{recursive:true});
cpSync('services/douyin','dist/services/douyin',{recursive:true,filter:source=>!source.includes('__pycache__')});

await import('./plugin-catalog.mjs');
cpSync('plugins/sdk','dist/plugin-sdk',{recursive:true});

copyFileSync('scripts/pack-plugin.mjs','dist/plugin-sdk/pack-plugin.mjs');
cpSync('examples/hello-fish','dist/plugin-examples/hello-fish',{recursive:true});
copyFileSync('plugins/sdk/host.mjs','dist/plugin-examples/hello-fish/host.mjs');

mkdirSync('dist/runtime/src/channels/managed',{recursive:true});
copyFileSync('apps/runtime/src/channels/managed/unzip.ps1','dist/runtime/src/channels/managed/unzip.ps1');
copyFileSync('apps/runtime/src/channels/managed/windows-job.ps1','dist/runtime/src/channels/managed/windows-job.ps1');

cpSync('apps/runtime/src/channels/sticker-assets','dist/runtime/src/channels/sticker-assets',{recursive:true});
