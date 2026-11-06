import { ContentScroll, Card, Badge, Loading, Alert} from "./Surfaces";
import {
  Field,
  Checkbox,
  Input,
  Button,
  Select,
  Textarea,
  FormGrid, ActionRow,
} from "./Controls";
import { useCallback, useEffect, useRef, useState } from "react";
import { OperationRecords } from "./OperationRecords";
import { Tabs } from "./UI";
import { api, errorText } from "../api";
import type { BrowserConfig } from "../../../runtime/src/douyin/browser";
import type { ActivityTask } from "../../../runtime/src/tasks/queue";
const actionNames: Record<string, string> = {
  douyin_like: "点赞",
  douyin_comment: "评论",
  douyin_chat_send: "私信",
  douyin_share_video: "分享视频",
  douyin_publish: "投稿",
  douyin_search: "搜索",
  douyin_feed: "推荐",
  douyin_video: "详情",
  douyin_comments: "读取评论",
  douyin_check_credential: "验证账号",
  douyin_login_qr: "登录",
  douyin_login_poll: "检查登录",
};
export const activityState: Record<string, string> = {
  queued: "排队中",
  running: "进行中",
  understanding: "正在理解",
  completed: "已完成",
  partial: "部分完成",
  failed: "失败",
  cancelled: "已取消",
  interrupted: "已中断",
  unknown: "结果未知，请核对平台",
  blocked: "需要处理",
  revoked: "已撤销",
};
export interface ActivityOverview {
  paused: boolean;
  tasks: ActivityTask[];
  schedules: {
    id: string;
    enabled: boolean;
    mode: string;
    intervalMinutes: number;
    choices: { platform: string; videoId: string }[];
    nextAt: number;
  }[];
}
export function usePoll(load: () => Promise<void>) {
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      try {
        if (active) await load();
      } finally {
        if (active) timer = setTimeout(() => void run(), 1500);
      }
    };
    void run();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [load]);
}
export function Douyin({ fail }: { fail: (e: unknown) => void }) {
  const [state,setState]=useState<{config:BrowserConfig;revision:string;browser:{state:string};accountState:string;connection?:{phase:string;error?:string;loginState?:string}}>(),
    [form,setForm]=useState<BrowserConfig>(),[formRevision,setFormRevision]=useState(''),[tab,setTab]=useState('记录'),
    [videoId,setVideoId]=useState(''),[busy,setBusy]=useState(false),[tasks,setTasks]=useState<ActivityTask[]>(),[recordsError,setRecordsError]=useState<string>(),
    [tool,setTool]=useState('douyin_like'),[text,setText]=useState('');
  const editing=useRef(false),pending=useRef(false),sequence=useRef(0),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;++sequence.current;};},[]);
  const refresh=useCallback(async()=>{
    const n=++sequence.current,current=()=>alive.current&&n===sequence.current;
    await Promise.all([
      api<NonNullable<typeof state>>('/v1/douyin').then(s=>{
        if(!current())return;
        setState(s);
        if(!editing.current){setForm(s.config);setFormRevision(s.revision);}
      },e=>{if(current())fail(e);}),
      api<ActivityOverview>('/v1/activities').then(a=>{
        if(current()){setTasks(a.tasks.filter(t=>t.platform==='douyin'));setRecordsError(undefined);}
      },e=>{if(current())setRecordsError(errorText(e));}),
    ]);
  },[fail]);
  usePoll(refresh);
  const act=async(action:()=>Promise<unknown>)=>{if(pending.current)return;pending.current=true;setBusy(true);++sequence.current;try{await action();if(alive.current)await refresh();}catch(e){if(alive.current)fail(e);}finally{pending.current=false;if(alive.current)setBusy(false);}};
  if(!state||!form)return <Loading/>;
  const change=(patch:Partial<BrowserConfig>)=>{editing.current=true;setForm({...form,...patch});};
  const connecting=['connecting','login'].includes(state.connection?.phase??''),locked=busy||connecting,connected=state.config.enabled&&state.browser.state==='ready'&&state.accountState==='verified';
  return <section className="page-section platform-connection">

   <Card className="platform-account-card">
    <div className="platform-account-heading"><div><h2>抖音</h2>{state.config.accountId&&<p className="muted">{state.config.accountId}</p>}</div><Badge>{connected?'已连接':connecting?'连接中':'未连接'}</Badge></div>
    {state.connection?.error&&<Alert>{errorText(state.connection.error)}</Alert>}
    {state.connection?.phase==='connecting'&&<Loading>正在打开登录…</Loading>}
    {state.connection?.phase==='login'&&<p>{state.connection.loginState==='verification'?'请在专用浏览器中完成验证':state.connection.loginState==='confirmation'?'请在手机上确认登录':'请在打开的浏览器中登录抖音'}</p>}
    <ActionRow className="platform-connect-actions">
     {!connected&&!connecting&&<Button variant="primary" disabled={busy} onClick={()=>void act(()=>api('/v1/douyin/connect','POST',{revision:state.revision}))}>{state.connection?.phase==='error'?'重试连接':'连接抖音'}</Button>}
     {(state.config.enabled||connecting)&&<Button disabled={busy} onClick={()=>void act(()=>api('/v1/douyin/disconnect','POST'))}>{connecting?'取消连接':'断开连接'}</Button>}
     <Button variant="ghost" disabled={busy} onClick={()=>setTab('设置')}>连接设置</Button>
    </ActionRow>
   </Card>
   <Tabs items={['记录','互动','设置']} value={tab} onChange={setTab} label="抖音功能">
    {tab==='互动'&&<div className="platform-records"><Card><h3>互动</h3><p className="muted">暂不支持私信、分享和投稿。</p><fieldset disabled={locked||!connected}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const args = tool === "douyin_comment" ? { aweme_id: videoId, text } : { aweme_id: videoId };
            void act(async () => {
              await api("/v1/douyin/write", "POST", { tool, args, requestId: crypto.randomUUID() });
              if(alive.current)setTab("记录");
            });
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
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "正在提交…" : tool === "douyin_comment" ? "发送评论" : "点赞"}
          </Button>
        </form>
    </fieldset></Card></div>}
    {tab==='记录'&&<OperationRecords error={recordsError} records={tasks?.map(t=>({
      id:t.id,
      action:t.kind==='watch'?'观看视频':t.kind==='decision'?'活动决策':actionNames[String(t.input.tool)]??'读取',
      title:operationTitle(t),status:activityState[t.status]??'状态未知',createdAt:t.createdAt,
      error:t.error||t.result?.error?errorText(t.error||t.result?.error):undefined,
      actions:['queued','running'].includes(t.status)?<Button size="compact" disabled={busy} onClick={()=>void act(()=>api(`/v1/activities/${t.id}/cancel`,'POST'))}>取消任务</Button>:undefined,
    }))}/>}
    {tab==='设置'&&<Card><h3>连接设置</h3><form onSubmit={e=>{e.preventDefault();void act(async()=>{await api('/v1/douyin/connect','POST',{...form,revision:formRevision});editing.current=false;});}}><fieldset disabled={locked}>
     <Field>浏览器路径<Input value={form.executablePath} placeholder="自动发现" onChange={e=>change({executablePath:e.target.value})}/></Field>
     <Field>Python 路径<Input value={form.pythonPath} onChange={e=>change({pythonPath:e.target.value})}/></Field>
     <Field>账号 ID<Input value={form.accountId} placeholder="登录后自动识别" onChange={e=>change({accountId:e.target.value})}/></Field>
     <Field className="check"><Checkbox checked={form.headless} onCheckedChange={headless=>change({headless})}/>无窗口运行</Field>
     <ActionRow><Button type="submit" variant="primary">保存并连接</Button></ActionRow>
    </fieldset></form></Card>}
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
export function ActivityRows({
  tasks,
  fail,
  refresh,
}: {
  tasks: ActivityTask[];
  fail: (e: unknown) => void;
  refresh: () => Promise<void>;
}) {
  return (
    <ContentScroll label="任务记录" className="content-scroll-list">
      {tasks.map((t) => (
        <Card key={t.id}>
          <div className="record-title">
          <strong>
            {t.platform === "douyin"
              ? "抖音"
              : t.platform === "bilibili"
                ? "B站"
                : "调度"}{" "}
            ·{" "}
            {t.kind === "watch"
              ? "观看视频"
              : t.kind === "decision"
                ? "活动决策"
                : (actionNames[String(t.input.tool)] ?? "读取")}{" "}
            · {activityState[t.status] ?? t.status}
          </strong>
          <span className="muted">
            {t.mode === "Autonomous"
              ? "自主"
              : t.mode === "Scheduled"
                ? "定时"
                : "用户发起"}
          </span>
          </div>
          {t.result?.evidence && typeof t.result.evidence === "object" ? (
            <div className="summary-entry">
              <p>
              {String(
                (t.result.evidence as Record<string, unknown>).title ?? "",
              )}
              </p>
              <span className="muted">
              {String(
                (t.result.evidence as Record<string, unknown>).observedAt ?? "",
              )}
              </span>
              <span className="muted">
              {String((t.result.evidence as Record<string, unknown>).url ?? "")}
              </span>
            </div>
          ) : null}
          {t.error && <Alert role="alert">{errorText(t.error)}</Alert>}
          {!!t.result?.error && <Alert>{errorText(t.result.error)}</Alert>}
          {!!t.result?.summary && <p>{String(t.result.summary)}</p>}
          {!!t.result?.title && <p>{String(t.result.title)}</p>}
          {!!t.result?.uid && <p>账号 ID：{String(t.result.uid)}</p>}
          {Array.isArray(t.result?.items) &&
            t.result.items.map((v, i) => {
              const item = v as Record<string, unknown>;
              return (
                <p key={i}>
                  {String(item.title ?? item.text ?? "")}{" "}
                  {String(item.author ?? "")}
                </p>
              );
            })}
          {Array.isArray(t.result?.comments) &&
            t.result.comments.map((v, i) => (
              <p key={i}>{String((v as Record<string, unknown>).text ?? "")}</p>
            ))}
          {!!t.result?.decision && (
            <p>
              {String((t.result.decision as Record<string, unknown>).reason)}
            </p>
          )}
          {["queued", "running"].includes(t.status) && (
            <Button
              type="button"
              onClick={() =>
                void api(`/v1/activities/${t.id}/cancel`, "POST")
                  .then(refresh)
                  .catch(fail)
              }
            >
              取消
            </Button>
          )}
        </Card>
      ))}
    </ContentScroll>
  );
}
export function Activities({ fail }: { fail: (e: unknown) => void }) {
  const [data, setData] = useState<ActivityOverview>(),
    [platform, setPlatform] = useState("douyin"),
    [videoId, setVideoId] = useState(""),
    [interval, setInterval] = useState(60),
    [autonomous, setAutonomous] = useState(false),
    [creating, setCreating] = useState(false);
  const load = useCallback(async () => {
    try {
      setData(await api("/v1/activities"));
    } catch (e) {
      fail(e);
    }
  }, [fail]);
  usePoll(load);
  return (
    <section className="page-section">
      <div className="section-heading">
        <h2>活动计划</h2>
        <ActionRow>
          {data && (
            <Button
              type="button"
              onClick={() =>
                void api("/v1/activities/pause", "POST", { paused: !data.paused })
                  .then(load)
                  .catch(fail)
              }
            >
              {data.paused ? "恢复活动" : "暂停全部活动"}
            </Button>
          )}
          <Button variant="primary" aria-expanded={creating} onClick={() => setCreating(!creating)}>{creating ? "收起创建" : "创建计划"}</Button>
        </ActionRow>
      </div>
      {creating && <Card>
      <h3>创建计划</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void api("/v1/schedules", "POST", {
            enabled: true,
            mode: autonomous ? "Autonomous" : "Scheduled",
            intervalMinutes: interval,
            choices: autonomous
              ? [{ platform, query: videoId }]
              : videoId
                  .split(/[，,\s]+/)
                  .filter(Boolean)
                  .map((videoId) => ({ platform, videoId })),
          })
            .then(async () => { await load(); setCreating(false); })
            .catch(fail);
        }}
      >
        <FormGrid>
        <Field>
          平台
          <Select
            value={platform}
            onValueChange={(value) => setPlatform(value)}
          >
            <option value="douyin">抖音</option>
            <option value="bilibili">B站</option>
          </Select>
        </Field>
        <Field>
          间隔（分钟）
          <Input
            type="number"
            min="1"
            max="10080"
            value={interval}
            onChange={(e) => setInterval(Number(e.target.value))}
          />
        </Field>
        </FormGrid>
        <Field>
          {autonomous ? "允许搜索的主题" : "允许观看的视频 ID（逗号分隔）"}
          <Input
            value={videoId}
            onChange={(e) => setVideoId(e.target.value)}
            required
          />
        </Field>

        <Field>
          <Checkbox

            checked={autonomous}
            onCheckedChange={(value) => setAutonomous(value)}
          />
          允许鱼依据兴趣选择观看或休息
        </Field>
        <Button type="submit" variant="primary">
          启用计划
        </Button>
      </form>
      </Card>}
      {data && !data.schedules.length && <p className="muted">还没有活动计划。</p>}
      {data?.schedules.map((s) => (
        <Card key={s.id}>
          <p>
            {s.mode === "Autonomous" ? "自主选择" : "定时观看"} ·{" "}
            {s.enabled ? "启用" : "停用"} · 每 {s.intervalMinutes} 分钟
          </p>
          <ActionRow>
            <Button
              type="button"
              onClick={() =>
                void api("/v1/schedules", "POST", { ...s, enabled: !s.enabled })
                  .then(load)
                  .catch(fail)
              }
            >
              {s.enabled ? "停用" : "启用"}
            </Button>
            <Button
              type="button"
              onClick={() =>
                void api(`/v1/schedules/${s.id}/run`, "POST")
                  .then(load)
                  .catch(fail)
              }
            >
              立即运行
            </Button>
            <Button
              type="button"
              onClick={() =>
                void api(`/v1/schedules/${s.id}`, "DELETE")
                  .then(load)
                  .catch(fail)
              }
            >
              删除
            </Button>
          </ActionRow>
        </Card>
      ))}
      {!!data?.tasks.length && <h3>活动记录</h3>}
      <ActivityRows tasks={data?.tasks ?? []} fail={fail} refresh={load} />
    </section>
  );
}
