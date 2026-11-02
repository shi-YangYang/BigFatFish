import { copyFileSync, mkdirSync } from 'node:fs';
copyFileSync('apps/runtime/src/windows-acl.ps1', 'dist/runtime/src/windows-acl.ps1');
mkdirSync('dist/runtime/src/ai', { recursive: true });
copyFileSync('apps/runtime/src/ai/dsh-bridge.mjs', 'dist/runtime/src/ai/dsh-bridge.mjs');
