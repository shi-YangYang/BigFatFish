import { copyFileSync, mkdirSync, cpSync } from 'node:fs';
copyFileSync('apps/runtime/src/windows-acl.ps1', 'dist/runtime/src/windows-acl.ps1');
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
