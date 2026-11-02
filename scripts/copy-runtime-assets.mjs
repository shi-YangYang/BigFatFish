import { copyFileSync } from 'node:fs';
copyFileSync(new URL('../apps/runtime/src/windows-acl.ps1', import.meta.url), new URL('../dist/runtime/src/windows-acl.ps1', import.meta.url));
