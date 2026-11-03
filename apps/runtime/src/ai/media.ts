import type { Configuration } from './configuration.js';
import { InputError, object, string } from './types.js';
export interface VideoEvidence{platform?:string;title:string;url:string;subtitles:string;warnings:string[]}
export async function transcribe(config:Configuration,audio:{data:string;mimeType:string},signal:AbortSignal){
 const id=config.routes().asr;if(!id)throw new InputError('ASR_MODEL_MISSING',409);const model=config.model(id);if(model.config.provider!=='openai')throw new InputError('ASR_PROVIDER_UNSUPPORTED',409);
 const bytes=Buffer.from(audio.data,'base64');if(!bytes.length||bytes.length>2_000_000)throw new InputError('AUDIO_BUDGET_EXCEEDED');const form=new FormData();form.append('model',model.config.model);form.append('file',new Blob([bytes],{type:audio.mimeType}),'capture.webm');
 const response=await fetch(`${model.config.baseURL}/audio/transcriptions`,{method:'POST',redirect:'error',headers:model.key?{Authorization:`Bearer ${model.key}`}:{},body:form,signal:AbortSignal.any([signal,AbortSignal.timeout(Math.min(60000,model.config.timeoutMs))])});if(!response.ok)throw new InputError('ASR_FAILED',409);const reader=response.body?.getReader();if(!reader)throw new InputError('ASR_FAILED');const chunks:Uint8Array[]=[];let size=0;try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>65536)throw new InputError('ASR_OUTPUT_TOO_LARGE');chunks.push(part.value);}}finally{await reader.cancel();}return {text:string(object(JSON.parse(Buffer.concat(chunks).toString('utf8'))).text,24000),modelId:id};
}
