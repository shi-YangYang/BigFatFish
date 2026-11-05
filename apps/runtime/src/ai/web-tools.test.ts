import {beforeEach,expect,it,vi} from 'vitest';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {lookup} from 'node:dns';
import {request} from 'node:https';
import {readWeb,webURL,webTools} from './web-tools.js';
vi.mock('node:dns',()=>({lookup:vi.fn()}));
vi.mock('node:https',()=>({request:vi.fn()}));
let address='8.8.8.8',status=200,length='2',body=Buffer.from('ok'),usedAddress='',location='https://127.0.0.1/secret';
let nextStatus:number|undefined,responses:PassThrough[]=[];
beforeEach(()=>{
 address='8.8.8.8';status=200;length='2';body=Buffer.from('ok');usedAddress='';location='https://127.0.0.1/secret';nextStatus=undefined;responses=[];
 vi.mocked(lookup).mockImplementation(((_host:unknown,_options:unknown,done:(e:Error|null,addresses:unknown[])=>void)=>done(null,[{address,family:4}])) as typeof lookup);
 vi.mocked(request).mockImplementation(((_url:unknown,options:{signal:AbortSignal;lookup:(host:string,options:unknown,done:(err:Error|null,ip:string)=>void)=>void;headers:Record<string,string>},callback:(res:PassThrough&{statusCode:number;headers:Record<string,string>})=>void)=>{
  const req=new EventEmitter() as EventEmitter&{end:()=>void};req.end=()=>queueMicrotask(()=>{
   if(options.signal.aborted){req.emit('error',options.signal.reason);return;}
   expect(options.headers.authorization).toBeUndefined();
   options.lookup('img.aigengtu.com',{},(error,ip)=>{if(error){req.emit('error',error);return;}usedAddress=ip;const res=Object.assign(new PassThrough(),{statusCode:status,headers:{'content-length':length,'content-type':'text/html',...(status===302?{location}:{})}});responses.push(res);if(nextStatus!==undefined){status=nextStatus;nextStatus=undefined;}callback(res);if(!res.destroyed)res.end(body);});
  });return req;
 }) as typeof request);
});
it('rejects malformed redirect callbacks without crashing and preserves redirect guards',async()=>{
 const get=()=>readWeb('https://public.example/article',new AbortController().signal);
 status=302;location='https://[';
 await expect(get()).rejects.toThrow('WEB_REDIRECT_INVALID');
 expect(responses[0]!.destroyed).toBe(true);
 // A late response error must have a listener even after the redirect branch returned.
 expect(()=>responses[0]!.emit('error',new Error('STREAM_CLOSED'))).not.toThrow();
 location='/next';nextStatus=200;
 expect((await get()).toString()).toBe('ok');
 expect(responses[1]!.destroyed).toBe(true);expect(usedAddress).toBe('8.8.8.8');
 status=302;location='https://127.0.0.1/secret';
 await expect(get()).rejects.toThrow('WEB_URL_DENIED');
 location='/loop';await expect(get()).rejects.toThrow('WEB_REDIRECT_LIMIT');
});
it('uses a vetted DNS address and refuses a private DNS answer',async()=>{
 expect((await readWeb('https://public.example/article',new AbortController().signal)).toString()).toBe('ok');expect(usedAddress).toBe('8.8.8.8');address='127.0.0.1';await expect(readWeb('https://public.example/article',new AbortController().signal)).rejects.toThrow('WEB_URL_DENIED');
});
it('does not follow redirects and bounds declared and streaming bytes',async()=>{
 const get=()=>readWeb('https://public.example/article',new AbortController().signal);
 status=302;await expect(get()).rejects.toThrow('WEB_URL_DENIED');status=200;length='1000001';await expect(get()).rejects.toThrow('WEB_FETCH_FAILED');length='0';body=Buffer.alloc(1_000_001);await expect(get()).rejects.toThrow('WEB_RESPONSE_TOO_LARGE');
});
it('propagates cancellation without downloading',async()=>{
 const control=new AbortController();control.abort(new Error('CANCELLED'));await expect(readWeb('https://public.example/article',control.signal)).rejects.toThrow('CANCELLED');expect(usedAddress).toBe('');
});

it('bounds tools and returns search source URLs without invented results',async()=>{for(const url of ['http://example.com','https://localhost','https://2130706433','https://[::1]','https://example.com:22','https://user:pass@example.com'])expect(()=>webURL(url)).toThrow();const read=vi.fn(async()=>'<rss><item><title>结果</title><link>https://example.com/article</link><description>摘要</description></item></rss>');const tools=webTools(()=>{},read),signal=new AbortController().signal;expect(await tools[0]!.execute({query:'测试'},signal)).toMatchObject({results:[{url:'https://example.com/article'}]});for(let i=0;i<4;i++)await tools[1]!.execute({url:'https://example.com/article'},signal);await expect(tools[1]!.execute({url:'https://example.com/article'},signal)).rejects.toThrow('WEB_CALL_LIMIT');expect(read).toHaveBeenCalledTimes(5);});
