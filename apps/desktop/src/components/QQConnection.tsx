import { useCallback,useEffect,useRef,useState,type ReactNode } from 'react';
import { api } from '../api';
import { Card,Disclosure,Badge,Alert,Loading } from './Surfaces';
import { Button,Field,Input,Checkbox,Select,ActionRow,FormGrid } from './Controls';
import type { ChannelStatus,QQConfig } from '../../../runtime/src/channels/types';
import type { ManagedQQStatus,QQContact } from '../../../runtime/src/channels/managed/types';
const endpoint='/v1/channels/qq/component';
const phaseLabels:Record<string,string>={missing:'尚未准备',installing:'正在准备组件',ready:'等待登录',starting:'正在启动',login:'等待扫码',online:'已登录',stopping:'正在停止',error:'需要处理'};
const healthErrors:Record<string,string>={INVALID_TOKEN:'连接凭据格式无效，请修改后保存。',CONNECTION_INIT_FAILED:'无法初始化连接，请检查地址和凭据。',TOKEN_REJECTED:'连接凭据被拒绝，请核对 NapCat 中的 Token。',ACCOUNT_MISMATCH:'登录的 QQ 与配置不一致，请核对账号。',LOGIN_REQUIRED:'请先完成 QQ 登录。',HEALTH_CHECK_FAILED:'无法确认 QQ 在线状态，请检查 NapCat。',CONNECTION_LOST:'连接已断开，正在重试。'};
const healthLabels:Record<string,string>={online:'已连接',stopped:'已停用',connecting:'连接中',reconnecting:'正在重连',not_logged_in:'需要登录',error:'连接异常'};
const initial:QQConfig={url:'ws://127.0.0.1:3001',accountId:'',ownerId:'',friendIds:[],groupReplyMode:'all',groups:[],enabled:false,replyEnabled:true,proactiveEnabled:false};
const errors:Record<string,string>={CHANNEL_VERSION_CONFLICT:'回复设置已在其他地方更新，请重新打开页面后修改。',QQ_ACCOUNT_CHANGED:'登录账号已变化，请重新核对回复设置。',QQ_DOCKER_MISSING:'请先安装并启动 Docker Desktop，再重试。',QQ_DOCKER_FAILED:'无法使用 Docker，请确认它已启动，再重试。',QQ_DOCKER_LOCAL_REQUIRED:'请选择本机 Docker 环境。',QQ_DOCKER_LINUX_REQUIRED:'请将 Docker 切换为 Linux 容器。',QQ_PLATFORM_UNSUPPORTED:'此系统暂不支持内置组件，可连接已有服务。',QQ_COMPONENT_UNAVAILABLE:'QQ 组件暂时没有响应，请重新启动。',QQ_COMPONENT_START_FAILED:'QQ 组件未能启动，请重试。',QQ_COMPONENT_AUTH:'QQ 组件认证失败，请重新启动。',QQ_COMPONENT_REQUEST_FAILED:'QQ 组件未能完成操作，请重试。',QQ_COMPONENT_CHECKSUM:'组件校验失败，请重新准备。',QQ_COMPONENT_DOWNLOAD:'下载失败，请检查网络后重试。',QQ_COMPONENT_STATE_INVALID:'组件状态文件无效，请保留数据并修复安装。',QQ_COMPONENT_INSTALL_INVALID:'组件安装不完整，请重新准备。',QQ_COMPONENT_OWNERSHIP:'发现不属于当前数据目录的组件，已停止操作。',QQ_EXTERNAL_ACTIVE:'请先停用已有服务连接，再启动内置组件。',QQ_LOGIN_FAILED:'QQ 登录未完成，请刷新二维码并在手机上完成验证。'};
interface Lists {friends:QQContact[];groups:QQContact[];error?:string}
export function QQConnection({fail,children}:{fail:(error:unknown)=>void;children?:ReactNode}){
 const [channel,setChannel]=useState<ChannelStatus>(),[component,setComponent]=useState<ManagedQQStatus>(),[lists,setLists]=useState<Lists>({friends:[],groups:[]}),[mode,setMode]=useState<'managed'|'external'>('managed'),[form,setForm]=useState<QQConfig>(initial),[revision,setRevision]=useState(''),[token,setToken]=useState(''),[manualOwner,setManualOwner]=useState(false),[manualFriends,setManualFriends]=useState(''),[manualFriendsMode,setManualFriendsMode]=useState(false),[manualGroups,setManualGroups]=useState(''),[busy,setBusy]=useState(false),[loadError,setLoadError]=useState(false);
 const initialized=useRef(false),editing=useRef(false),alive=useRef(true),pending=useRef(false),previousBusy=useRef(false),savePending=useRef(false);
 const refresh=useCallback(async()=>{
  const [c,m,l]=await Promise.all([api<ChannelStatus>('/v1/channels/qq'),api<ManagedQQStatus>(endpoint),api<Lists>(endpoint+'/contacts')]);if(!alive.current)return;
  setChannel(c);setComponent(m);setLists(l);setLoadError(false);
  if(!initialized.current||savePending.current&&!m.busy&&!m.error&&!m.operationError){
   if(!initialized.current)setMode(c.config&&c.config.mode!=='managed'?'external':'managed');
   if(!editing.current||savePending.current){setForm(c.config??initial);setRevision(c.revision);setManualGroups(c.config?.groups.join(',')??'');setManualFriends(c.config?.friendIds?.join(',')??'');}
   initialized.current=true;savePending.current=false;
  }
  previousBusy.current=m.busy;
 },[]);
 useEffect(()=>{alive.current=true;void refresh().catch(()=>setLoadError(true));let active=true;const timer=setInterval(()=>{if(active)void refresh().catch(()=>setLoadError(true));},2500);return()=>{active=false;alive.current=false;clearInterval(timer);};},[refresh]);
 const change=(patch:Partial<QQConfig>)=>{editing.current=true;setForm({...form,...patch});};
 const changeFriends=(value:string[]|string)=>{const text=typeof value==='string'?value:value.join(',');setManualFriends(text);change({friendIds:text.split(/[,，\s]+/).filter(Boolean)});};
 const act=async(path:string,method='POST',body?:unknown)=>{if(pending.current)return;pending.current=true;setBusy(true);try{await api(path,method,body);if(path.endsWith('/settings')){savePending.current=true;}else if(path==='/v1/channels/qq'||path==='/v1/channels/qq/stop'){editing.current=false;savePending.current=true;}await refresh();}catch(error){fail(error);}finally{pending.current=false;setBusy(false);}};
 const locked=busy||component?.busy;
 return <section className="qq-connection">
  <div className="section-heading"><h2>QQ</h2><Badge>{channel?.config?healthLabels[channel.health.state]:'未连接'}</Badge></div>
  {channel?.health.error&&<Alert>{healthErrors[channel.health.error]??'QQ 连接异常，请检查服务状态。'}</Alert>}
  {loadError&&<Alert>暂时无法读取连接状态。<Button size="compact" onClick={()=>void refresh().catch(fail)}>重试</Button></Alert>}
  <ActionRow><Button variant={mode==='managed'?'primary':'ghost'} disabled={locked} onClick={()=>setMode('managed')}>快速连接</Button><Button variant={mode==='external'?'primary':'ghost'} disabled={locked} onClick={()=>setMode('external')}>已有服务</Button></ActionRow>
  {mode==='managed'?<>
   <Card className="qq-account-card">
    <div className="qq-account-heading"><div><h3>{component?.account?.name??'登录 QQ'}</h3>{component?.account&&<p className="muted">{component.account.id}</p>}</div><Badge>{phaseLabels[component?.phase??'missing']}</Badge></div>
    {(component?.error||component?.operationError)&&<Alert>{errors[component.error??component.operationError!]??'QQ 组件操作失败，请重试。'}</Alert>}
    {component&&!component.supported&&<Alert>此系统暂不支持内置组件，请使用已有服务。</Alert>}
    {component?.busy&&<Loading>{phaseLabels[component.phase]}</Loading>}
    {component?.qr&&component.phase==='login'&&<div className="qq-login-code"><img src={component.qr} alt="QQ 登录二维码"/><p>使用手机 QQ 扫码，并确认登录</p></div>}
    {component?.phase==='login'&&!component.qr&&!component.busy&&<p className="muted">正在等待 QQ 提供二维码…</p>}
    <ActionRow>
     {(!component||component.phase==='missing'||component.phase==='error')&&<Button variant="primary" disabled={locked||!component?.supported} onClick={()=>void act(endpoint+'/install')}>{component?.phase==='error'?'重新准备':'准备 QQ 组件'}</Button>}
     {(component?.phase==='ready'||component?.phase==='error')&&<Button variant={component.phase==='ready'?'primary':'secondary'} disabled={locked} onClick={()=>void act(endpoint+'/start')}>启动并登录</Button>}
     {component?.phase==='login'&&<Button disabled={locked} onClick={()=>void act(endpoint+'/refresh')}>刷新二维码</Button>}
     {component&&['starting','login','online','error','installing'].includes(component.phase)&&<Button disabled={busy||component.phase==='stopping'} onClick={()=>void act(endpoint+'/stop')}>{component.busy?'取消':'停止组件'}</Button>}
    </ActionRow>
    {component?.phase==='missing'&&<p className="muted">首次使用需下载 QQ 组件。{component.engine==='docker'?'需先启动 Docker。':''}</p>}
   </Card>
   {component?.account&&component.phase==='online'&&<Card className="qq-reply-card"><form onSubmit={event=>{event.preventDefault();void act(endpoint+'/settings','PUT',{revision,accountId:component.account!.id,ownerId:form.ownerId,friendIds:form.friendIds??[],groupReplyMode:form.groupReplyMode??'all',groups:form.groups,replyEnabled:form.replyEnabled,proactiveEnabled:form.proactiveEnabled});}}>
    <fieldset disabled={locked}>
     <div className="qq-reply-heading">
      <h3>回复设置</h3>
      <Field className="check"><Checkbox checked={form.replyEnabled} onCheckedChange={replyEnabled=>change({replyEnabled})}/>自动回复</Field>
     </div>
     <div className="qq-owner-row">
      {lists.friends.length>0&&!manualOwner?<Field>主人 QQ<Select required value={form.ownerId} onValueChange={ownerId=>change({ownerId})}><option value="">选择主人 QQ</option>{lists.friends.map(friend=><option key={friend.id} value={friend.id}>{friend.name} · {friend.id}</option>)}</Select></Field>:<Field>主人 QQ 号<Input required inputMode="numeric" placeholder="唯一主人的 QQ 号" value={form.ownerId} onChange={event=>change({ownerId:event.target.value})}/></Field>}
      {lists.friends.length>0&&<Button variant="ghost" onClick={()=>setManualOwner(!manualOwner)}>{manualOwner?'从好友中选择':'手动输入 QQ 号'}</Button>}
     </div>
     <p className="qq-owner-hint muted">主人只能有一个 QQ，始终可以私聊。</p>
     <div className="qq-reply-options">
      <Disclosure className="qq-group-disclosure" title={<>可私聊的好友<span className="qq-setting-hint">已选 {(form.friendIds??[]).filter(id=>id!==form.ownerId).length} 位</span></>}>
       <p className="muted">好友可聊天，仅使用已共享的记忆。</p>
       {lists.friends.length>0&&!manualFriendsMode?<div className="qq-group-list">{lists.friends.filter(friend=>friend.id!==form.ownerId&&friend.id!==component?.account?.id).map(friend=><Field className="check" key={friend.id}><Checkbox checked={(form.friendIds??[]).includes(friend.id)} onCheckedChange={checked=>changeFriends(checked?[...(form.friendIds??[]),friend.id]:(form.friendIds??[]).filter(id=>id!==friend.id))}/>{friend.name} · {friend.id}</Field>)}</div>:<Field>可私聊的 QQ 号<Input placeholder="多个 QQ 号用逗号分隔，可留空" value={manualFriends} onChange={e=>changeFriends(e.target.value)}/></Field>}
       {lists.friends.length>0&&<Button className="qq-friends-manual-toggle" variant="ghost" onClick={()=>setManualFriendsMode(!manualFriendsMode)}>{manualFriendsMode?'从好友列表选择':'手动填写好友 QQ 号'}</Button>}
      </Disclosure>
      <Disclosure className="qq-group-disclosure" title={<>群聊回复<span className="qq-setting-hint">{form.groups.length?`已选 ${form.groups.length} 个群`:'未选择'}</span></>}>
       <Field>群聊触发方式<Select value={form.groupReplyMode??'all'} onValueChange={value=>change({groupReplyMode:value as QQConfig['groupReplyMode']})}><option value="all">普通消息也回复</option><option value="mention">仅被 @ 时回复</option></Select></Field>
       {lists.groups.length?<div className="qq-group-list">{lists.groups.map(group=><Field className="check" key={group.id}><Checkbox checked={form.groups.includes(group.id)} onCheckedChange={checked=>change({groups:checked?[...form.groups,group.id]:form.groups.filter(id=>id!==group.id)})}/>{group.name} · {group.id}</Field>)}</div>:<Field>允许回复的群号<Input placeholder="多个群号用逗号分隔，可留空" value={manualGroups} onChange={event=>{setManualGroups(event.target.value);change({groups:event.target.value.split(/[,，\s]+/).filter(Boolean)});}}/></Field>}
       {lists.error&&<p className="muted">暂时无法读取群列表，可填写群号。</p>}
      </Disclosure>
      <div className="qq-proactive-row"><Field className="check"><Checkbox checked={form.proactiveEnabled} onCheckedChange={proactiveEnabled=>change({proactiveEnabled})}/>允许主动消息</Field><span className="qq-setting-hint">直接发送</span></div>
     </div>
     <ActionRow className="qq-reply-actions"><Button type="submit" variant="primary">{channel?.config?.enabled?'保存回复设置':'启用连接'}</Button>{channel?.config?.enabled&&<Button onClick={()=>void act('/v1/channels/qq/stop')}>暂停回复</Button>}</ActionRow>
    </fieldset>
   </form></Card>}
  </>:<form onSubmit={event=>{event.preventDefault();void act('/v1/channels/qq','PUT',{...form,mode:'external',revision,groups:manualGroups.split(/[,，\s]+/).filter(Boolean),...(token?{token}:{})});}}>
   <fieldset disabled={locked}><h3>连接已有 NapCat</h3>
    <FormGrid><Field>服务地址<Input required value={form.url} onChange={e=>change({url:e.target.value})}/></Field><Field>连接凭据<Input type="password" autoComplete="off" value={token} placeholder={channel?.hasToken?'已保存，留空不变':'可选'} onChange={e=>setToken(e.target.value)}/></Field></FormGrid>
    <FormGrid><Field>机器人 QQ 号<Input required value={form.accountId} onChange={e=>change({accountId:e.target.value})}/></Field><Field>主人 QQ 号<Input required value={form.ownerId} onChange={e=>change({ownerId:e.target.value})}/></Field></FormGrid>
    <Field>可私聊的好友 QQ 号<Input placeholder="多个 QQ 号用逗号分隔，可留空" value={manualFriends} onChange={e=>changeFriends(e.target.value)}/></Field>
    <Field>群聊触发方式<Select value={form.groupReplyMode??'all'} onValueChange={value=>change({groupReplyMode:value as QQConfig['groupReplyMode']})}><option value="all">普通消息也回复</option><option value="mention">仅被 @ 时回复</option></Select></Field>
    <Field>允许回复的群号<Input placeholder="多个群号用逗号分隔，可留空" value={manualGroups} onChange={e=>{editing.current=true;setManualGroups(e.target.value);}}/></Field>
    <Field className="check"><Checkbox checked={form.enabled} onCheckedChange={enabled=>change({enabled})}/>启用连接</Field><Field className="check"><Checkbox checked={form.replyEnabled} onCheckedChange={replyEnabled=>change({replyEnabled})}/>自动回复</Field>
    <div className="qq-proactive-row"><Field className="check"><Checkbox checked={form.proactiveEnabled} onCheckedChange={proactiveEnabled=>change({proactiveEnabled})}/>允许主动消息</Field><span className="qq-setting-hint">直接发送</span></div>
    <ActionRow><Button type="submit" variant="primary">保存连接</Button>{channel?.config?.enabled&&<Button onClick={()=>void act('/v1/channels/qq/stop')}>停用连接</Button>}</ActionRow>
   </fieldset>
  </form>}
  <Card className="qq-records-card">
   <Disclosure title="最近消息"><RecentMessages fail={fail}/></Disclosure>
   {children}
  </Card>
 </section>;
}
function RecentMessages({fail}:{fail:(e:unknown)=>void}){
 const [items,setItems]=useState<{id:string;status:string;createdAt:string}[]>([]);
 useEffect(()=>{void api<typeof items>('/v1/channels/qq/deliveries').then(setItems).catch(fail);},[fail]);
 const labels:Record<string,string>={sending:'正在发送',sent:'已发送',unknown:'发送结果未知',failed:'发送失败',blocked:'已阻止',generating:'正在回复',queued:'等待回复',interrupted:'已中断'};
 return items.length?<div className="qq-history">{items.slice(0,20).map(item=><div key={item.id}><span>{labels[item.status]??item.status}</span><time>{new Date(item.createdAt).toLocaleString()}</time></div>)}</div>:<p className="muted">暂无消息</p>;
}
