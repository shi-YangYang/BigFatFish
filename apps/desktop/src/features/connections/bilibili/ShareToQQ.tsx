import { useEffect, useRef, useState } from "react";
import { api } from "../../../api/client";
import { errorText } from "../../../api/errors";
import { ActionRow, Button, Field, Select } from "../../../components/Controls";
import { Alert, Loading } from "../../../components/Surfaces";
import { Drawer } from "../../../components/UI";
import type { VideoTask } from "../../../../../runtime/src/bilibili/service";
import type { ChannelStatus, Target } from "../../../../../runtime/src/channels/types";
import type { QQContact } from "../../../../../runtime/src/channels/managed/types";

type Recipient = {key:string;label:string;target:Target};
interface Contacts {accountId?:string;friends:QQContact[];groups:QQContact[]}
type Permissions = {owner: string; account: string; revision:string; recipients:Recipient[]; unavailable?:string};

function choices(status:ChannelStatus):Permissions {
  const config=status.config;
  const unavailable=!config?.enabled||status.health.state!=="online" ? "先连接 QQ，再分享观看结果。"
    : !config.proactiveEnabled ? "请在 QQ 回复设置中开启「允许主动消息」。" : undefined;
  const recipients:Recipient[]=config?.ownerId?[{key:"private:"+config.ownerId,label:"主人 · "+config.ownerId,target:{kind:"private",id:config.ownerId}}]:[];
  for(const id of new Set(config?.groups??[])) recipients.push({key:"group:"+id,label:"群聊 · "+id,target:{kind:"group",id}});
  return {owner:config?.ownerId??"",account:config?.accountId??"",revision:status.revision,recipients,unavailable:unavailable||(!recipients.length?"请先在 QQ 设置主人或允许分享的群。":undefined)};
}
export function ShareToQQ({task,close,sent,onConfigureQQ}:{task:VideoTask;close:()=>void;sent:(message:string)=>void;onConfigureQQ?:()=>void}){
  const [scope,setScope]=useState<Permissions>(),[selected,setSelected]=useState(""),[error,setError]=useState(""),[readAttempt,setReadAttempt]=useState(0),[sending,setSending]=useState(false);
  const pending=useRef(false),alive=useRef(true);
  useEffect(()=>{alive.current=true;let current=true;
    void api<ChannelStatus>("/v1/channels/qq").then(status=>{
      if(!current)return;const state=choices(status);setScope(state);setSelected(state.recipients[0]?.key??"");setError("");
      // Contacts decorate only already-authorized IDs; they never grant a recipient.
      if(status.config?.mode==="managed"&&!state.unavailable)void api<Contacts>("/v1/channels/qq/component/contacts").then(list=>{
        if(!current||list.accountId!==state.account)return;
        const recipients=state.recipients.map(recipient=>{const privateChat=recipient.target.kind==="private";
          const contact=(privateChat?list.friends:list.groups)?.find(item=>item.id===recipient.target.id);
          return contact?{...recipient,label:(privateChat?"主人 · ":"群聊 · ")+contact.name+" · "+contact.id}:recipient;});
        setScope({...state,recipients});
      }).catch(()=>{});
    }).catch(()=>{if(current)setError("暂时无法读取 QQ 分享对象。");});
    return()=>{current=false;alive.current=false;};
  },[readAttempt]);
  const recipient=scope?.recipients.find(item=>item.key===selected);
  async function share(){
    if(!scope||scope.unavailable||!recipient||pending.current)return;
    pending.current=true;setSending(true);setError("");
    try{
      const latest=choices(await api<ChannelStatus>("/v1/channels/qq"));
      if(latest.unavailable||latest.account!==scope.account||latest.revision!==scope.revision||!latest.recipients.some(item=>item.key===selected)){
        if(alive.current){setScope(latest);setSelected("");setError("QQ 设置已变化，请重新确认分享对象。");}return;
      }
      const r=await api<{status:string;error?:string}>(`/v1/bilibili/tasks/${task.id}/share`,"POST",{target:recipient.target});
      if(alive.current)sent(r.status==="sent"?"已分享到 QQ。":r.status==="unknown"?"发送结果未知，请在 QQ 核实，勿重复发送。":`分享未发送成功。${r.error?errorText(r.error):""}`);
    }catch(e){if(alive.current)setError(errorText(e));}
    finally{pending.current=false;if(alive.current)setSending(false);}
  }
  return <Drawer title="分享到 QQ" close={()=>{if(!pending.current)close();}}>
    <form onSubmit={e=>{e.preventDefault();void share();}}>
      <p>{task.result?.evidence.title||task.bvid}</p>
      {!scope&&!error&&<Loading>正在读取 QQ 分享对象…</Loading>}
      {error&&<Alert>{error}</Alert>}
      {!scope&&error&&<Button onClick={()=>{setError("");setReadAttempt(n=>n+1);}}>重试</Button>}
      {scope?.unavailable ? <><p>{scope.unavailable}</p>{onConfigureQQ&&<Button onClick={onConfigureQQ}>前往 QQ 设置</Button>}</>
        : scope&&<Field>分享对象<Select required value={selected} disabled={sending} onValueChange={setSelected}>
          <option value="">选择分享对象</option>{scope.recipients.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}
        </Select></Field>}
      <ActionRow><Button variant="primary" type="submit" disabled={sending||!!scope?.unavailable||!recipient} busy={sending}>确认分享</Button></ActionRow>
    </form>
  </Drawer>;
}
