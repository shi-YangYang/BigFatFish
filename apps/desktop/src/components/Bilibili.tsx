import { Card, Alert, Badge, Loading } from "./Surfaces";
import { Button, Field, Input, Select, ActionRow, FormGrid } from "./Controls";
import { Tabs } from './UI';
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "../api";
import type { VideoTask } from "../../../runtime/src/bilibili/service";
interface Status {
 enabled:boolean; revision:string; account?:{mid:string;name:string}; accountState:string; hasCredentials?:boolean;
 health:{ffmpeg:boolean;error?:string}; connection?:{phase:string;error?:string;login?:{status:string;image?:string}};
}
const states:Record<string,string>={queued:'等待观看',running:'获取字幕与画面',understanding:'理解内容',completed:'已完成',partial:'部分完成',failed:'失败',cancelled:'已取消',interrupted:'服务中断',waiting:'使用手机 B站扫码',scanned:'请在手机确认登录',success:'登录成功',expired:'二维码已过期',error:'连接失败',verified:'已连接',unverified:'待验证','signed-out':'未登录','expired-or-unavailable':'登录失效或暂不可用'};
export function Bilibili({fail}:{fail:(e:unknown)=>void}){
 const [status,setStatus]=useState<Status>(),[tasks,setTasks]=useState<VideoTask[]>([]),[busy,setBusy]=useState(false),[tab,setTab]=useState('观看'),[query,setQuery]=useState(''),[results,setResults]=useState<{title:string;bvid:string;author:string}[]|null>(null),[bvid,setBvid]=useState(''),[cookie,setCookie]=useState(''),[csrf,setCsrf]=useState(''),[target,setTarget]=useState(''),[kind,setKind]=useState('private'),[notice,setNotice]=useState('');
 const pending=useRef(false),alive=useRef(true),sequence=useRef(0);
 const reload=useCallback(async()=>{const n=++sequence.current;const [s,t]=await Promise.all([api<Status>('/v1/bilibili'),api<VideoTask[]>('/v1/bilibili/tasks')]);if(alive.current&&n===sequence.current){setStatus(s);setTasks(t);}},[]);
 useEffect(()=>{alive.current=true;void reload().catch(fail);const timer=setInterval(()=>void reload().catch(fail),2000);return()=>{alive.current=false;clearInterval(timer);};},[reload,fail]);
 const run=async(fn:()=>Promise<unknown>)=>{if(pending.current)return;pending.current=true;setBusy(true);setNotice('');++sequence.current;try{await fn();await reload();}catch(e){fail(e);}finally{pending.current=false;if(alive.current)setBusy(false);}};
 if(!status)return <Loading/>;
 const connection=status.connection,connecting=['connecting','login'].includes(connection?.phase??''),connected=status.enabled&&status.accountState==='verified';
 const locked=busy||connecting,login=connection?.login;
 return <section className="platform-connection">
  <div className="section-heading"><h2>B站</h2><Badge>{connected?'已连接':connecting?'连接中':status.enabled?'未登录':'未连接'}</Badge></div>
  <Card className="platform-account-card">
   <div className="platform-account-heading"><div><h3>{status.account?.name||'登录 B站'}</h3>{status.account&&<p className="muted">{status.account.mid}</p>}</div></div>
   {status.health.error&&<Alert>{errorText(status.health.error)}</Alert>}
   {connection?.error&&<Alert>{errorText(connection.error)}</Alert>}
   {connection?.phase==='connecting'&&<Loading>正在连接…</Loading>}
   {login?.image&&<div className="platform-login-code"><img src={login.image} alt="B站登录二维码"/><p>{states[login.status]||'使用手机 B站扫码'}</p></div>}
   {connection?.phase==='expired'&&<p>二维码已过期，请重新连接。</p>}
   <ActionRow>
    {!connected&&!connecting&&<Button variant="primary" disabled={busy} onClick={()=>void run(()=>api('/v1/bilibili/connect','POST',{revision:status.revision}))}>{connection?.phase==='error'?'重试连接':'连接 B站'}</Button>}
    {(status.enabled||connecting)&&<Button disabled={busy} onClick={()=>void run(()=>api('/v1/bilibili/disconnect','POST'))}>{connecting?'取消连接':'断开连接'}</Button>}
    {!status.enabled&&!connecting&&<Button variant="ghost" disabled={busy} onClick={()=>void run(()=>api('/v1/bilibili','PUT',{enabled:true,revision:status.revision}))}>暂不登录</Button>}
    {!connecting&&<Button variant="ghost" disabled={busy} onClick={()=>setTab('设置')}>导入凭据</Button>}
   </ActionRow>
  </Card>
  <Tabs items={['观看','记录','设置']} value={tab} onChange={setTab} label="B站功能">
  {tab==='观看'&&<Card>
   {!status.health.ffmpeg&&<p className="muted">未找到 ffmpeg，暂不能获取视频画面；可阅读可用字幕。</p>}
      <fieldset disabled={locked || !status.enabled}>
        <legend>寻找视频</legend>
        <ActionRow className="video-query-row">
          <Field>
            关键词
            <Input value={query} onChange={(e) => setQuery(e.target.value)} />
          </Field>
          <Button
            type="button"
            onClick={() =>
              void run(async () =>
                setResults(
                  (
                    await api<{
                      items: { title: string; bvid: string; author: string }[];
                    }>("/v1/bilibili/search", "POST", { query })
                  ).items,
                ),
              )
            }
          >
            搜索
          </Button>
        </ActionRow>
        {results && (
          <div>
            {results.length === 0 ? (
              <p>没有找到视频。</p>
            ) : (
              results.map((item) => (
                <Card key={item.bvid}>
                  <p>
                    {item.title} · {item.author}
                  </p>
                  <Button type="button" onClick={() => setBvid(item.bvid)}>
                    选择此视频
                  </Button>
                </Card>
              ))
            )}
          </div>
        )}
        <ActionRow className="video-query-row">
          <Field>
            BV 号
            <Input value={bvid} onChange={(e) => setBvid(e.target.value)} />
          </Field>
          <Button
            type="button"
            onClick={() =>
              void run(() =>
                api("/v1/bilibili/tasks", "POST", {
                  bvid,
                  requestId: crypto.randomUUID(),
                }),
              )
            }
          >
            观看并理解
          </Button>
        </ActionRow>
      </fieldset>
  </Card>}
  {tab==='记录'&&<div className="platform-records">
      <h3>观看记录</h3>
      {tasks.map((t) => (
        <Card key={t.id}>
          <h4>{t.result?.evidence.title ?? t.bvid}</h4>
          <p>
            {states[t.status] ?? t.status}
          </p>
          {t.error && <Alert>{errorText(t.error)}</Alert>}
          {["queued", "running", "understanding"].includes(t.status) && (
            <Button
              type="button"
              onClick={() =>
                void run(() => api(`/v1/bilibili/tasks/${t.id}/cancel`, "POST"))
              }
            >
              取消任务
            </Button>
          )}
          {t.result && (
            <>
              <p>
                {t.result.evidence.subtitles ? "有官方字幕" : "无官方字幕"} ·{" "}
                {t.result.evidence.frames
                  ? `采样 ${t.result.evidence.frames} 帧`
                  : "无采样画面"}
              </p>
              {t.result.evidence.warnings.map((w) => (
                <p key={w}>{errorText(w)}</p>
              ))}
              {t.result.evidence.metadataCached && (
                <p>标题等元信息来自缓存；字幕和采样画面为本次获取。</p>
              )}
              <p>{t.result.summary}</p>
              <a href={t.result.evidence.url} target="_blank" rel="noreferrer">
                {t.result.evidence.url}
              </a>
            </>
          )}
          {t.result?.summary && (
            <Button
              type="button"
              disabled={busy || !target}
              onClick={() =>
                void run(async () => {
                  const result=await api<{status:string}>(`/v1/bilibili/tasks/${t.id}/share`, "POST", {
                    target: { kind, id: target },
                  });
                  setNotice(result.status==='sent'?"已分享到 QQ。":result.status==='unknown'?"发送结果未知，请在 QQ 核实，勿重复发送。":"分享未发送成功，请查看 QQ 消息记录。");
                })
              }
            >
              分享到 QQ
            </Button>
          )}
        </Card>
      ))}
      <FormGrid>
        <Field>
          QQ 分享对象
          <Select value={kind} onValueChange={(value) => setKind(value)}>
            <option value="private">主人私聊</option>
            <option value="group">已授权群</option>
          </Select>
        </Field>
        <Field>
          接收 QQ 或群号
          <Input value={target} onChange={(e) => setTarget(e.target.value)} />
        </Field>
      </FormGrid>
      {notice && <Alert variant="info" role="status">{notice}</Alert>}
  </div>}
  {tab==='设置'&&<Card><h3>导入凭据</h3><form onSubmit={event=>{event.preventDefault();void run(async()=>{await api('/v1/bilibili/connect','POST',{revision:status.revision,credentials:{sessdata:cookie,bili_jct:csrf}});setCookie('');setCsrf('');});}}><fieldset disabled={locked}>
   <FormGrid><Field>SESSDATA<Input required type="password" autoComplete="off" value={cookie} onChange={e=>setCookie(e.target.value)}/></Field><Field>bili_jct<Input required type="password" autoComplete="off" value={csrf} onChange={e=>setCsrf(e.target.value)}/></Field></FormGrid>
   <ActionRow><Button type="submit" variant="primary">验证并连接</Button>{status.hasCredentials&&<Button onClick={()=>void run(()=>api('/v1/bilibili/logout','POST'))}>退出登录</Button>}</ActionRow>
  </fieldset></form></Card>}
  </Tabs>
 </section>;
}
