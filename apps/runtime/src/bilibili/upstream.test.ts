import { it, expect } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { paths, preparePaths } from '../paths.js';
import { Upstream } from './upstream.js';
const ffmpeg=process.env.BFF_TEST_FFMPEG;
it.skipIf(!ffmpeg)('executes fixed upstream CLI and ffmpeg; validates subtitle/frame files, cache, no subtitles, timeout and cancellation',async()=>{
 expect(ffmpeg,'Set BFF_TEST_FFMPEG to a real executable for this integration check').toBeTruthy();
 const root=mkdtempSync(join(tmpdir(),'bff whale upstream ')),p=paths(root);preparePaths(p);const bin=join(root,'bin');mkdirSync(bin);
 const originalPath=process.env.PATH;process.env.PATH=resolve(ffmpeg!,'..')+':'+originalPath;
 const video=join(root,'fixture.mp4');expect(spawnSync(ffmpeg!,['-y','-f','lavfi','-i','color=c=blue:s=320x180:r=10','-t','9','-c:v','mpeg4',video]).status).toBe(0);
 const options={preload:resolve('tests/fixtures/bilibili-network.mjs'),env:{BFF_FIXTURE_VIDEO:video}};
 try{
 const upstream=new Upstream(p,options),signal=new AbortController().signal;
 expect((await upstream.search('fish',null,signal)).text).toContain('BV1234567890');
 const watched=await upstream.watch('BV1234567890',null,signal);expect(watched.evidence.subtitles).toContain('蓝色');expect(watched.evidence.frames).toBe(9);expect(watched.images[0]?.data).toBeTruthy();expect(readdirSync(join(p.runtime,'bilibili'))).toEqual([]);
 const cached=await upstream.watch('BV1234567890',null,signal);expect(cached.evidence.metadataCached).toBe(true);
 const noSubs=new Upstream(p,{...options,env:{...options.env,BFF_FIXTURE_MODE:'no-subs'}});expect((await noSubs.watch('BV1234567891',null,signal)).evidence.warnings).toContain('NO_SUBTITLES');
 process.env.PATH=bin;const missing=new Upstream(p,options);expect(missing.ffmpeg()).toBe(false);expect((await missing.watch('BV1234567892',null,signal)).evidence.warnings).toContain('FFMPEG_MISSING');
 const none=new Upstream(p,{...options,env:{...options.env,BFF_FIXTURE_MODE:'no-subs'}});await expect(none.watch('BV1234567893',null,signal)).rejects.toThrow('NO_WATCH_EVIDENCE');
 const slow=new Upstream(p,{...options,env:{BFF_FIXTURE_MODE:'slow'},timeoutMs:200});await expect(slow.search('x',null,signal)).rejects.toThrow('BILI_TIMEOUT');
 const control=new AbortController(),pending=new Upstream(p,{...options,env:{BFF_FIXTURE_MODE:'slow'}}).search('x',null,control.signal);setTimeout(()=>control.abort(),150);await expect(pending).rejects.toThrow('CANCELLED');expect(readdirSync(join(p.runtime,'bilibili'))).toEqual([]);
 // An API success with no output files is never a successful watch (covered by no-subs + no ffmpeg).
 writeFileSync(join(bin,'unused'),'');
 }finally{process.env.PATH=originalPath;rmSync(root,{recursive:true,force:true});}
},90000);
