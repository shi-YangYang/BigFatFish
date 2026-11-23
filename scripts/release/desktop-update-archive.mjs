import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
if (process.platform !== 'darwin') throw new Error('MACOS_BUILD_REQUIRED');
const root=resolve('apps/desktop/src-tauri/target/release/bundle/macos');
const version=execFileSync('/usr/libexec/PlistBuddy',['-c','Print CFBundleShortVersionString',join(root,'BigFatFish.app/Contents/Info.plist')],{encoding:'utf8'}).trim();
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('INVALID_APP_VERSION');
mkdirSync('build/artifacts',{recursive:true});
const file=resolve(`build/artifacts/BigFatFish-${version}-darwin-${process.arch}.app.tar.gz`);
// macOS copyfile metadata adds a root ._App.app file, incompatible with Tauri's updater.
execFileSync('tar',['-chzf',file,'-C',root,'BigFatFish.app'],{env:{...process.env,COPYFILE_DISABLE:'1'}});
writeFileSync(file+'.sha256',`${createHash('sha256').update(readFileSync(file)).digest('hex')}  ${file.split('/').at(-1)}\n`);
console.log(file);
