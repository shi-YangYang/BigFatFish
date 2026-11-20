import { PlatformAccount, LoginPrompt, WatchPlanPrompt } from '../shared/PlatformSurface';
import { PageStack } from '../../../components/PageLayout';
import { Alert, Loading, Menu } from "../../../components/Surfaces";
import { Button, Field, Input, ActionRow, FormGrid } from "../../../components/Controls";
import { OperationRecords } from "../shared/OperationRecords";
import { ShareToQQ } from './ShareToQQ';
import { Drawer } from '../../../components/UI';
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../../api/client";
import { errorText } from "../../../api/errors";
import type { VideoTask } from "../../../../../runtime/src/bilibili/service";
import { biliStatus, type BiliStatus } from '../shared/connection-status';
import { ConnectionReadError } from '../shared/ConnectionReadError';
const states:Record<string,string>={queued:'等待观看',running:'获取字幕与画面',understanding:'理解内容',completed:'已完成',partial:'部分完成',failed:'失败',cancelled:'已取消',interrupted:'服务中断'};
export function Bilibili({fail,onPlan,onConfigureQQ}:{fail:(e:unknown)=>void;onPlan?:()=>void;onConfigureQQ?:()=>void}){
 const [status,setStatus]=useState<BiliStatus>(),[tasks,setTasks]=useState<VideoTask[]>(),[recordsError,setRecordsError]=useState<string>(),[busy,setBusy]=useState(false),[busyAction,setBusyAction]=useState(''),[settingsOpen,setSettingsOpen]=useState(false),[cookie,setCookie]=useState(''),[csrf,setCsrf]=useState(''),[notice,setNotice]=useState('');
 const [sharing,setSharing]=useState<VideoTask>();
 const [readError,setReadError]=useState(false),[actionError,setActionError]=useState(''),[settingsError,setSettingsError]=useState('');
 useEffect(()=>setActionError(''),[status?.connection?.phase,status?.revision]);
 const [optionsOpen,setOptionsOpen]=useState(false);
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
 const run=async(action:string,fn:()=>Promise<unknown>,onError=(e:unknown)=>setActionError(errorText(e)))=>{if(pending.current)return;pending.current=true;setBusyAction(action);setBusy(true);setNotice('');setActionError('');++sequence.current;try{await fn();if(alive.current)await reload();}catch(e){if(alive.current)onError(e);}finally{pending.current=false;if(alive.current)setBusy(false);}};
 const readWarning=readError&&<ConnectionReadError retry={reload}/>;
 if(!status)return <PlatformAccount platform="B站">{readWarning||<Loading/>}</PlatformAccount>;
 const {label,error,connecting,connected}=biliStatus(status),connection=status.connection;
 const locked=busy||connecting,login=connection?.phase==='login'?connection.login:undefined;
 const canPlan=!readError&&!error&&!connecting&&(connected||status.enabled&&status.accountState==='anonymous');
 const failure=actionError||(error&&errorText(error));
 return <PageStack className="platform-connection">
  <PlatformAccount platform="B站" name={status.account?.name} accountId={status.account?.mid ? String(status.account.mid) : undefined} status={readError?'状态待更新':label}>
   {readWarning}
   {failure&&<Alert>{failure}</Alert>}
   {login?.image&&login.status!=='scanned'&&<LoginPrompt code={login.image} alt="B站登录二维码" instruction="使用手机 B站扫码"/>}
   <ActionRow className="platform-connect-actions">
    {!connected&&!connecting&&<Button variant="primary" busy={busy&&busyAction==='connect'} disabled={busy} onClick={()=>void run('connect',()=>api('/v1/bilibili/connect','POST',{revision:status.revision}))}>{connection?.phase==='expired'?'重新获取二维码':connection?.phase==='error'?'重试连接':'连接 B站'}</Button>}
    {(status.enabled||connecting)&&<Button busy={busy&&busyAction==='disconnect'} disabled={busy} onClick={()=>void run('disconnect',()=>api('/v1/bilibili/disconnect','POST'))}>{connecting?'取消连接':'断开连接'}</Button>}
    {!status.enabled&&!connecting&&<Button variant="ghost" busy={busy&&busyAction==='enable'} disabled={busy} onClick={()=>void run('enable',()=>api('/v1/bilibili','PUT',{enabled:true,anonymous:true,revision:status.revision}))}>匿名浏览</Button>}
    {!connecting&&<Menu open={optionsOpen} onOpenChange={setOptionsOpen} trigger={<Button variant="ghost" disabled={busy}>连接选项</Button>}><Button variant="ghost" onClick={()=>{setOptionsOpen(false);setSettingsError('');setSettingsOpen(true);}}>导入凭据</Button></Menu>}
   </ActionRow>
  </PlatformAccount>
  {canPlan&&tasks?.length===0&&!recordsError&&onPlan ? <WatchPlanPrompt platform="B站" onPlan={onPlan}/> :
   (!!tasks?.length||canPlan||!!recordsError)&&<OperationRecords error={recordsError} records={tasks?.map(t=>({
   id:t.id,action:'观看视频',title:t.result?.evidence.title||t.bvid,status:states[t.status]??'状态未知',createdAt:t.createdAt,
   error:t.error?errorText(t.error):undefined,
   actions:['queued','running','understanding'].includes(t.status)?
    <Button size="compact" busy={busy&&busyAction==='cancel-'+t.id} disabled={busy} onClick={()=>void run('cancel-'+t.id,()=>api(`/v1/bilibili/tasks/${t.id}/cancel`,'POST'),fail)}>取消任务</Button>:
    ['completed','partial'].includes(t.status)&&t.result?.summary?
    <Button size="compact" disabled={busy} onClick={()=>{setSharing(t);setNotice('');}}>分享到 QQ</Button>:undefined,
  }))}>{notice&&<Alert variant="info" role="status">{notice}</Alert>}</OperationRecords>}

  {sharing&&<ShareToQQ task={sharing} close={()=>setSharing(undefined)} onConfigureQQ={onConfigureQQ} sent={text=>{setSharing(undefined);setNotice(text);}}/>}
  {settingsOpen&&<Drawer title="导入凭据" close={()=>{if(!busy)setSettingsOpen(false);}}>
   {settingsError&&<Alert>{settingsError}</Alert>}
   <form onSubmit={event=>{event.preventDefault();setSettingsError('');void run('credentials',async()=>{
    await api('/v1/bilibili/connect','POST',{revision:status.revision,credentials:{sessdata:cookie,bili_jct:csrf}});
    if(alive.current){setCookie('');setCsrf('');setSettingsOpen(false);}
   },e=>setSettingsError(errorText(e)));}}><fieldset disabled={locked}>
   <FormGrid><Field>SESSDATA<Input required type="password" autoComplete="off" value={cookie} onChange={e=>setCookie(e.target.value)}/></Field><Field>bili_jct<Input required type="password" autoComplete="off" value={csrf} onChange={e=>setCsrf(e.target.value)}/></Field></FormGrid>
   <ActionRow><Button type="submit" variant="primary" busy={busy&&busyAction==='credentials'}>验证并连接</Button>{status.hasCredentials&&<Button busy={busy&&busyAction==='logout'} onClick={()=>{setSettingsError('');void run('logout',async()=>{
    await api('/v1/bilibili/logout','POST');
    if(alive.current){setCookie('');setCsrf('');setSettingsOpen(false);}
   },e=>setSettingsError(errorText(e)));}}>退出登录</Button>}</ActionRow>
  </fieldset></form></Drawer>}
 </PageStack>;
}
