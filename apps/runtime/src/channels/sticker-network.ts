import {lookup} from 'node:dns';
import {request} from 'node:https';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {InputError,object,string} from '../ai/types.js';
import {STICKER_LIMITS,validateStickerImage} from './stickers.js';
const catalogURL='https://aigengtu.com/gallery-index.json';
export function stickerURL(value:string,catalog=false){
 const url=new URL(value);if(url.protocol!=='https:'||url.port||url.username||url.password||url.search||url.hash||url.href!==(catalog?catalogURL:value))throw new InputError('STICKER_SOURCE_INVALID');
 if(catalog?url.href!==catalogURL:url.hostname!=='img.aigengtu.com'||!/^\/(?:0_preview\/)?meme\/[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp)$/.test(url.pathname))throw new InputError('STICKER_SOURCE_INVALID');return url;
}
export function publicIPv4(address:string){const parts=address.split('.').map(Number);if(parts.length!==4||parts.some(n=>!Number.isInteger(n)||n<0||n>255))return false;const [a,b]=parts;return !(a===0||a===10||a===127||a!>=224||a===100&&b!>=64&&b!<=127||a===169&&b===254||a===172&&b!>=16&&b!<=31||a===192&&(b===0||b===168)||a===198&&(b===18||b===19||b===51)||a===203&&b===0);}
export async function fetchStickerBytes(value:string,signal:AbortSignal,catalog=false):Promise<Buffer>{
 const url=stickerURL(value,catalog),limit=catalog?4_000_000:4_000_000,combined=AbortSignal.any([signal,AbortSignal.timeout(10000)]);
 return new Promise((resolve,reject)=>{
  const req=request(url,{method:'GET',family:4,agent:false,signal:combined,headers:{accept:catalog?'application/json':'image/png,image/jpeg,image/webp'},lookup:(hostname,_options,callback)=>lookup(hostname,{family:4,all:true},(error,addresses)=>{if(error){callback(error,'',4);return;}if(!addresses.length||addresses.some(a=>!publicIPv4(a.address))){callback(new Error('STICKER_SOURCE_INVALID'),'',4);return;}callback(null,addresses[0]!.address,4);})},res=>{
   if(res.statusCode!==200||Number(res.headers['content-length']??0)>limit){res.destroy();reject(new InputError('STICKER_DOWNLOAD_FAILED'));return;}const chunks:Buffer[]=[];let size=0;res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>limit){res.destroy(new Error('STICKER_DOWNLOAD_TOO_LARGE'));return;}chunks.push(chunk);});res.once('error',reject);res.once('end',()=>resolve(Buffer.concat(chunks)));
  });req.once('error',reject);req.end();
 });
}
interface NetworkSticker {id:string;name:string;description:string;url:string}
export class NetworkStickers {
 private cached?:{at:number;items:NetworkSticker[]};
 constructor(private fetchBytes=fetchStickerBytes){}
 async search(query:string,signal:AbortSignal){
  query=string(query,80).toLowerCase();
  if(!this.cached||Date.now()-this.cached.at>15*60*1000){
   const bytes=await this.fetchBytes(catalogURL,signal,true),payload=object(JSON.parse(bytes.toString('utf8'))),gallery=object(payload.gallery),group=object(gallery['DeepSeek娘']);
   if(!Array.isArray(group.images)||group.images.length>10000)throw new InputError('STICKER_SOURCE_INVALID');
   const items:NetworkSticker[]=[];
   for(const raw of group.images){try{const row=object(raw),url=stickerURL(string(row.preview??row.original,1000)).href,name=string(row.name??row.alt,80),story=row.story?object(row.story):{},description=typeof story.zh==='string'?story.zh.slice(0,200):name;
    if(/色情|性交|乳房|乳交|胸交|口交|手淫|自慰|淫荡|高潮|精液|射精|鸡巴|阴茎|阴道|裸露|裸体|发情|媚药|强奸|调教|深喉|颜射|足交|舔脚|性奴|性癖/i.test(name+' '+description))continue;
    items.push({id:'web-'+createHash('sha256').update(url).digest('hex').slice(0,24),name,description,url});
   }catch{/* malformed entries cannot become download targets */}}
   this.cached={at:Date.now(),items};
  }
  signal.throwIfAborted();const terms=query.split(/[\s，,]+/).filter(Boolean);return this.cached.items.map(item=>({item,score:terms.reduce((n,t)=>n+(item.name.toLowerCase().includes(t)?3:0)+(item.description.toLowerCase().includes(t)?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,8).map(x=>x.item);
 }
 async image(item:NetworkSticker,signal:AbortSignal){const raw=await this.fetchBytes(item.url,signal),decoder=sharp(raw,{limitInputPixels:STICKER_LIMITS.pixels,failOn:'warning'}),meta=await decoder.metadata();if(!['png','jpeg','webp'].includes(meta.format??'')||(meta.pages??1)!==1)throw new InputError('INVALID_STICKER_IMAGE');const png=await decoder.resize({width:768,height:768,fit:'inside',withoutEnlargement:true}).png().toBuffer();signal.throwIfAborted();return validateStickerImage(png.toString('base64'));}
}
