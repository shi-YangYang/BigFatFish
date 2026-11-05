import {QQDeliveryHistory} from './QQDeliveryHistory';
import {deliveryFeedback,qqAuditText,sendFailureFeedback,type QQDelivery} from './qq-feedback';
import { Card, Alert } from "./Surfaces";
import { Field, Input, Button, Select, Textarea } from "./Controls";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { ChannelStatus, Segment, SendResult } from "../../../runtime/src/channels/types";
export { QQConnection as Channels } from "./QQConnection";
export function QQMessages({fail}:{fail:(e:unknown)=>void}){
  const [items,setItems]=useState<QQDelivery[]>([]),[audit,setAudit]=useState<{event:string;at:string}[]>([]),[channel,setChannel]=useState<ChannelStatus>(),[target,setTarget]=useState(''),[text,setText]=useState(''),[media,setMedia]=useState<Segment>(),[mediaName,setMediaName]=useState(''),[busy,setBusy]=useState(false),[historyError,setHistoryError]=useState(false),[result,setResult]=useState('');
  const alive=useRef(true),sequence=useRef(0);
  const acting=useRef(false),file=useRef<HTMLInputElement>(null);
  const selectMedia = async (file: File | undefined) => {
    setMedia(undefined);
    setMediaName("");
    if (!file) return;
    if (file.size > 2_000_000) throw new Error("MEDIA_TOO_LARGE");
    const type = file.type.startsWith("image/")
      ? "image"
      : file.type === "audio/wav" || file.name.toLowerCase().endsWith(".wav")
        ? "record"
        : /\.(txt|pdf)$/i.test(file.name)
          ? "file"
          : undefined;
    if (!type) throw new Error("UNSUPPORTED_MEDIA_FORMAT");
    const data = new Uint8Array(await file.arrayBuffer());
    let value = "";
    for (const byte of data) value += String.fromCharCode(byte);
    setMedia({
      type,
      data: {
        file: "base64://" + btoa(value),
        ...(type === "file" ? { name: file.name } : {}),
      },
    });
    setMediaName(file.name);
    if (type === "file") setText("");
  };
  const refresh=useCallback(async()=>{
    const n=++sequence.current;
    const [c,d,a]=await Promise.all([api<ChannelStatus>('/v1/channels/qq'),api<QQDelivery[]>('/v1/channels/qq/deliveries'),api<{event:string;at:string}[]>('/v1/channels/qq/audit')]);
    if(!alive.current||n!==sequence.current)return;
    setChannel(c);setItems(d);setAudit(a);setHistoryError(false);return d;
  },[]);
  useEffect(()=>{alive.current=true;let active=true,timer:ReturnType<typeof setTimeout>;const poll=async()=>{try{await refresh();}catch{if(active)setHistoryError(true);}finally{if(active)timer=setTimeout(()=>void poll(),3000);}};void poll();return()=>{active=false;alive.current=false;++sequence.current;clearTimeout(timer);};},[refresh]);
  const config=channel?.config;
  const targets=config?[{value:`private:${config.ownerId}`,label:`主人 · ${config.ownerId}`},...(config.friendIds??[]).filter(id=>id!==config.ownerId).map(id=>({value:`private:${id}`,label:`好友 · ${id}`})),...config.groups.map(id=>({value:`group:${id}`,label:`群 · ${id}`}))]:[];
  const selected=targets.some(item=>item.value===target)?target:targets[0]?.value??'';
  const submit=async()=>{
    if(acting.current)return;acting.current=true;setBusy(true);setResult('正在发送…');
    try{
      const [kind,id]=selected.split(':');
      const sent=await api<SendResult>('/v1/channels/qq/send','POST',{target:{kind,id},segments:[...(text?[{type:'text',data:{text}}]:[]),...(media?[media]:[])]});
      if(!alive.current)return;
      const feedback=deliveryFeedback({...sent,proactive:true});setResult([feedback.label,feedback.detail].filter(Boolean).join('：'));
      if(sent.status==='sent'){setText('');setMedia(undefined);setMediaName('');if(file.current)file.current.value='';}
      try{const records=await refresh();const record=records?.find(item=>item.id===sent.id);if(record&&alive.current){const shown=deliveryFeedback(record);setResult([shown.label,shown.detail].filter(Boolean).join('：'));}}catch{if(alive.current)setHistoryError(true);}
    }catch(error){if(alive.current)setResult(sendFailureFeedback(error));}
    finally{acting.current=false;if(alive.current)setBusy(false);}
  };
  return <>{historyError&&<Alert>暂时无法更新消息记录<Button size="compact" onClick={()=>void refresh().catch(()=>setHistoryError(true))}>刷新</Button></Alert>}<Card><h3>自动回复记录</h3><QQDeliveryHistory items={items.filter(item=>!item.proactive).slice(0,20)} empty="暂无回复记录"/></Card><Card><h3>发送消息</h3>
    {!config?.proactiveEnabled&&<p className="muted">开启「允许主动消息」后可发送。</p>}
    <form onSubmit={event=>{event.preventDefault();void submit();}}>
      <fieldset disabled={busy||!config?.enabled||!config.proactiveEnabled}>
        <Field>发送对象<Select required value={selected} onValueChange={setTarget}>{targets.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</Select></Field>
        <Field>消息内容<Textarea disabled={media?.type==='file'} required={!media} maxLength={4000} value={text} onChange={event=>setText(event.target.value)}/></Field>
        <Field>图片、语音或文件（最多 2 MB）<Input ref={file} type="file" accept="image/png,image/jpeg,audio/wav,.wav,.txt,.pdf" onChange={event=>void selectMedia(event.target.files?.[0]).catch(fail)}/></Field>
        {mediaName&&<p className="muted">{mediaName}</p>}
        <Button type="submit" variant="primary" disabled={!selected||!text&&!media}>{busy?'正在发送…':'直接发送'}</Button>
      </fieldset>
    </form>
    {result&&<Alert role="status">{result}</Alert>}
    </Card><Card><h3>主动发送记录</h3><QQDeliveryHistory items={items.filter(item=>item.proactive)} empty="暂无主动消息"/></Card>
    <Card><h3>操作记录</h3><div className="qq-history">{audit.map((item,index)=><div key={index}><span>{qqAuditText(item.event)}</span><time>{new Date(item.at).toLocaleString()}</time></div>)}</div>{!audit.length&&<p className="muted">暂无操作记录</p>}</Card>
  </>;
}
