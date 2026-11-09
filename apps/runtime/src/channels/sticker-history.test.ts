import {expect,it} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import sharp from 'sharp';
import {migrate} from '../storage/database.js';
import {StickerHistory} from './sticker-history.js';
import {StickerLibrary} from './stickers.js';
import {StickerTurn} from './sticker-turn.js';
import {NetworkStickers} from './sticker-network.js';

it('bounds recent stickers by account and target without treating failed attempts as use',()=>{
 const history=new StickerHistory(),target={kind:'private' as const,id:'20002'};
 for(const status of ['failed','blocked','revoked','cancelled','interrupted','queued'])history.record('10001',target,status,status);
 expect(history.recent('10001',target)).toEqual([]);
 history.record('10001',target,'first','sent');history.record('10001',target,'uncertain','unknown');
 expect(history.recent('10001',target)).toEqual(['uncertain','first']);
 expect(history.recent('10002',target)).toEqual([]);
 expect(history.recent('10001',{kind:'group',id:target.id})).toEqual([]);
 expect(history.recent('10001',{kind:'private',id:'20003'})).toEqual([]);
 history.record('10001',target,'first','sent');expect(history.recent('10001',target)).toEqual(['first','uncertain']);
 for(let i=0;i<10;i++)history.record('10001',target,'image-'+i,'sent');
 expect(history.recent('10001',target)).toEqual(['image-9','image-8','image-7','image-6','image-5','image-4','image-3','image-2']);
 for(let i=0;i<64;i++)history.record('10001',{kind:'group',id:String(i)},'group-image','sent');
 expect(history.recent('10001',target)).toEqual([]);
 expect(history.recent('10001',{kind:'group',id:'63'})).toEqual(['group-image']);
 expect(new StickerHistory().recent('10001',target)).toEqual([]);
});

it('offers unused local and network candidates before truncation while retaining relevance and single-image fallback',async()=>{
 const db=new DatabaseSync(':memory:');migrate(db);const library=new StickerLibrary(db);
 const bytes=(await sharp({create:{width:8,height:8,channels:3,background:'#22789f'}}).png().toBuffer()).toString('base64');
 const signal=new AbortController().signal;
 const network=new NetworkStickers(async()=>Buffer.from(JSON.stringify({gallery:{'DeepSeek娘':{images:Array.from({length:10},(_,i)=>({name:i===0?'开心 庆祝':'开心',story:{zh:'笑'},preview:`https://img.aigengtu.com/0_preview/meme/${i}.webp`}))}}})));
 try{
  const a=await library.add({name:'开心A',description:'开心',data:bytes}),b=await library.add({name:'开心B',description:'开心',data:bytes});
  const turn=new StickerTurn(library,()=>{},network,[a.id]),list=()=>turn.tools().find(t=>t.name==='list_stickers')!.execute({},signal);
  expect(await list()).toEqual([{id:b.id,name:b.name,description:b.description,recentlyUsed:false},{id:a.id,name:a.name,description:a.description,recentlyUsed:true}]);
  expect(library.list().map(item=>item.id)).toEqual([a.id,b.id]);
  library.update(b.id,{enabled:false,revision:b.revision});
  expect(await list()).toMatchObject([{id:a.id,recentlyUsed:true}]);
  library.update(a.id,{enabled:false,revision:a.revision});expect(await list()).toEqual([]);
  const first=await network.search('开心',signal),recent=first.map(item=>item.id),next=await network.search('开心',signal,recent);
  expect(first).toHaveLength(8);expect(next).toHaveLength(8);
  expect(next.slice(0,2).every(item=>!recent.includes(item.id))).toBe(true);
  expect((await network.search('开心 庆祝',signal,recent))[0]!.name).toBe('开心 庆祝');
  const networkTurn=new StickerTurn(library,()=>{},network,recent);
  const candidates=await networkTurn.tools().find(t=>t.name==='search_stickers')!.execute({query:'开心'},signal) as {recentlyUsed:boolean}[];
  expect(candidates.slice(0,2).map(item=>item.recentlyUsed)).toEqual([false,false]);expect(candidates[2]!.recentlyUsed).toBe(true);
  library.saveOptions({networkEnabled:false,revision:'initial'});
  expect(new StickerTurn(library,()=>{},network).tools().map(t=>t.name)).not.toContain('search_stickers');
 }finally{db.close();}
});
