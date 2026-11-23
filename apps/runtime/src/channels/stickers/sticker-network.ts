import {lookup} from 'node:dns';
import {request} from 'node:https';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {InputError,object,string} from '../../ai/types.js';
import {STICKER_LIMITS,validateStickerImage} from './library.js';
import {searchTerms,stickerMatch} from './sticker-search.js';
import {stickerRecency} from './sticker-history.js';
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
interface IndexedSticker extends NetworkSticker {title:string;body:string}
interface Refresh {control:AbortController;done:Promise<void>;waiters:number;detached:boolean}
export class NetworkStickers {
 private cached?:{at:number;items:IndexedSticker[]};
 private catalogRetryAt=0;
 private refresh?:Refresh;
 private shown=new Map<string,string[]>();
 private imageRetries=new Map<string,number>();
 private images=new Map<string,{at:number;image:Awaited<ReturnType<typeof validateStickerImage>>}>();
 constructor(private fetchBytes=fetchStickerBytes,private now=Date.now){}
 cancelRefresh(){const job=this.refresh;this.refresh=undefined;job?.control.abort();}
 private startRefresh():Refresh{
  if(this.refresh)return this.refresh;
  const job:Refresh={control:new AbortController(),waiters:0,detached:false,done:Promise.resolve()};
  this.refresh=job;
  job.done=(async()=>{
   const signal=AbortSignal.any([job.control.signal,AbortSignal.timeout(10000)]);
   const bytes=await this.fetchBytes(catalogURL,signal,true),payload=object(JSON.parse(bytes.toString('utf8'))),group=object(object(payload.gallery)['DeepSeek娘']);
   if(!Array.isArray(group.images)||group.images.length>10000)throw new InputError('STICKER_SOURCE_INVALID');
   const items:IndexedSticker[]=[],urls=new Set<string>();
   for(const raw of group.images){try{
    const row=object(raw),url=stickerURL(string(row.preview??row.original,1000)).href;
    if(urls.has(url))continue;
    const name=string(row.name??row.alt,80),alt=typeof row.alt==='string'?row.alt.slice(0,200):'',story=row.story?object(row.story):{},description=typeof story.zh==='string'?story.zh.slice(0,200):alt||name;
    if(/色情|性交|乳房|乳交|胸交|口交|手淫|自慰|淫荡|高潮|精液|射精|鸡巴|阴茎|阴道|裸露|裸体|发情|媚药|强奸|调教|深喉|颜射|足交|舔脚|性奴|性癖/i.test(name+' '+alt+' '+description))continue;
    urls.add(url);items.push({id:'web-'+createHash('sha256').update(url).digest('hex').slice(0,24),name,description,url,title:(name+' '+alt).toLowerCase(),body:description.toLowerCase()});
   }catch{/* malformed entries cannot become download targets */}}
   signal.throwIfAborted();this.cached={at:this.now(),items};this.catalogRetryAt=0;
  })().catch(()=>{if(!job.control.signal.aborted)this.catalogRetryAt=this.now()+60_000;}).finally(()=>{if(this.refresh===job)this.refresh=undefined;});
  return job;
 }
 private async waitCold(job:Refresh,signal:AbortSignal){
  job.waiters++;
  let timer:ReturnType<typeof setTimeout>|undefined,abort:()=>void=()=>{};
  try{
   await Promise.race([job.done,new Promise<void>((resolve,reject)=>{
    abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});
    timer=setTimeout(()=>{job.detached=true;resolve();},2500);if(signal.aborted)abort();
   })]);
  }finally{
   clearTimeout(timer);signal.removeEventListener('abort',abort);job.waiters--;
   if(signal.aborted&&!job.detached&&!job.waiters&&this.refresh===job)this.cancelRefresh();
  }
 }
 // Never prefetch images or disclose a conversation/query. Tests with a real
 // transport should remain offline unless they explicitly call search().
 prewarm(){
  if(this.fetchBytes===fetchStickerBytes&&process.env.NODE_ENV==='test')return;
  if(this.now()<this.catalogRetryAt||(this.cached&&this.now()-this.cached.at<=15*60*1000))return;
  this.startRefresh().detached=true;
 }
 markShown(scope:string,ids:string[]){
  if(!ids.length)return;
  const prior=this.shown.get(scope)??[];this.shown.delete(scope);
  this.shown.set(scope,[...ids,...prior.filter(id=>!ids.includes(id))].slice(0,48));
  if(this.shown.size>64)this.shown.delete(this.shown.keys().next().value!);
 }
 async search(query:string,signal:AbortSignal,recent:readonly string[]=[],scope='default',mark=true){
  signal.throwIfAborted();const terms=searchTerms(string(query,80));
  if(!terms.length)return [];
  if(!this.cached||this.now()-this.cached.at>15*60*1000){
   if(this.now()>=this.catalogRetryAt){
    const job=this.startRefresh();
    if(this.cached)job.detached=true;else if(!job.detached)await this.waitCold(job,signal);
   }
   signal.throwIfAborted();if(!this.cached)throw new InputError('STICKER_NETWORK_UNAVAILABLE');
  }
  const shown=this.shown.get(scope)??[];
  const matches=this.cached.items.filter(item=>(this.imageRetries.get(item.url)??0)<=this.now()).map(item=>({item,rank:stickerMatch(terms,item.title,item.body)}))
   .filter(x=>x.rank>0).sort((a,b)=>b.rank-a.rank||stickerRecency(a.item.id,recent)-stickerRecency(b.item.id,recent)||stickerRecency(a.item.id,shown)-stickerRecency(b.item.id,shown)).slice(0,8);
  if(mark)this.markShown(scope,matches.map(({item})=>item.id));
  return matches.map(({item:{name,description,url,id},rank})=>({name,description,url,id,rank}));
 }
 async image(item:NetworkSticker,signal:AbortSignal){
  signal.throwIfAborted();stickerURL(item.url);
  const cached=this.images.get(item.url);if(cached&&this.now()-cached.at<15*60*1000)return cached.image;
  if((this.imageRetries.get(item.url)??0)>this.now())throw new InputError('STICKER_NETWORK_UNAVAILABLE');
  try{
   const raw=await this.fetchBytes(item.url,AbortSignal.any([signal,AbortSignal.timeout(4000)])),decoder=sharp(raw,{limitInputPixels:STICKER_LIMITS.pixels,failOn:'warning'}),meta=await decoder.metadata();if(!['png','jpeg','webp'].includes(meta.format??'')||(meta.pages??1)!==1)throw new InputError('INVALID_STICKER_IMAGE');const png=await decoder.resize({width:768,height:768,fit:'inside',withoutEnlargement:true}).png().toBuffer();const image=await validateStickerImage(png.toString('base64'));signal.throwIfAborted();
   this.imageRetries.delete(item.url);this.images.delete(item.url);this.images.set(item.url,{at:this.now(),image});if(this.images.size>4)this.images.delete(this.images.keys().next().value!);return image;
  }catch(error){signal.throwIfAborted();this.imageRetries.delete(item.url);this.imageRetries.set(item.url,this.now()+60_000);if(this.imageRetries.size>32)this.imageRetries.delete(this.imageRetries.keys().next().value!);throw error;}
 }
}
