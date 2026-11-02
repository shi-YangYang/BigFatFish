// Open via Vite /@fs/<repo>/tests/fixtures/memory-form.html; uses the real React
// component and Tauri's IPC mock, with manually released success/error responses.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks';
import { Memories } from '../../apps/desktop/src/components/Memories';
import type { Memory } from '../../apps/runtime/src/memory/types';

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const host=document.querySelector<HTMLDivElement>('#root')!;
const output=document.querySelector<HTMLPreElement>('#result')!;
const run=document.querySelector<HTMLButtonElement>('#run')!;
const assert=(condition:unknown,message:string)=>{if(!condition)throw new Error(message);};
const buttons=(text:string)=>Array.from(host.querySelectorAll('button')).filter(b=>b.textContent===text);
const click=async(button:HTMLButtonElement)=>{await act(async()=>{button.click();});};
const input=async(element:HTMLTextAreaElement,value:string)=>{await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));});};
run.onclick=async()=>{
 run.disabled=true;output.textContent='运行中';const root=createRoot(host),errors:unknown[]=[],writes:string[]=[];
 const data:Memory[]=Array.from({length:100},(_,i)=>({id:`m${i}`,kind:'fact',subject:`主题${i}`,content:`内容${i}`,importance:3,status:'confirmed',version:1,createdAt:'2026-11-03',updatedAt:'2026-11-03',sources:[{type:'user',id:`s${i}`,quote:`内容${i}`}],conflicts:[]}));
 let release:(fail?:boolean)=>void=()=>{throw new Error('No pending save');};
 mockIPC((_command,payload)=>{
  const {route,method,body}=payload as {route:string;method:string;body:Record<string,unknown>};
  if(route==='/v1/life/updates')return {revision:'fixture'};
  if(route==='/v1/memories/search')return structuredClone(data);
  if(route==='/v1/conversations'||route==='/v1/memory-tasks')return [];
  if(method==='PUT'){
   writes.push(route);
   return new Promise((resolve,reject)=>{release=(failed=false)=>{if(failed)reject('MEMORY_VERSION_CONFLICT');else{const m=data.find(m=>route.endsWith('/'+m.id))!;Object.assign(m,body,{version:m.version+1});resolve(structuredClone(m));}};});
  }
  throw new Error(`Unexpected IPC: ${method} ${route}`);
 });
 try {
  await act(async()=>{root.render(<Memories fail={error=>errors.push(error)}/>);});
  assert(buttons('编辑').length===100,'initial records load');
  await click(buttons('下一页')[0]!);assert(!buttons('上一页')[0]!.disabled,'pagination initially available');
  await click(buttons('编辑')[0]!);
  const draft=host.querySelector('textarea')!,form=draft.closest('form')!;
  await input(draft,'A 保存的草稿');await click(buttons('保存')[0]!);
  assert(writes.length===1,'one pending save');
  for(const control of host.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>('input,select,textarea'))assert(control.disabled,'all editable controls disabled while saving');
  for(const text of ['编辑','取消编辑','保存','上一页','下一页'])for(const button of buttons(text))assert(button.disabled,`${text} disabled while saving`);
  await click(buttons('编辑')[1]!);await click(buttons('取消编辑')[0]!);await click(buttons('下一页')[0]!);
  await act(async()=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  assert(writes.length===1,'duplicate submit ignored');assert(draft.value==='A 保存的草稿','disabled B/cancel/page actions preserve submitted draft');
  await act(async()=>{release();});
  assert(draft.value===''&&!draft.disabled,'successful save clears its draft and unlocks');assert(host.querySelector('article > p')!.textContent==='A 保存的草稿','updated list returned after save');
  await click(buttons('编辑')[1]!);assert(draft.value==='内容1','B can be edited after A completes');
  await input(draft,'B 失败后保留');await click(buttons('保存')[0]!);await act(async()=>{release(true);});
  assert(draft.value==='B 失败后保留'&&!draft.disabled,'failed save keeps draft and unlocks');assert(errors.length===1&&errors[0]==='MEMORY_VERSION_CONFLICT','failure remains visible through error callback');
  await click(buttons('取消编辑')[0]!);assert(draft.value==='','cancel works after failed save');
  output.textContent='PASS: delayed save locks editing B, typing controls, cancel, pagination and duplicate submission; success clears only locked draft; failure preserves draft and restores controls.';
 }catch(error){output.textContent=`FAIL: ${String(error)}`;}
 finally{await act(async()=>{root.unmount();});clearMocks();run.disabled=false;}
};
