import { ConnectionStatus } from './ConnectionStatus';
import { usePoll } from "../../hooks/usePoll";
import { cancelActivity, loadActivities } from "../../api/activities";
import { activityState, actionNames } from "../fish/activity-labels";
import { Card, Loading, Alert} from "../../components/Surfaces";
import {
  Field,
  Checkbox,
  Input,
  Button,
  Select,
  Textarea,
  ActionRow,
} from "../../components/Controls";
import { useCallback, useEffect, useRef, useState } from "react";
import { douyinStatus, type DouyinStatus } from './connection-status';
import { ConnectionReadError } from './ConnectionReadError';
import { OperationRecords } from "./OperationRecords";
import { Tabs, Drawer } from "../../components/UI";
import { api } from "../../api/client";
import { errorText } from "../../api/errors";
import type { BrowserConfig } from "../../../../runtime/src/douyin/browser";
import type { ActivityTask } from "../../../../runtime/src/tasks/queue";
export function Douyin({ fail }: { fail: (e: unknown) => void }) {
  const [state,setState]=useState<DouyinStatus>(),
    [form,setForm]=useState<BrowserConfig>(),[formRevision,setFormRevision]=useState(''),[tab,setTab]=useState('记录'),
    [videoId,setVideoId]=useState(''),[busy,setBusy]=useState(false),[busyAction,setBusyAction]=useState(''),[tasks,setTasks]=useState<ActivityTask[]>(),[recordsError,setRecordsError]=useState<string>(),
    [settingsOpen,setSettingsOpen]=useState(false),[tool,setTool]=useState('douyin_like'),[text,setText]=useState('');
  const [readError,setReadError]=useState(false),[actionError,setActionError]=useState(''),[settingsError,setSettingsError]=useState('');
  useEffect(()=>setActionError(''),[state?.connection?.phase,state?.revision]);
  const editing=useRef(false),pending=useRef(false),sequence=useRef(0),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;++sequence.current;};},[]);
  const refresh=useCallback(async()=>{
    const n=++sequence.current,current=()=>alive.current&&n===sequence.current;
    await Promise.all([
      api<NonNullable<typeof state>>('/v1/douyin').then(s=>{
        if(!current())return;
        setState(s);setReadError(false);
        if(!editing.current){setForm(s.config);setFormRevision(s.revision);}
      },()=>{if(current())setReadError(true);}),
      loadActivities().then(a=>{
        if(current()){setTasks(a.tasks.filter(t=>t.platform==='douyin'));setRecordsError(undefined);}
      },e=>{if(current())setRecordsError(errorText(e));}),
    ]);
  },[]);
  usePoll(refresh);
  const act=async(name:string,action:()=>Promise<unknown>,onError=(e:unknown)=>setActionError(errorText(e)))=>{if(pending.current)return;pending.current=true;setBusyAction(name);setBusy(true);setActionError('');++sequence.current;try{await action();if(alive.current)await refresh();}catch(e){if(alive.current)onError(e);}finally{pending.current=false;if(alive.current)setBusy(false);}};
  const readWarning=readError&&<ConnectionReadError retry={refresh}/>;
  if(!state||!form)return <Card className="platform-account-card"><h2>抖音</h2>{readWarning||<Loading/>}</Card>;
  const change=(patch:Partial<BrowserConfig>)=>{editing.current=true;setForm({...form,...patch});};
  const {label,error,connecting,connected}=douyinStatus(state),locked=busy||connecting;
  const failure=actionError||(error&&errorText(error));
  return <section className="page-section platform-connection">

   <Card className="platform-account-card">
    <div className="platform-account-heading"><div><h2>抖音</h2>{state.config.accountId&&<p className="muted">{state.config.accountId}</p>}</div><ConnectionStatus label={readError?'状态待更新':label}/></div>
    {readWarning}
    {failure&&<Alert>{failure}</Alert>}
    {state.connection?.phase==='login'&&<p>{state.connection.loginState==='verification'?'请在专用浏览器中完成验证':state.connection.loginState==='confirmation'?'请在手机上确认登录':'请在打开的浏览器中登录抖音'}</p>}
    <ActionRow className="platform-connect-actions">
     {!connected&&!connecting&&<Button variant="primary" busy={busy&&busyAction==='connect'} disabled={busy} onClick={()=>void act('connect',()=>api('/v1/douyin/connect','POST',{revision:state.revision}))}>{state.connection?.phase==='error'?'重试连接':'连接抖音'}</Button>}
     {(state.config.enabled||connecting)&&<Button busy={busy&&busyAction==='disconnect'} disabled={busy} onClick={()=>void act('disconnect',()=>api('/v1/douyin/disconnect','POST'))}>{connecting?'取消连接':'断开连接'}</Button>}
     <Button variant="ghost" disabled={busy} onClick={()=>{setSettingsError('');setSettingsOpen(true);}}>连接设置</Button>
    </ActionRow>
   </Card>
   <Tabs items={['记录','互动']} value={tab} onChange={setTab} label="抖音功能">
    {tab==='互动'&&!connected&&<Card><p>连接抖音后可点赞或评论。</p><Button variant="primary" busy={busy&&busyAction==='connect'||!!connecting} disabled={busy||connecting} onClick={()=>void act('connect',()=>api('/v1/douyin/connect','POST',{revision:state.revision}))}>{connecting?'正在连接…':'连接抖音'}</Button></Card>}
    {tab==='互动'&&connected&&<div className="platform-records"><Card><h3>互动</h3><p className="muted">暂不支持私信、分享和投稿。</p><fieldset disabled={locked||!connected}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const args = tool === "douyin_comment" ? { aweme_id: videoId, text } : { aweme_id: videoId };
            void act('interaction',async () => {
              await api("/v1/douyin/write", "POST", { tool, args, requestId: crypto.randomUUID() });
              if(alive.current)setTab("记录");
            },fail);
          }}
        >
          <Field>视频 ID<Input required value={videoId} onChange={e=>setVideoId(e.target.value)}/></Field>
          <Field>
            操作
            <Select value={tool} onValueChange={(value) => setTool(value)}>
              {Object.entries({
                douyin_like: "点赞",
                douyin_comment: "评论",
              }).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          {tool === "douyin_comment" && <Field>正文<Textarea value={text} onChange={e=>setText(e.target.value)} required/></Field>}
          <Button type="submit" variant="primary" busy={busy&&busyAction==='interaction'} disabled={busy}>
            {busy ? "正在提交…" : tool === "douyin_comment" ? "发送评论" : "点赞"}
          </Button>
        </form>
    </fieldset></Card></div>}
    {tab==='记录'&&<OperationRecords error={recordsError} records={tasks?.map(t=>({
      id:t.id,
      action:t.kind==='watch'?'观看视频':t.kind==='decision'?'活动决策':actionNames[String(t.input.tool)]??'读取',
      title:operationTitle(t),status:activityState[t.status]??'状态未知',createdAt:t.createdAt,
      error:t.error||t.result?.error?errorText(t.error||t.result?.error):undefined,
      actions:['queued','running'].includes(t.status)?<Button size="compact" busy={busy&&busyAction==='cancel-'+t.id} disabled={busy} onClick={()=>void act('cancel-'+t.id,()=>cancelActivity(t.id),fail)}>取消任务</Button>:undefined,
    }))}/>}
    {settingsOpen&&<Drawer title="连接设置" close={()=>{if(!busy)setSettingsOpen(false);}}>
     {settingsError&&<Alert>{settingsError}</Alert>}
     <form onSubmit={e=>{e.preventDefault();setSettingsError('');void act('settings',async()=>{
      await api('/v1/douyin/connect','POST',{...form,revision:formRevision});
      if(alive.current){editing.current=false;setSettingsOpen(false);}
     },error=>setSettingsError(errorText(error)));}}><fieldset disabled={locked}>
     <Field>浏览器路径<Input value={form.executablePath} placeholder="自动发现" onChange={e=>change({executablePath:e.target.value})}/></Field>
     <Field>Python 路径<Input value={form.pythonPath} onChange={e=>change({pythonPath:e.target.value})}/></Field>
     <Field>账号 ID<Input value={form.accountId} placeholder="登录后自动识别" onChange={e=>change({accountId:e.target.value})}/></Field>
     <Field className="check"><Checkbox checked={form.headless} onCheckedChange={headless=>change({headless})}/>无窗口运行</Field>
     <ActionRow><Button type="submit" variant="primary" busy={busy&&busyAction==='settings'}>保存并连接</Button></ActionRow>
    </fieldset></form></Drawer>}
   </Tabs>
  </section>;
}
function operationTitle(task:ActivityTask):string|undefined {
  const evidence=task.result?.evidence;
  const title=evidence&&typeof evidence==='object'&&'title' in evidence?evidence.title:task.result?.title;
  if(typeof title==='string'&&title.trim())return title;
  const args=task.input.args;
  const videoId=task.input.videoId??(args&&typeof args==='object'&&'aweme_id' in args?args.aweme_id:undefined);
  return typeof videoId==='string'?videoId:undefined;
}
