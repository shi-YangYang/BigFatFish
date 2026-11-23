import {expect,it} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import sharp from 'sharp';
import {migrate} from '../../../apps/runtime/src/storage/database.js';
import {NetworkStickers} from '../../../apps/runtime/src/channels/stickers/sticker-network.js';
import {StickerLibrary} from '../../../apps/runtime/src/channels/stickers/library.js';
import {StickerTurn} from '../../../apps/runtime/src/channels/stickers/sticker-turn.js';
const catalog=Buffer.from(JSON.stringify({gallery:{'DeepSeek娘':{images:[{name:'开心',original:'https://img.aigengtu.com/meme/001.png'}]}}}));
const signal=new AbortController().signal;
it('bounds unavailable network waits across turns, falls back locally and retries after cooldown',async()=>{
 let calls=0,now=1000,fail=true;
 const network=new NetworkStickers(async(_url,s)=>{calls++;s.throwIfAborted();if(fail)throw new Error('NETWORK_DOWN');return catalog;},()=>now);
 const db=new DatabaseSync(':memory:');migrate(db);const library=new StickerLibrary(db);await library.initialize();
 try{
  const search=()=>new StickerTurn(library,()=>{},network).tools().find(t=>t.name==='search_stickers')!.execute({query:'开心'},signal);
  expect(await search()).toEqual(expect.arrayContaining([expect.objectContaining({id:'builtin-hello',source:'本地'})]));
  expect(await search()).toEqual(expect.arrayContaining([expect.objectContaining({source:'本地'})]));expect(calls).toBe(1);
  now+=60_001;fail=false;expect(await search()).toEqual(expect.arrayContaining([expect.objectContaining({id:expect.stringMatching(/^web-/)}),expect.objectContaining({id:'builtin-hello'})]));expect(calls).toBe(2);
  await search();expect(calls).toBe(2);
 }finally{db.close();}
});
it('does not poison failure backoff on cancellation and enforces the first search deadline',async()=>{
 let calls=0;
 const network=new NetworkStickers(async(_url,s)=>{if(++calls>1)return catalog;await new Promise<void>((_resolve,reject)=>s.addEventListener('abort',()=>reject(s.reason),{once:true}));return catalog;});
 const abort=new AbortController(),pending=network.search('开心',abort.signal);abort.abort(new Error('USER_CANCELLED'));
 await expect(pending).rejects.toThrow('USER_CANCELLED');expect(await network.search('开心',signal)).toHaveLength(1);expect(calls).toBe(2);
 let starts=0,resolve!:()=>void,aborted=false;
 const bounded=new NetworkStickers(async(_url,s)=>{starts++;s.addEventListener('abort',()=>{aborted=true;},{once:true});await new Promise<void>(r=>{resolve=r;});return catalog;});
 await Promise.all([1,2].map(()=>expect(bounded.search('开心',signal)).rejects.toThrow('STICKER_NETWORK_UNAVAILABLE')));
 expect(starts).toBe(1);expect(aborted).toBe(false);
 await expect(bounded.search('开心',signal)).rejects.toThrow('STICKER_NETWORK_UNAVAILABLE');expect(starts).toBe(1);
 resolve();await new Promise<void>(r=>setImmediate(r));
 expect(await bounded.search('开心',signal)).toHaveLength(1);expect(starts).toBe(1);
},5000);
it('backs off broken image URLs, filters them from results, caches decoded images and recovers',async()=>{
 let now=1000,calls=0,fail=true;const bytes=await sharp({create:{width:8,height:8,channels:3,background:'#22789f'}}).png().toBuffer();
 const network=new NetworkStickers(async(_url,_signal,isCatalog)=>{if(isCatalog)return catalog;calls++;if(fail)throw new Error('IMAGE_DOWN');return bytes;},()=>now);
 const [item]=await network.search('开心',signal);await expect(network.image(item!,signal)).rejects.toThrow('IMAGE_DOWN');await expect(network.image(item!,signal)).rejects.toThrow('STICKER_NETWORK_UNAVAILABLE');expect(calls).toBe(1);expect(await network.search('开心',signal)).toEqual([]);
 now+=60_001;fail=false;expect(await network.search('开心',signal)).toHaveLength(1);expect((await network.image(item!,signal)).mimeType).toBe('image/png');await network.image(item!,signal);expect(calls).toBe(2);
});

it('prewarms only shared catalog metadata; cancellation discards late bytes and a warm cache is reused',async()=>{
 let calls=0,release!:()=>void,active!:AbortSignal;
 const network=new NetworkStickers(async(_url,s,isCatalog)=>{expect(isCatalog).toBe(true);calls++;active=s;await new Promise<void>(r=>{release=r;});return catalog;});
 network.prewarm();network.prewarm();expect(calls).toBe(1);
 network.cancelRefresh();expect(active.aborted).toBe(true);release();await new Promise<void>(r=>setImmediate(r));
 network.prewarm();expect(calls).toBe(2);release();await new Promise<void>(r=>setImmediate(r));
 network.prewarm();expect(await network.search('开心',signal)).toHaveLength(1);expect(calls).toBe(2);
});
