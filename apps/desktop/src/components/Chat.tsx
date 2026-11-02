import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, Conversation, ModelConfig } from '../../../runtime/src/ai/types';
import { api, errorText, statusText } from '../api';

type PendingMessage = { content: string; requestId: string };

export function Chat({ models, fail }: { models: ModelConfig[]; fail: (e: unknown) => void }) {
 const [sessions,setSessions]=useState<Conversation[]>([]),[selection,setSelection]=useState({id:''}),[model,setModel]=useState(''),[messages,setMessages]=useState<ChatMessage[]>([]),[text,setText]=useState(''),[busy,setBusy]=useState(false);
 const selected=selection.id;
 const currentSelection=useRef(selection),draftVersion=useRef(0),mounted=useRef(false);
 const pending=useRef<PendingMessage|null>(null),sending=useRef<PendingMessage|null>(null);

 function selectSession(id:string) {
  if(currentSelection.current.id===id)return;
  const next={id};
  currentSelection.current=next;
  setSelection(next);
  setMessages([]);
  pending.current=null;
 }

 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{
  let live=true;
  const initialSelection=currentSelection.current;
  void api<Conversation[]>('/v1/conversations').then(items=>{
   if(!live)return;
   setSessions(items);
   if(currentSelection.current===initialSelection)selectSession(items[0]?.id??'');
  }).catch(e=>{if(live)fail(e);});
  return()=>{live=false;};
 },[fail]);

 useEffect(()=>{
  if(!selection.id)return;
  let live=true,loading=false;
  const load=async()=>{
   if(loading)return;
   loading=true;
   try {
    const data=await api<ChatMessage[]>(`/v1/conversations/${selection.id}/messages`);
    if(live&&currentSelection.current===selection)setMessages(data);
   } catch(e) {
    if(live&&currentSelection.current===selection)fail(e);
   } finally { loading=false; }
  };
  void load();
  const timer=setInterval(()=>void load(),350);
  return()=>{live=false;clearInterval(timer);};
 },[selection,fail]);

 async function create() {
  const origin=currentSelection.current;
  try {
   const session=await api<Conversation>('/v1/conversations','POST',model?{modelId:model}:{});
   if(!mounted.current)return;
   setSessions(items=>[session,...items]);
   if(currentSelection.current===origin)selectSession(session.id);
  } catch(e) { if(mounted.current)fail(e); }
 }

 async function send(e:React.FormEvent) {
  e.preventDefault();
  if(!selected||!text.trim()||sending.current)return;
  const origin=currentSelection.current,version=draftVersion.current;
  if(pending.current?.content!==text)pending.current={content:text,requestId:crypto.randomUUID()};
  const request=pending.current;
  sending.current=request;
  setBusy(true);
  try {
   await api(`/v1/conversations/${origin.id}/messages`,'POST',request);
   // A response owns only its submitted draft, even after switching away and back.
   if(mounted.current&&currentSelection.current===origin&&draftVersion.current===version)setText('');
   if(pending.current===request)pending.current=null;
  } catch(e) {
   if(mounted.current&&currentSelection.current===origin)fail(e);
  } finally {
   if(sending.current===request){sending.current=null;if(mounted.current)setBusy(false);}
  }
 }

 return <section className="chat"><aside><select aria-label="新会话模型" value={model} onChange={e=>setModel(e.target.value)}><option value="">使用默认聊天模型</option>{models.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select><button disabled={!models.length} onClick={()=>void create()}>新对话</button>{sessions.map(s=><button className={s.id===selected?'active':''} key={s.id} onClick={()=>selectSession(s.id)}>{s.title}<small>{s.modelId} · {new Date(s.createdAt).toLocaleString()}</small></button>)}</aside><div className="conversation"><div className="messages" aria-live="polite">{!models.length&&<p>请先在「模型」中添加聊天模型。</p>}{models.length>0&&!selected&&<p>创建一个对话，开始认识你的鱼。</p>}{messages.map(m=><article className={m.role} key={m.id}><strong>{m.role==='user'?'你':'鱼'}</strong><p>{m.content}</p><small>{m.error?errorText(m.error):statusText[m.status]}</small>{['queued','running'].includes(m.status)&&m.role==='assistant'&&<button onClick={()=>void api(`/v1/messages/${m.id}/cancel`,'POST').catch(fail)}>取消回复</button>}</article>)}</div><form onSubmit={send}><textarea aria-label="消息" value={text} onChange={e=>{draftVersion.current++;setText(e.target.value);}} placeholder="想和鱼聊些什么？" disabled={!selected}/><button disabled={busy||!selected||!text.trim()}>发送</button></form></div></section>;
}
