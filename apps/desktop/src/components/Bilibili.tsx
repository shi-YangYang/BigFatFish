import { Button, Field, Input, Select, ActionRow, FormGrid } from "./Controls";
import { useEffect, useState } from "react";
import { api, errorText } from "../api";
import type { VideoTask } from "../../../runtime/src/bilibili/service";
interface Status {
  enabled: boolean;
  revision: string;
  account?: { mid: string; name: string };
  accountState: string;
  health: { ffmpeg: boolean; error?: string };
}
interface Login {
  id?: string;
  status: string;
  image?: string;
}
const states: Record<string, string> = {
  queued: "等待观看",
  running: "获取字幕与画面",
  understanding: "理解内容",
  completed: "已完成",
  partial: "部分完成",
  failed: "失败",
  cancelled: "已取消",
  interrupted: "服务中断",
  waiting: "等待扫码",
  scanned: "请在手机确认",
  success: "登录成功",
  expired: "二维码过期",
  cancelled_login: "登录已取消",
  error: "登录失败",
  verified: "已验证",
  unverified: "待验证",
  "signed-out": "未登录",
  "expired-or-unavailable": "登录失效或暂不可用",
};
export function Bilibili({ fail }: { fail: (e: unknown) => void }) {
  const [status, setStatus] = useState<Status>(),
    [tasks, setTasks] = useState<VideoTask[]>([]),
    [login, setLogin] = useState<Login>(),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [results, setResults] = useState<
      { title: string; bvid: string; author: string }[] | null
    >(null),
    [bvid, setBvid] = useState(""),
    [cookie, setCookie] = useState(""),
    [csrf, setCsrf] = useState(""),
    [target, setTarget] = useState(""),
    [kind, setKind] = useState("private"),
    [notice, setNotice] = useState("");
  const reload = async () => {
    const [s, t] = await Promise.all([
      api<Status>("/v1/bilibili"),
      api<VideoTask[]>("/v1/bilibili/tasks"),
    ]);
    setStatus(s);
    setTasks(t);
  };
  useEffect(() => {
    let active = true;
    const read = async () => {
      try {
        const [s, t] = await Promise.all([
          api<Status>("/v1/bilibili"),
          api<VideoTask[]>("/v1/bilibili/tasks"),
        ]);
        if (active) {
          setStatus(s);
          setTasks(t);
        }
      } catch (e) {
        if (active) fail(e);
      }
    };
    void read();
    const timer = setInterval(() => void read(), 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [fail]);
  useEffect(() => {
    if (!login?.id || !["waiting", "scanned"].includes(login.status)) return;
    let active = true;
    const timer = setInterval(() => {
      void api<Login>("/v1/bilibili/login/poll", "POST", { id: login.id })
        .then((s) => {
          if (active) setLogin(s);
        })
        .catch((e) => {
          if (active) fail(e);
        });
    }, 2200);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [login?.id, login?.status, fail]);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setNotice("");
    try {
      await fn();
      await reload();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section>
      <h2>B站</h2>
      {status && (
        <>
          <p>
            {status.enabled ? "已启用" : "未启用"} ·{" "}
            {states[status.accountState] ?? status.accountState}
            {status.account
              ? ` · ${status.account.name} (${status.account.mid})`
              : ""}
          </p>
          <Button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(() =>
                api("/v1/bilibili", "PUT", {
                  enabled: !status.enabled,
                  revision: status.revision,
                }),
              )
            }
          >
            {status.enabled ? "停用" : "启用"}
          </Button>
          {status.health.error && <p>{errorText(status.health.error)}</p>}
          {!status.health.ffmpeg && (
            <p>未找到 ffmpeg，暂不能获取视频画面；可阅读可用字幕。</p>
          )}
        </>
      )}
      <fieldset disabled={busy || !status?.enabled}>
        <legend>登录</legend>
        <ActionRow>
          <Button
            type="button"
            onClick={() =>
              void run(async () =>
                setLogin(await api("/v1/bilibili/login/start", "POST")),
              )
            }
          >
            扫码登录
          </Button>
          <Button
            type="button"
            onClick={() => void run(() => api("/v1/bilibili/verify", "POST"))}
          >
            验证账号
          </Button>
          <Button
            type="button"
            onClick={() =>
              void run(async () => {
                await api("/v1/bilibili/logout", "POST");
                setLogin(undefined);
              })
            }
          >
            退出登录
          </Button>
        </ActionRow>
        {login && (
          <div>
            <p>{states[login.status] ?? login.status}</p>
            {login.image && <img src={login.image} alt="B站登录二维码" />}
            {["waiting", "scanned"].includes(login.status) && (
              <Button
                type="button"
                onClick={() =>
                  void run(async () =>
                    setLogin(
                      await api("/v1/bilibili/login/cancel", "POST", {
                        id: login.id,
                      }),
                    ),
                  )
                }
              >
                取消登录
              </Button>
            )}
          </div>
        )}
        <details>
          <summary>导入本人凭据</summary>
          <FormGrid className="credential-grid">
            <Field>
              SESSDATA
              <Input
                type="password"
                autoComplete="off"
                value={cookie}
                onChange={(e) => setCookie(e.target.value)}
              />
            </Field>
            <Field>
              bili_jct
              <Input
                type="password"
                autoComplete="off"
                value={csrf}
                onChange={(e) => setCsrf(e.target.value)}
              />
            </Field>
            <Button
              type="button"
              onClick={() =>
                void run(async () => {
                  await api("/v1/bilibili/import", "POST", {
                    sessdata: cookie,
                    bili_jct: csrf,
                  });
                  setCookie("");
                  setCsrf("");
                })
              }
            >
              验证并保存
            </Button>
          </FormGrid>
        </details>
      </fieldset>
      <fieldset disabled={busy || !status?.enabled}>
        <legend>寻找视频</legend>
        <ActionRow>
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
                <article key={item.bvid}>
                  <p>
                    {item.title} · {item.author}
                  </p>
                  <Button type="button" onClick={() => setBvid(item.bvid)}>
                    选择此视频
                  </Button>
                </article>
              ))
            )}
          </div>
        )}
        <ActionRow>
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
      <h3>观看记录</h3>
      {tasks.map((t) => (
        <article key={t.id}>
          <h4>{t.result?.evidence.title ?? t.bvid}</h4>
          <p>
            {states[t.status] ?? t.status}
            {t.error ? ` · ${errorText(t.error)}` : ""}
          </p>
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
                  await api(`/v1/bilibili/tasks/${t.id}/share`, "POST", {
                    target: { kind, id: target },
                  });
                  setNotice("分享已提交审批，请打开右上角审批核对并批准。");
                })
              }
            >
              申请 QQ 分享
            </Button>
          )}
        </article>
      ))}
      <FormGrid>
        <Field>
          QQ 分享对象
          <Select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="private">主人私聊</option>
            <option value="group">已授权群</option>
          </Select>
        </Field>
        <Field>
          接收 QQ 或群号
          <Input value={target} onChange={(e) => setTarget(e.target.value)} />
        </Field>
      </FormGrid>
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
