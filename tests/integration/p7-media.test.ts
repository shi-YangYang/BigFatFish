import {deflateSync,crc32} from 'node:zlib';
import {expect,it} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {paths} from '../../apps/runtime/src/paths.js';
import {startRuntime} from '../../apps/runtime/src/lifecycle.js';
import {requestRuntime} from '../../apps/runtime/src/connection.js';
import {fixtureModel} from '../fixtures/model.mjs';
import {onebotFixture} from '../fixtures/onebot.js';
import type {ChannelStatus,SendResult} from '../../apps/runtime/src/channels/types.js';
import {onebotConfig} from '../../apps/runtime/src/channels/managed/service.js';
it('real ASR/TTS media and QQ file upload plus configured image bytes, failure context and cancellation',async()=>{
 const p=paths(mkdtempSync(join(tmpdir(),'bff-media-'))),fixture=await fixtureModel(),bot=await onebotFixture(),runtime=await startRuntime(p);
 const call=<T>(route:string,method='GET',body?:unknown)=>requestRuntime<T>(runtime.connection,route,method,body);
 const wait=async(read:()=>Promise<boolean>)=>{for(let i=0;i<200;i++){if(await read())return;await delay(50);}throw new Error('CONDITION_TIMEOUT');};
 try{
  await call('/v1/models','POST',{id:'media',label:'媒体夹具',provider:'openai',baseURL:fixture.url,model:'fixture-model',contextWindow:8192,maxTokens:512,timeoutMs:20000,vision:true});await call('/v1/model-routes','PUT',{chat:'media',vision:'media',asr:'media',tts:'media'});
  const speech=await call<{data:string;mimeType:string;synthetic:boolean}>('/v1/media/synthesize','POST',{text:'鱼在这里',voice:'fixture'});expect(speech.synthetic).toBe(true);expect(Buffer.from(speech.data,'base64').subarray(0,4).toString()).toBe('RIFF');
  expect(await call('/v1/media/transcribe','POST',speech)).toMatchObject({text:'隔离音轨转写：海洋里的鱼'});expect(fixture.requests.find(r=>r.url==='/v1/audio/transcriptions')?.raw).toContain('capture.wav');
  await expect(call('/v1/media/transcribe','POST',{mimeType:'text/html',data:'YQ=='})).rejects.toThrow('UNSUPPORTED_MEDIA_FORMAT');
  const status=await call<ChannelStatus>('/v1/channels/qq');await call('/v1/channels/qq','PUT',{url:bot.url,accountId:'10001',ownerId:'20002',groups:[],enabled:true,replyEnabled:true,proactiveEnabled:true,token:'fixture-token',revision:status.revision});await wait(async()=>(await call<ChannelStatus>('/v1/channels/qq')).health.state==='online');
  await expect(call('/v1/channels/qq/send','POST',{target:{kind:'private',id:'20002'},segments:[{type:'file',data:{file:'base64://'+Buffer.alloc(2_000_001).toString('base64'),name:'large.txt'}}]})).rejects.toThrow('UNSAFE_MEDIA_REFERENCE');
  const proposal=await call<SendResult>('/v1/channels/qq/send','POST',{target:{kind:'private',id:'20002'},segments:[{type:'file',data:{file:'base64://'+Buffer.from('真实文档'.repeat(20000)).toString('base64'),name:'fish.txt'}}]});expect(proposal.status).toBe('sent');expect(bot.requests.filter(r=>r.action==='upload_private_file')).toHaveLength(1);expect(bot.requests.filter(r=>r.action.startsWith('send_'))).toHaveLength(0);
  const png=realPNG();expect(png.length).toBeGreaterThan(32768);expect(Buffer.from(speech.data,'base64').length).toBeGreaterThan(32768);
  const mediaEvent=(id:string,file='a'.repeat(32))=>({post_type:'message',message_type:'private',self_id:'10001',user_id:'20002',message_id:id,message:[{type:'reply',data:{id:'99'}},{type:'image',data:{file}}]});
  const terminal=(id:string)=>wait(async()=>(await call<{id:string;status:string}[]>('/v1/channels/qq/deliveries')).some(d=>d.id.endsWith(':'+id)&&!['queued','generating','sending'].includes(d.status)));
  const lastInput=async()=>{const conversations=await call<{id:string}[]>('/v1/conversations');const messages=await call<{role:string;content:string}[]>('/v1/conversations/'+conversations[0]!.id+'/messages');return messages.filter(m=>m.role==='user').at(-1)!.content;};
  const imageRequests=()=>fixture.requests.filter(r=>JSON.stringify(r.body??{}).includes('image_url'));
  bot.controls.media=png.toString('base64');bot.event(mediaEvent('10'));await terminal('10');
  expect(await lastInput()).toContain('图片已收到，但未能取得可读取的内容');expect(await lastInput()).toContain('引用消息 99，未读取原文');expect(imageRequests()).toHaveLength(0);
  bot.controls.inlineMedia=onebotConfig({id:'fixture',botToken:'fixture-token',webToken:'fixture-web',botPort:3001,webPort:6099,installed:true},false).enableLocalFile2Url;
  for(const [i,kind,data]of [[1,'image',png.toString('base64')],[2,'record',speech.data]] as const){bot.controls.media=data;bot.event({post_type:'message',message_type:'private',self_id:'10001',user_id:'20002',message_id:String(i),message:[{type:kind,data:{file:'a'.repeat(32)}}]});await wait(async()=>(await call<{id:string;status:string}[]>('/v1/channels/qq/deliveries')).some(d=>d.id.endsWith(':'+i)&&d.status==='sent'));}
  expect(bot.requests.some(r=>r.action==='get_image')).toBe(true);expect(bot.requests.some(r=>r.action==='get_file')).toBe(false);expect(bot.requests.some(r=>r.action==='get_record'&&r.params.out_format==='wav')).toBe(true);expect(imageRequests()).toHaveLength(1);expect(JSON.stringify(fixture.requests)).toContain('本条图片已读取');expect(await lastInput()).toContain('隔离音轨转写');
  bot.controls.media=Buffer.from('not an image').toString('base64');bot.event(mediaEvent('11'));await terminal('11');expect(await lastInput()).toContain('图片已收到，但格式暂不支持');
  bot.controls.media=Buffer.alloc(2_000_001).toString('base64');bot.event(mediaEvent('12'));await terminal('12');expect(await lastInput()).toContain('图片已收到，但超过读取大小限制');expect(imageRequests()).toHaveLength(1);
  const beforeMedia=bot.requests.filter(r=>r.action==='get_image').length;
  bot.event(mediaEvent('13','/etc/passwd'));await terminal('13');expect(await lastInput()).toContain('图片已收到，但未能取得可读取的内容');expect(bot.requests.filter(r=>r.action==='get_image')).toHaveLength(beforeMedia);
  const beforeSend=bot.requests.filter(r=>r.action.startsWith('send_')).length,beforeModel=fixture.requests.length,gate=bot.pauseNextMedia();bot.controls.media=png.toString('base64');bot.event(mediaEvent('14'));await gate.reached;
  await call('/v1/channels/qq/stop','POST');expect((await call<ChannelStatus>('/v1/channels/qq')).health.state).toBe('stopped');
  gate.release();await terminal('14');expect((await call<{id:string;status:string;error:string}[]>('/v1/channels/qq/deliveries')).find(d=>d.id.endsWith(':14'))).toMatchObject({status:'interrupted',error:'CANCELLED'});expect(fixture.requests).toHaveLength(beforeModel);expect(bot.requests.filter(r=>r.action.startsWith('send_'))).toHaveLength(beforeSend);
 }finally{await runtime.stop();await bot.close();await fixture.close();rmSync(p.root,{recursive:true,force:true});}
},45000);

function realPNG(){const raw=Buffer.alloc((320*3+1)*240);let seed=42;for(let y=0;y<240;y++)for(let x=1;x<961;x++){seed=(seed*1664525+1013904223)>>>0;raw[y*961+x]=seed>>>24;}const header=Buffer.alloc(13);header.writeUInt32BE(320);header.writeUInt32BE(240,4);header[8]=8;header[9]=2;const chunk=(name:string,data:Buffer)=>{const type=Buffer.from(name),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([type,data])));return Buffer.concat([size,type,data,crc]);};return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
