import {RefreshCw} from 'lucide-react';
import {QQStickers} from './QQStickers';
import {Tabs} from './UI';
import { useCallback,useEffect,useRef,useState,type ReactNode } from 'react';
import { activeQQMode, qqStatus } from './connection-status';
import { ConnectionReadError } from './ConnectionReadError';
import { api, errorText } from '../api';
import { ContentScroll, Menu, Card,Badge,Alert } from './Surfaces';
import { Button,Field,Input,Checkbox,Select,ActionRow,FormGrid } from './Controls';
import type { ChannelStatus,QQConfig } from '../../../runtime/src/channels/types';
import type { ManagedQQStatus,QQContact } from '../../../runtime/src/channels/managed/types';
const endpoint='/v1/channels/qq/component';
const initial:QQConfig={url:'ws://127.0.0.1:3001',accountId:'',ownerId:'',friendIds:[],groupReplyMode:'all',groups:[],enabled:false,replyEnabled:true,proactiveEnabled:false};
const errors:Record<string,string>={CONNECTION_INIT_FAILED:'无法初始化连接，请检查地址和凭据。',TOKEN_REJECTED:'连接凭据被拒绝，请核对 NapCat 中的 Token。',ACCOUNT_MISMATCH:'登录的 QQ 与配置不一致，请核对账号。',HEALTH_CHECK_FAILED:'无法确认 QQ 在线状态，请检查 NapCat。',CHANNEL_VERSION_CONFLICT:'回复设置已在其他地方更新，请重新打开页面后修改。',QQ_ACCOUNT_CHANGED:'登录账号已变化，请重新核对回复设置。',QQ_DOCKER_MISSING:'请先安装并启动 Docker Desktop，再重试。',QQ_DOCKER_FAILED:'无法使用 Docker，请确认它已启动，再重试。',QQ_DOCKER_LOCAL_REQUIRED:'请选择本机 Docker 环境。',QQ_DOCKER_LINUX_REQUIRED:'请将 Docker 切换为 Linux 容器。',QQ_PLATFORM_UNSUPPORTED:'此系统暂不支持内置组件，可连接已有服务。',QQ_COMPONENT_UNAVAILABLE:'QQ 组件暂时没有响应，请重新启动。',QQ_COMPONENT_START_FAILED:'QQ 组件未能启动，请重试。',QQ_COMPONENT_AUTH:'QQ 组件认证失败，请重新启动。',QQ_COMPONENT_REQUEST_FAILED:'QQ 组件未能完成操作，请重试。',QQ_COMPONENT_CHECKSUM:'组件校验失败，请重新准备。',QQ_COMPONENT_DOWNLOAD:'下载失败，请检查网络后重试。',QQ_COMPONENT_STATE_INVALID:'组件状态文件无效，请保留数据并修复安装。',QQ_COMPONENT_INSTALL_INVALID:'组件安装不完整，请重新准备。',QQ_COMPONENT_OWNERSHIP:'发现不属于当前数据目录的组件，已停止操作。',QQ_EXTERNAL_ACTIVE:'请先停用已有服务连接，再启动内置组件。',QQ_LOGIN_FAILED:'QQ 登录未完成，请刷新二维码并在手机上完成验证。'};
function qqError(error: unknown) {
 const code = error instanceof Error ? error.message : String(error);
 return errors[code] ?? errorText(error);
}
interface Lists {friends:QQContact[];groups:QQContact[];accountId?:string;error?:string}
export function QQConnection({fail,children}:{fail:(error:unknown)=>void;children?:ReactNode}){
 const [channel,setChannel]=useState<ChannelStatus>(),[component,setComponent]=useState<ManagedQQStatus>(),[lists,setLists]=useState<Lists>({friends:[],groups:[]}),[mode,setMode]=useState<'managed'|'external'>('managed'),[tab,setTab]=useState('回复设置'),[form,setForm]=useState<QQConfig>(initial),[revision,setRevision]=useState(''),[token,setToken]=useState(''),[manualOwner,setManualOwner]=useState(false),[manualFriends,setManualFriends]=useState(''),[manualFriendsMode,setManualFriendsMode]=useState(false),[manualGroups,setManualGroups]=useState(''),[busy,setBusy]=useState(false),[contactsRefreshing,setContactsRefreshing]=useState(false),[loadError,setLoadError]=useState(false);
 const [actionError,setActionError]=useState<string>(),[contactsError,setContactsError]=useState<string>();
 const lastAction=useRef('');
 const draftMode=useRef<'managed'|'external'>('managed'),contactsPending=useRef(false),contactsSequence=useRef(0);
 const initialized=useRef(false),editing=useRef(false),alive=useRef(true),pending=useRef(false),refreshSequence=useRef(0),accountSeen=useRef(''),savePending=useRef<string|undefined>(undefined);
 const refresh=useCallback(async()=>{
  const sequence=++refreshSequence.current,contactSequence=contactsSequence.current;
  const [channelResult,componentResult,contactsResult]=await Promise.allSettled([api<ChannelStatus>('/v1/channels/qq'),api<ManagedQQStatus>(endpoint),api<Lists>(endpoint+'/contacts')]);
  if(!alive.current||sequence!==refreshSequence.current)return;
  if(channelResult.status==='rejected'){setLoadError(true);return;}
  const c=channelResult.value,m=componentResult.status==='fulfilled'?componentResult.value:undefined;
  if(!initialized.current){draftMode.current=activeQQMode(c,m);setMode(draftMode.current);}
  setChannel(c);
  if(!m&&draftMode.current==='managed'){setLoadError(true);return;}
  setComponent(m);setLoadError(false);
  const l=contactsResult.status==='fulfilled'?contactsResult.value:undefined;
  const accountChanged=draftMode.current==='managed'&&!!m?.account&&m.account.id!==accountSeen.current;
  if(accountChanged||(!contactsPending.current&&contactSequence===contactsSequence.current)){
   if(l)setLists(l.accountId===m?.account?.id?l:{friends:[],groups:[]});
   else setLists(previous=>({...(accountChanged?{friends:[],groups:[]}:previous),error:'QQ_CONTACTS_UNAVAILABLE'}));
   if(accountChanged)setContactsError(undefined);
  }
  accountSeen.current=m?.account?.id??'';
  const saved=savePending.current!==undefined&&!!m&&!m.busy&&!m.error&&!m.operationError&&c.revision!==savePending.current;
  if(!editing.current||saved||accountChanged){
   const sameMode=c.config&&(c.config.mode==='managed'?'managed':'external')===draftMode.current;
   const next=sameMode&&!(draftMode.current==='managed'&&m?.account&&c.config!.accountId!==m.account.id)?c.config!:initial;
   setForm(next);setRevision(c.revision);setManualGroups(next.groups.join(','));setManualFriends(next.friendIds?.join(',')??'');
   if(saved||accountChanged){editing.current=false;savePending.current=undefined;}
  }
  initialized.current=true;
 },[]);
 useEffect(()=>{alive.current=true;void refresh();let active=true;const timer=setInterval(()=>{if(active)void refresh();},2500);return()=>{active=false;alive.current=false;clearInterval(timer);};},[refresh]);
 useEffect(()=>setActionError(undefined),[channel?.revision,channel?.health.state,component?.phase,component?.loginPhase]);
 const change=(patch:Partial<QQConfig>)=>{editing.current=true;setForm({...form,...patch});};
 const changeFriends=(value:string[]|string)=>{const text=typeof value==='string'?value:value.join(',');setManualFriends(text);change({friendIds:text.split(/[,，\s]+/).filter(Boolean)});};
 const act=async(path:string,method='POST',body?:unknown)=>{
  if(pending.current)return;pending.current=true;setBusy(true);setActionError(undefined);lastAction.current=path;++refreshSequence.current;
  try{
   await api(path,method,body);
   if(path.endsWith('/settings'))savePending.current=revision;
   else if(path==='/v1/channels/qq'){editing.current=false;setToken('');}
   await refresh();
  }catch(error){if(alive.current)setActionError(qqError(error));}finally{pending.current=false;setBusy(false);}
 };
 const refreshContacts=async()=>{
  if(pending.current||component?.phase!=='online'||!component.account)return;
  const accountId=component.account.id;pending.current=true;contactsPending.current=true;contactsSequence.current++;setBusy(true);setContactsRefreshing(true);setContactsError(undefined);
  try{
   const next=await api<Lists>(endpoint+'/contacts/refresh','POST');
   if(alive.current&&draftMode.current==='managed'&&accountSeen.current===accountId&&next.accountId===accountId)setLists(next);
  }catch{if(alive.current&&draftMode.current==='managed'&&accountSeen.current===accountId)setContactsError(errorText('QQ_CONTACTS_UNAVAILABLE'));}
  finally{contactsSequence.current++;contactsPending.current=false;pending.current=false;if(alive.current){setBusy(false);setContactsRefreshing(false);}}
 };
 const locked=busy||component?.busy;
 const matchingAccount=channel?.config?.mode==='managed'&&channel.config.accountId===component?.account?.id;
 const switchMode=()=>{draftMode.current=mode==='managed'?'external':'managed';setMode(draftMode.current);setTab('回复设置');setActionError(undefined);lastAction.current='';editing.current=false;savePending.current=undefined;setToken('');setForm(initial);setManualFriends('');setManualGroups('');void refresh();};
 const feedback=channel?qqStatus(mode,channel,component):{label:'正在读取…'};
 const statusLabel=loadError?'状态待更新':feedback.label;
 const currentError=feedback.error?qqError(feedback.error):undefined;
 const readError=loadError&&<ConnectionReadError retry={refresh}/>;
 // Login progress supersedes a failed QR refresh, but it cannot confirm a settings save.
 const settingsError=component?.phase==='online'&&lastAction.current.endsWith('/settings')
  ? actionError||(component.operationError&&qqError(component.operationError)) : undefined;
 const connectionErrors=[...new Set([currentError,settingsError?undefined:actionError].filter(Boolean))];
 const alerts=connectionErrors.map(message=><Alert key={message}>{message}</Alert>);
 return <section className="page-section qq-connection">
  {mode==='managed'&&<>
   <Card className={`qq-account-card${component?.phase==='online'?' qq-account-online':''}`}>
    <div className="qq-account-heading"><div><h2>QQ{component?.account?.name && <span className="account-name"> · {component.account.name}</span>}</h2>{component?.account&&<p className="muted">{component.account.id}</p>}</div><div className="account-status"><Badge>{statusLabel}</Badge></div></div>
    {readError}
    {component&&!component.supported&&<Alert>此系统暂不支持内置组件，请使用已有服务。</Alert>}
    {feedback.qr&&<div className="qq-login-code"><img src={feedback.qr} alt="QQ 登录二维码"/><p>使用手机 QQ 扫码，并确认登录</p></div>}
    {alerts}
    <ActionRow className="qq-connect-actions">
     {component&&!component.busy&&['missing','ready','error'].includes(component.phase)&&<Button variant="primary" disabled={busy||!component.supported} onClick={()=>void act(endpoint+'/connect')}>{component.phase==='error'?'重试连接':'连接 QQ'}</Button>}
     {component?.phase==='online'&&matchingAccount&&!channel?.config?.enabled&&<Button variant="primary" disabled={locked} onClick={()=>void act(endpoint+'/connect')}>重新连接</Button>}
     {component?.phase==='login'&&<Button disabled={locked} onClick={()=>void act(endpoint+'/refresh')}>刷新二维码</Button>}
     {component&&['starting','login','online','error','installing'].includes(component.phase)&&<Button disabled={busy||component.phase==='stopping'} onClick={()=>void act(endpoint+'/stop')}>{component.busy?'取消连接':'断开连接'}</Button>}
     {!component?.busy&&component?.phase!=='online'&&<Button variant="ghost" disabled={busy} onClick={switchMode}>连接已有服务</Button>}
     {component?.phase==='online'&&<Menu trigger={<Button variant="ghost" disabled={locked}>连接选项</Button>}><Button variant="ghost" disabled={locked} onClick={switchMode}>连接已有服务</Button></Menu>}
    </ActionRow>
    {component?.phase==='missing'&&<p className="muted">首次连接需下载 QQ 组件。{component.engine==='docker'?'请先启动 Docker。':''}</p>}
   </Card>
  </>}
  {mode==='external'&&<Card><div className="qq-method-heading"><div><h2>QQ</h2><Badge>{statusLabel}</Badge></div><Button variant="ghost" disabled={locked} onClick={switchMode}>使用扫码登录</Button></div>
   {readError}{alerts}
  </Card>}
  <Tabs items={['回复设置','表情','消息']} value={tab} onChange={setTab} label="QQ 设置">
   {tab==='回复设置'&&(mode==='managed'?<>
   {component?.account&&component.phase==='online'&&<Card className="qq-reply-card"><form onSubmit={event=>{event.preventDefault();void act(endpoint+'/settings','PUT',{revision,accountId:component.account!.id,ownerId:form.ownerId,friendIds:form.friendIds??[],groupReplyMode:form.groupReplyMode??'all',groups:form.groups,replyEnabled:form.replyEnabled,proactiveEnabled:form.proactiveEnabled});}}>
    <fieldset disabled={locked}>
     <div className="qq-reply-heading">
      <h3>回复设置</h3>
      <div className="qq-reply-heading-actions"><Field className="check"><Checkbox checked={form.replyEnabled} onCheckedChange={replyEnabled=>change({replyEnabled})}/>自动回复</Field><Button size="icon" variant="ghost" aria-label="刷新好友和群聊" title="刷新好友和群聊" aria-busy={contactsRefreshing} disabled={locked} onClick={()=>void refreshContacts()}><RefreshCw size={18} aria-hidden="true"/></Button></div>
     </div>
     {contactsError&&<Alert>{contactsError}</Alert>}
     <div className="qq-owner-row">
      {lists.friends.length>0&&!manualOwner?<Field>主人 QQ<Select required value={form.ownerId} onValueChange={ownerId=>change({ownerId})}><option value="">选择主人 QQ</option>{lists.friends.map(friend=><option key={friend.id} value={friend.id}>{friend.name} · {friend.id}</option>)}</Select></Field>:<Field>主人 QQ 号<Input required inputMode="numeric" value={form.ownerId} onChange={event=>change({ownerId:event.target.value})}/></Field>}
      {lists.friends.length>0&&<Button variant="ghost" onClick={()=>setManualOwner(!manualOwner)}>{manualOwner?'从好友中选择':'手动输入 QQ 号'}</Button>}
     </div>
     <div className="qq-reply-options">
      <section className="qq-settings-group"><div className="qq-group-heading"><h4>可私聊的好友</h4><span className="qq-setting-hint">已选 {(form.friendIds??[]).filter(id=>id!==form.ownerId).length} 位</span></div>
       {lists.friends.length>0&&!manualFriendsMode?<ContentScroll label="可私聊的好友" className="qq-group-list">{lists.friends.filter(friend=>friend.id!==form.ownerId&&friend.id!==component?.account?.id).map(friend=><Field className="check" key={friend.id}><Checkbox checked={(form.friendIds??[]).includes(friend.id)} onCheckedChange={checked=>changeFriends(checked?[...(form.friendIds??[]),friend.id]:(form.friendIds??[]).filter(id=>id!==friend.id))}/>{friend.name} · {friend.id}</Field>)}</ContentScroll>:<Field>可私聊的 QQ 号<Input placeholder="多个 QQ 号用逗号分隔，可留空" value={manualFriends} onChange={e=>changeFriends(e.target.value)}/></Field>}
       {lists.friends.length>0&&<Button className="qq-friends-manual-toggle" variant="ghost" onClick={()=>setManualFriendsMode(!manualFriendsMode)}>{manualFriendsMode?'从好友列表选择':'手动填写好友 QQ 号'}</Button>}
      </section>
      <section className="qq-settings-group"><div className="qq-group-heading"><h4>群聊回复</h4><span className="qq-setting-hint">{form.groups.length?`已选 ${form.groups.length} 个群`:'未选择'}</span></div>
       <Field>群聊触发方式<Select value={form.groupReplyMode??'all'} onValueChange={value=>change({groupReplyMode:value as QQConfig['groupReplyMode']})}><option value="all">普通消息也回复</option><option value="mention">仅被 @ 时回复</option></Select></Field>
       {lists.groups.length?<ContentScroll label="允许回复的群" className="qq-group-list">{lists.groups.map(group=><Field className="check" key={group.id}><Checkbox checked={form.groups.includes(group.id)} onCheckedChange={checked=>change({groups:checked?[...form.groups,group.id]:form.groups.filter(id=>id!==group.id)})}/>{group.name} · {group.id}</Field>)}</ContentScroll>:<Field>允许回复的群号<Input placeholder="多个群号用逗号分隔，可留空" value={manualGroups} onChange={event=>{setManualGroups(event.target.value);change({groups:event.target.value.split(/[,，\s]+/).filter(Boolean)});}}/></Field>}
       {lists.error&&lists.groups.length===0&&<p className="muted">暂时无法读取群列表，可填写群号。</p>}
      </section>
      <div className="qq-proactive-row"><Field className="check"><Checkbox checked={form.proactiveEnabled} onCheckedChange={proactiveEnabled=>change({proactiveEnabled})}/>允许主动消息</Field></div>
     </div>
     {settingsError&&<Alert>{settingsError}</Alert>}
     <ActionRow className="qq-reply-actions"><Button type="submit" variant="primary">{matchingAccount&&channel?.config?.enabled?'保存设置':'保存并连接'}</Button></ActionRow>
    </fieldset>
   </form></Card>}
   {!component?.account&&<p className="muted">连接 QQ 后设置回复范围</p>}
  </>:<Card><form onSubmit={event=>{event.preventDefault();void act('/v1/channels/qq','PUT',{...form,mode:'external',enabled:true,revision,groups:manualGroups.split(/[,，\s]+/).filter(Boolean),...(token?{token}:{})});}}>
   <fieldset disabled={locked}>
    <FormGrid><Field>服务地址<Input required value={form.url} onChange={e=>change({url:e.target.value})}/></Field><Field>连接凭据<Input type="password" autoComplete="off" value={token} placeholder={channel?.hasToken?'已保存，留空不变':'可选'} onChange={e=>setToken(e.target.value)}/></Field></FormGrid>
    <FormGrid><Field>机器人 QQ 号<Input required value={form.accountId} onChange={e=>change({accountId:e.target.value})}/></Field><Field>主人 QQ 号<Input required value={form.ownerId} onChange={e=>change({ownerId:e.target.value})}/></Field></FormGrid>
    <Field>可私聊的好友 QQ 号<Input placeholder="多个 QQ 号用逗号分隔，可留空" value={manualFriends} onChange={e=>changeFriends(e.target.value)}/></Field>
    <Field>群聊触发方式<Select value={form.groupReplyMode??'all'} onValueChange={value=>change({groupReplyMode:value as QQConfig['groupReplyMode']})}><option value="all">普通消息也回复</option><option value="mention">仅被 @ 时回复</option></Select></Field>
    <Field>允许回复的群号<Input placeholder="多个群号用逗号分隔，可留空" value={manualGroups} onChange={e=>{editing.current=true;setManualGroups(e.target.value);}}/></Field>
    <Field className="check"><Checkbox checked={form.replyEnabled} onCheckedChange={replyEnabled=>change({replyEnabled})}/>自动回复</Field>
    <div className="qq-proactive-row"><Field className="check"><Checkbox checked={form.proactiveEnabled} onCheckedChange={proactiveEnabled=>change({proactiveEnabled})}/>允许主动消息</Field></div>
    <ActionRow><Button type="submit" variant="primary">保存并连接</Button>{channel?.config?.enabled&&channel.config.mode!=='managed'&&<Button onClick={()=>void act('/v1/channels/qq/stop')}>停用连接</Button>}</ActionRow>
   </fieldset>
  </form></Card>)}
   {tab==='表情'&&<QQStickers fail={fail}/>}
   {tab==='消息'&&<div className="qq-messages-panel">{children}</div>}
  </Tabs>
 </section>;
}
