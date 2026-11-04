import { Disclosure, Alert } from "./Surfaces";
import { Field, Input, Button, Select, Textarea } from "./Controls";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { ChannelStatus, Segment, SendResult } from "../../../runtime/src/channels/types";
export { QQConnection as Channels } from "./QQConnection";
const labels:Record<string,string>={sent:'已发送',sending:'正在发送',queued:'等待发送',unknown:'发送结果未知，请在 QQ 核实，勿重复发送',failed:'发送失败',blocked:'发送已阻止',revoked:'发送权限已撤销',interrupted:'已中断'};
interface Delivery {id:string;target:string;status:string;createdAt:string;proactive:boolean}
export function QQMessages({fail}:{fail:(e:unknown)=>void}){
  const [items,setItems]=useState<Delivery[]>([]),[audit,setAudit]=useState<{event:string;at:string}[]>([]),[channel,setChannel]=useState<ChannelStatus>(),[target,setTarget]=useState(''),[text,setText]=useState(''),[media,setMedia]=useState<Segment>(),[mediaName,setMediaName]=useState(''),[busy,setBusy]=useState(false),[result,setResult]=useState('');
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
    const [c,d,a]=await Promise.all([api<ChannelStatus>('/v1/channels/qq'),api<Delivery[]>('/v1/channels/qq/deliveries'),api<{event:string;at:string}[]>('/v1/channels/qq/audit')]);
    setChannel(c);setItems(d.filter(item=>item.proactive));setAudit(a);
  },[]);
  useEffect(()=>{void refresh().catch(fail);const timer=setInterval(()=>void refresh().catch(fail),3000);return()=>clearInterval(timer);},[refresh,fail]);
  const config=channel?.config;
  const targets=config?[{value:`private:${config.ownerId}`,label:`主人 · ${config.ownerId}`},...(config.friendIds??[]).filter(id=>id!==config.ownerId).map(id=>({value:`private:${id}`,label:`好友 · ${id}`})),...config.groups.map(id=>({value:`group:${id}`,label:`群 · ${id}`}))]:[];
  const selected=targets.some(item=>item.value===target)?target:targets[0]?.value??'';
  const submit=async()=>{
    if(acting.current)return;acting.current=true;setBusy(true);setResult('正在发送…');
    try{
      const [kind,id]=selected.split(':');
      const sent=await api<SendResult>('/v1/channels/qq/send','POST',{target:{kind,id},segments:[...(text?[{type:'text',data:{text}}]:[]),...(media?[media]:[])]});
      setResult(labels[sent.status]??'请查看发送记录');
      if(sent.status==='sent'){setText('');setMedia(undefined);setMediaName('');if(file.current)file.current.value='';}
      await refresh();
    }catch(error){setResult('未取得发送结果，请先查看记录或在 QQ 核实，勿重复发送。');fail(error);}
    finally{acting.current=false;setBusy(false);}
  };
  return <section>
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
    <Disclosure title="发送记录">
      {!items.length&&<p className="muted">暂无主动消息</p>}
      <div className="qq-history">{items.map(item=>{const to=JSON.parse(item.target) as {kind:string;id:string};return <div key={item.id}><span>{to.kind==='group'?'群':'私聊'} {to.id} · {labels[item.status]??item.status}</span><time>{new Date(item.createdAt).toLocaleString()}</time></div>;})}</div>
    </Disclosure>
    <Disclosure title="操作记录">{audit.map((item,index)=><p key={index}>{item.at} · {item.event}</p>)}</Disclosure>
  </section>;
}
