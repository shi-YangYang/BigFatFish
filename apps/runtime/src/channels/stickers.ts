import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import type {DatabaseSync} from 'node:sqlite';
import sharp from 'sharp';
import {InputError,object,string} from '../ai/types.js';
import {segments} from './protocol.js';
export interface StickerInfo {id:string;name:string;description:string;enabled:boolean;builtin:boolean;revision:string;mimeType:'image/png'|'image/jpeg';bytes:number}
interface StickerRow extends Omit<StickerInfo,'enabled'|'builtin'> {enabled:number;builtin:number;data:string}
export const STICKER_LIMITS={count:48,bytes:2_000_000,total:24_000_000,pixels:16_777_216};
export async function validateStickerImage(input:unknown){
 const data=string(input,2_800_000);segments([{type:'image',data:{file:'base64://'+data}}],true);
 const bytes=Buffer.from(data,'base64');
 try{const decoder=sharp(bytes,{limitInputPixels:STICKER_LIMITS.pixels,failOn:'warning'}),meta=await decoder.metadata();if(!['png','jpeg'].includes(meta.format??'')||(meta.pages??1)!==1||!meta.width||!meta.height||meta.width>4096||meta.height>4096)throw new Error();await decoder.stats();return {data,mimeType:meta.format==='png'?'image/png' as const:'image/jpeg' as const,bytes:bytes.length};}catch{throw new InputError('INVALID_STICKER_IMAGE');}
}
const builtins=[['hello','你好呀','开心地打招呼、回应问候'],['praise','求夸夸','撒娇求夸奖、开心期待'],['pout','哼','轻微赌气、俏皮顶嘴，不用于严肃争执']] as const;
export class StickerLibrary {
 constructor(private db:DatabaseSync){}
 options(){const row=this.db.prepare('SELECT network_enabled,revision FROM qq_sticker_options WHERE id=1').get();return {networkEnabled:row?!!row.network_enabled:true,revision:row?String(row.revision):'initial'};}
 saveOptions(input:unknown){const b=object(input);if(typeof b.networkEnabled!=='boolean')throw new InputError('INVALID_REQUEST');if(b.revision!==this.options().revision)throw new InputError('STICKER_CHANGED',409);this.db.prepare('INSERT INTO qq_sticker_options(id,network_enabled,revision) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET network_enabled=excluded.network_enabled,revision=excluded.revision').run(b.networkEnabled?1:0,randomUUID());return this.options();}
 async initialize(){for(const [key,name,description] of builtins){const id='builtin-'+key;if(this.db.prepare('SELECT id FROM qq_stickers WHERE id=?').get(id))continue;const image=await validateStickerImage(readFileSync(new URL(`./sticker-assets/${key}.png`,import.meta.url)).toString('base64'));this.insert({id,name,description,builtin:1,...image});}}
 private insert(row:{id:string;name:string;description:string;builtin:number;data:string;mimeType:string;bytes:number}){
  const totals=this.db.prepare('SELECT count(*) AS n,COALESCE(sum(bytes),0) AS bytes FROM qq_stickers').get()!;
  if(Number(totals.n)>=STICKER_LIMITS.count||Number(totals.bytes)+row.bytes>STICKER_LIMITS.total)throw new InputError('STICKER_LIBRARY_FULL',409);
  this.db.prepare('INSERT INTO qq_stickers(id,name,description,enabled,builtin,revision,mime_type,bytes,data) VALUES(?,?,?,1,?,?,?,?,?)').run(row.id,row.name,row.description,row.builtin,randomUUID(),row.mimeType,row.bytes,row.data);return this.info(row.id);
 }
 list(){return this.db.prepare('SELECT id,name,description,enabled,builtin,revision,mime_type AS mimeType,bytes FROM qq_stickers ORDER BY builtin DESC,rowid').all().map(r=>({...r,enabled:!!r.enabled,builtin:!!r.builtin})) as unknown as StickerInfo[];}
 private row(id:string){const r=this.db.prepare('SELECT *,mime_type AS mimeType FROM qq_stickers WHERE id=?').get(string(id,100)) as unknown as StickerRow|undefined;if(!r)throw new InputError('STICKER_NOT_FOUND',404);return r;}
 info(id:string){const {data:_,mime_type:__,...r}=this.row(id) as StickerRow&{mime_type:string};return {...r,enabled:!!r.enabled,builtin:!!r.builtin} as StickerInfo;}
 image(id:string){const r=this.row(id);return {data:r.data,mimeType:r.mimeType};}
 assertEnabled(id:string,revision?:string){const r=this.row(id);if(!r.enabled||revision&&revision!==r.revision)throw new InputError('STICKER_CHANGED',409);return r;}
 async add(input:unknown){const b=object(input),name=string(b.name,40),description=string(b.description,200,true),image=await validateStickerImage(b.data);return this.insert({id:randomUUID(),name,description,builtin:0,...image});}
 update(id:string,input:unknown){const b=object(input),r=this.row(id);if(b.revision!==r.revision)throw new InputError('STICKER_CHANGED',409);if(typeof b.enabled!=='boolean')throw new InputError('INVALID_REQUEST');this.db.prepare('UPDATE qq_stickers SET enabled=?,revision=? WHERE id=?').run(b.enabled?1:0,randomUUID(),id);return this.info(id);}
 remove(id:string){const r=this.row(id);if(r.builtin)throw new InputError('BUILTIN_STICKER',409);this.db.prepare('DELETE FROM qq_stickers WHERE id=?').run(id);return {deleted:true};}
 async validateStored(){const rows=this.db.prepare('SELECT * FROM qq_stickers').all();if(rows.length>STICKER_LIMITS.count)throw new InputError('STICKER_LIBRARY_FULL');let total=0;for(const r of rows){string(r.id,100);string(r.name,40);string(r.description,200,true);string(r.revision,100);if(![0,1].includes(Number(r.enabled))||![0,1].includes(Number(r.builtin)))throw new InputError('INVALID_STICKER_IMAGE');const data=string(r.data,2_800_000);segments([{type:'image',data:{file:'base64://'+data}}],true);const image=await validateStickerImage(data);if(image.bytes!==r.bytes||image.mimeType!==r.mime_type)throw new InputError('INVALID_STICKER_IMAGE');total+=image.bytes;}if(total>STICKER_LIMITS.total)throw new InputError('STICKER_LIBRARY_FULL');}
}
