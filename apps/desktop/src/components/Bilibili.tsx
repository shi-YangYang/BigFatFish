import { Card, Alert, Badge, Loading } from "./Surfaces";
import { Button, Field, Input, Select, ActionRow, FormGrid } from "./Controls";
import { OperationRecords } from "./OperationRecords";
import { Tabs } from './UI';
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "../api";
import type { VideoTask } from "../../../runtime/src/bilibili/service";
import { biliStatus, type BiliStatus } from './connection-status';
import { ConnectionReadError } from './ConnectionReadError';
const states:Record<string,string>={queued:'等待观看',running:'获取字幕与画面',understanding:'理解内容',completed:'已完成',partial:'部分完成',failed:'失败',cancelled:'已取消',interrupted:'服务中断'};
export function Bilibili({fail}:{fail:(e:unknown)=>void}){
 const [status,setStatus]=useState<BiliStatus>(),[tasks,setTasks]=useState<VideoTask[]>(),[recordsError,setRecordsError]=useState<string>(),[busy,setBusy]=useState(false),[tab,setTab]=useState('记录'),[cookie,setCookie]=useState(''),[csrf,setCsrf]=useState(''),[target,setTarget]=useState(''),[kind,setKind]=useState('private'),[notice,setNotice]=useState('');
 const [readError,setReadError]=useState(false),[actionError,setActionError]=useState('');
 useEffect(()=>setActionError(''),[status?.connection?.phase,status?.revision]);
 const pending=useRef(false),alive=useRef(true),sequence=useRef(0);
 const reload=useCallback(async()=>{
  const n=++sequence.current,current=()=>alive.current&&n===sequence.current;
  await Promise.all([
   api<BiliStatus>('/v1/bilibili').then(s=>{if(current()){setStatus(s);setReadError(false);}},()=>{if(current())setReadError(true);}),
   api<VideoTask[]>('/v1/bilibili/tasks').then(t=>{if(current()){setTasks(t);setRecordsError(undefined);}},e=>{if(current())setRecordsError(errorText(e));}),
  ]);
 },[]);
 useEffect(()=>{
  alive.current=true;let active=true,timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{await reload();if(active)timer=setTimeout(()=>void poll(),2000);};
  void poll();
  return()=>{active=false;alive.current=false;++sequence.current;clearTimeout(timer);};
 },[reload]);
 const run=async(fn:()=>Promise<unknown>,onError=(e:unknown)=>setActionError(errorText(e)))=>{if(pending.current)return;pending.current=true;setBusy(true);setNotice('');setActionError('');++sequence.current;try{await fn();if(alive.current)await reload();}catch(e){if(alive.current)onError(e);}finally{pending.current=false;if(alive.current)setBusy(false);}};
 const readWarning=readError&&<ConnectionReadError retry={reload}/>;
 if(!status)return <Card className="platform-account-card"><h2>B站</h2>{readWarning||<Loading/>}</Card>;
 const {label,error,connecting,connected}=biliStatus(status),connection=status.connection;
 const locked=busy||connecting,login=connection?.phase==='login'?connection.login:undefined;
 const failure=actionError||(error&&errorText(error));
 return <section className="page-section platform-connection">
  <Card className="platform-account-card">
   <div className="platform-account-heading"><div><h2>B站{status.account?.name && <span className="account-name"> · {status.account.name}</span>}</h2>{status.account&&<p className="muted">{status.account.mid}</p>}</div><Badge>{readError?'状态待更新':label}</Badge></div>
   {readWarning}
   {failure&&<Alert>{failure}</Alert>}
   {login?.image&&login.status!=='scanned'&&<div className="platform-login-code"><img src={login.image} alt="B站登录二维码"/><p>使用手机 B站扫码</p></div>}
   <ActionRow className="platform-connect-actions">
    {!connected&&!connecting&&<Button variant="primary" disabled={busy} onClick={()=>void run(()=>api('/v1/bilibili/connect','POST',{revision:status.revision}))}>{connection?.phase==='expired'?'重新获取二维码':connection?.phase==='error'?'重试连接':'连接 B站'}</Button>}
    {(status.enabled||connecting)&&<Button disabled={busy} onClick={()=>void run(()=>api('/v1/bilibili/disconnect','POST'))}>{connecting?'取消连接':'断开连接'}</Button>}
    {!status.enabled&&!connecting&&<Button variant="ghost" disabled={busy} onClick={()=>void run(()=>api('/v1/bilibili','PUT',{enabled:true,revision:status.revision}))}>暂不登录</Button>}
    {!connecting&&<Button variant="ghost" disabled={busy} onClick={()=>setTab('设置')}>导入凭据</Button>}
   </ActionRow>
  </Card>
  <Tabs items={['记录','设置']} value={tab} onChange={setTab} label="B站功能">
  {tab==='记录'&&<OperationRecords error={recordsError} records={tasks?.map(t=>({
   id:t.id,action:'观看视频',title:t.result?.evidence.title||t.bvid,status:states[t.status]??'状态未知',createdAt:t.createdAt,
   error:t.error?errorText(t.error):undefined,
   actions:['queued','running','understanding'].includes(t.status)?
    <Button size="compact" disabled={busy} onClick={()=>void run(()=>api(`/v1/bilibili/tasks/${t.id}/cancel`,'POST'),fail)}>取消任务</Button>:
    ['completed','partial'].includes(t.status)&&t.result?.summary?
    <Button size="compact" disabled={busy||!target.trim()} onClick={()=>void run(async()=>{
     const result=await api<{status:string;error?:string}>(`/v1/bilibili/tasks/${t.id}/share`,'POST',{target:{kind,id:target.trim()}});
     if(alive.current)setNotice(result.status==='sent'?'已分享到 QQ。':result.status==='unknown'?'发送结果未知，请在 QQ 核实，勿重复发送。':`分享未发送成功。${result.error?errorText(result.error):''}`);
    },fail)}>分享到 QQ</Button>:undefined,
  }))}>
   <fieldset disabled={busy}>
    <FormGrid>
     <Field>QQ 分享对象<Select value={kind} onValueChange={setKind}><option value="private">主人私聊</option><option value="group">已授权群</option></Select></Field>
     <Field>接收 QQ 或群号<Input value={target} onChange={e=>setTarget(e.target.value)}/></Field>
    </FormGrid>
   </fieldset>
   {notice&&<Alert variant="info" role="status">{notice}</Alert>}
  </OperationRecords>}
  {tab==='设置'&&<Card><h3>导入凭据</h3><form onSubmit={event=>{event.preventDefault();void run(async()=>{await api('/v1/bilibili/connect','POST',{revision:status.revision,credentials:{sessdata:cookie,bili_jct:csrf}});if(alive.current){setCookie('');setCsrf('');}});}}><fieldset disabled={locked}>
   <FormGrid><Field>SESSDATA<Input required type="password" autoComplete="off" value={cookie} onChange={e=>setCookie(e.target.value)}/></Field><Field>bili_jct<Input required type="password" autoComplete="off" value={csrf} onChange={e=>setCsrf(e.target.value)}/></Field></FormGrid>
   <ActionRow><Button type="submit" variant="primary">验证并连接</Button>{status.hasCredentials&&<Button onClick={()=>void run(()=>api('/v1/bilibili/logout','POST'))}>退出登录</Button>}</ActionRow>
  </fieldset></form></Card>}
  </Tabs>
 </section>;
}
