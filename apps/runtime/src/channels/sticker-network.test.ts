import {beforeEach,expect,it,vi} from 'vitest';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {lookup} from 'node:dns';
import {request} from 'node:https';
import {fetchStickerBytes} from './sticker-network.js';
vi.mock('node:dns',()=>({lookup:vi.fn()}));
vi.mock('node:https',()=>({request:vi.fn()}));
let address='8.8.8.8',status=200,length='2',body=Buffer.from('ok'),usedAddress='';
beforeEach(()=>{
 address='8.8.8.8';status=200;length='2';body=Buffer.from('ok');usedAddress='';
 vi.mocked(lookup).mockImplementation(((_host:unknown,_options:unknown,done:(e:Error|null,addresses:unknown[])=>void)=>done(null,[{address,family:4}])) as typeof lookup);
 vi.mocked(request).mockImplementation(((_url:unknown,options:{signal:AbortSignal;lookup:(host:string,options:unknown,done:(err:Error|null,ip:string)=>void)=>void;headers:Record<string,string>},callback:(res:PassThrough&{statusCode:number;headers:Record<string,string>})=>void)=>{
  const req=new EventEmitter() as EventEmitter&{end:()=>void};req.end=()=>queueMicrotask(()=>{
   if(options.signal.aborted){req.emit('error',options.signal.reason);return;}
   expect(options.headers.authorization).toBeUndefined();
   options.lookup('img.aigengtu.com',{},(error,ip)=>{if(error){req.emit('error',error);return;}usedAddress=ip;const res=Object.assign(new PassThrough(),{statusCode:status,headers:{'content-length':length}});callback(res);if(!res.destroyed)res.end(body);});
  });return req;
 }) as typeof request);
});
it('uses a vetted DNS address and refuses a private DNS answer',async()=>{
 expect((await fetchStickerBytes('https://img.aigengtu.com/meme/001.webp',new AbortController().signal)).toString()).toBe('ok');expect(usedAddress).toBe('8.8.8.8');address='127.0.0.1';await expect(fetchStickerBytes('https://img.aigengtu.com/meme/001.webp',new AbortController().signal)).rejects.toThrow('STICKER_SOURCE_INVALID');
});
it('does not follow redirects and bounds declared and streaming bytes',async()=>{
 const get=()=>fetchStickerBytes('https://img.aigengtu.com/meme/001.webp',new AbortController().signal);
 status=302;await expect(get()).rejects.toThrow('STICKER_DOWNLOAD_FAILED');status=200;length='4000001';await expect(get()).rejects.toThrow('STICKER_DOWNLOAD_FAILED');length='0';body=Buffer.alloc(4_000_001);await expect(get()).rejects.toThrow('STICKER_DOWNLOAD_TOO_LARGE');
});
it('propagates cancellation without downloading',async()=>{
 const control=new AbortController();control.abort(new Error('CANCELLED'));await expect(fetchStickerBytes('https://img.aigengtu.com/meme/001.webp',control.signal)).rejects.toThrow('CANCELLED');expect(usedAddress).toBe('');
});
