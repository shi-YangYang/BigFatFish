import {expect,it} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import sharp from 'sharp';
import {migrate} from '../../storage/database.js';
import {StickerHistory} from './sticker-history.js';
import {StickerLibrary} from './library.js';
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
  const turn=new StickerTurn(library,()=>{},network,[a.id]),list=()=>turn.tools().find(t=>t.name==='search_stickers')!.execute({source:'local'},signal);
  expect(await list()).toEqual([{id:b.id,name:b.name,description:b.description,source:'本地',recentlyUsed:false},{id:a.id,name:a.name,description:a.description,source:'本地',recentlyUsed:true}]);
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
  expect(await new StickerTurn(library,()=>{},network).tools().find(t=>t.name==='search_stickers')!.execute({query:'开心'},signal)).toEqual([]);
 }finally{db.close();}
});

it('rotates relevant unseen previews per chat, including alternate captions and mood words',async()=>{
 const rows=Array.from({length:23},(_,i)=>({name:'鱼的日常'+i,alt:i<20?'笑嘻嘻捧着小红花':i===20?'晚安睡觉':'其他素材',preview:'https://img.aigengtu.com/meme/'+i+'.webp'}));
 const net=new NetworkStickers(async()=>Buffer.from(JSON.stringify({gallery:{'DeepSeek娘':{images:rows}}})));
 const s=new AbortController().signal,search=(q:string,chat:string)=>net.search(q,s,[],chat);
 const first=await search('来个开心的表情','group:A'),next=await search('开心','group:A');
 expect(new Set([...first,...next].map(v=>v.id)).size).toBe(16);
 expect(await search('来个开心的表情','private:B')).toEqual(first);
 expect(await search('小红花','group:A')).toHaveLength(8);
 expect(await search('晚安','group:A')).toHaveLength(1);
 expect(await search('企鹅','group:A')).toEqual([]);
});

it('one discovery pool interleaves equal sources, respecting relevance, use, inventory and the network switch',async()=>{
 const db=new DatabaseSync(':memory:');migrate(db);const library=new StickerLibrary(db),s=new AbortController().signal;
 const bytes=(await sharp({create:{width:8,height:8,channels:3,background:'#727272'}}).png().toBuffer()).toString('base64');let reads=0;
 const rows=Array.from({length:12},(_,i)=>({name:i===0?'开心庆祝':'开心',preview:'https://img.aigengtu.com/meme/t'+i+'.webp'}));
 const net=new NetworkStickers(async()=>{reads++;return Buffer.from(JSON.stringify({gallery:{'DeepSeek娘':{images:rows}}}));});
 try{
  for(let i=0;i<9;i++)await library.add({name:'藏品'+i,description:'开心',data:bytes});
  const old=library.list()[0]!.id,turn=(recent:string[]=[])=>new StickerTurn(library,()=>{},net,recent).tools();
  expect(turn().some(t=>t.name==='list_stickers')).toBe(false);
  const find=(recent:string[]=[])=>turn(recent).find(t=>t.name==='search_stickers')!,invoke=async(args:Record<string,string>,recent:string[]=[])=>await find(recent).execute(args,s) as {id:string;source:string}[];
  expect((await invoke({source:'local'})).length).toBe(9);expect(reads).toBe(0);
  await expect(invoke({})).rejects.toThrow();
  const mix=await invoke({query:'开心'},[old]);
  expect(mix.map(x=>x.source)).toEqual(Array.from({length:8},(_,i)=>i%2?'梗鲸':'本地'));expect(mix.map(x=>x.id)).not.toContain(old);
  expect((await invoke({query:'开心 庆祝'}))[0]!.source).toBe('梗鲸');
  const exhausted=await invoke({query:'开心'},library.list().map(i=>i.id));expect(exhausted.every(i=>i.source==='梗鲸')).toBe(true);
  library.saveOptions({networkEnabled:false,revision:'initial'});
  expect((await invoke({query:'开心'})).every(i=>i.source==='本地')).toBe(true);expect(reads).toBe(1);
 }finally{db.close();}
});
