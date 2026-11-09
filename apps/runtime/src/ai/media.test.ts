import { afterEach, expect, it, vi } from 'vitest';
import { transcribe } from './media.js';
import type { Configuration } from './configuration.js';
const config={routes:()=>({asr:'fixture'}),model:()=>({config:{provider:'openai',model:'fixture',baseURL:'http://fixture',timeoutMs:1000}})} as unknown as Configuration;
afterEach(()=>vi.unstubAllGlobals());
it('decodes Chinese across byte boundaries and bounds response bytes',async()=>{
 const json=Buffer.from(JSON.stringify({text:'海洋生物'}));const start=json.indexOf(Buffer.from('海'));
 for(const split of [start+1,start+2,json.length]){vi.stubGlobal('fetch',async()=>new Response(new ReadableStream({start(c){c.enqueue(json.subarray(0,split));c.enqueue(json.subarray(split));c.close();}})));expect((await transcribe(config,{data:'YQ==',mimeType:'audio/webm'},new AbortController().signal)).text).toBe('海洋生物');}
 vi.stubGlobal('fetch',async()=>new Response(new ReadableStream({start(c){c.enqueue(Buffer.alloc(65537,32));c.close();}})));
 await expect(transcribe(config,{data:'YQ==',mimeType:'audio/webm'},new AbortController().signal)).rejects.toThrow('ASR_OUTPUT_TOO_LARGE');
});
