import { Disclosure, Card , Loading, Alert} from "./Surfaces";
import {
  Field,
  Checkbox,
  Input,
  Button,
  Select,
  Textarea,
  ActionRow,
} from "./Controls";
import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "../api";
import type { BrowserConfig } from "../../../runtime/src/douyin/browser";
import type { StoredApproval } from "../../../runtime/src/permissions/store";
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
  pending: "待审批",
  executing: "执行中",
  rejected: "已拒绝",
  expired: "已过期",
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
  const [state, setState] = useState<{
      config: BrowserConfig;
      revision: string;
      browser: { state: string };
      accountState: string;
    }>(),
    [form, setForm] = useState<BrowserConfig>(),
    [query, setQuery] = useState(""),
    [videoId, setVideoId] = useState(""),
    [audio, setAudio] = useState(false),
    [busy, setBusy] = useState(false),
    [tasks, setTasks] = useState<ActivityTask[]>([]),
    [tool, setTool] = useState("douyin_like"),
    [text, setText] = useState(""),
    [nickname, setNickname] = useState(""),
    [peerId, setPeerId] = useState(""),
    [attachmentId, setAttachmentId] = useState(""),
    [draft, setDraft] = useState(true),
    [aiDeclare, setAiDeclare] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([
        api<NonNullable<typeof state>>("/v1/douyin"),
        api<ActivityOverview>("/v1/activities"),
      ]);
      setState(s);
      setTasks(a.tasks.filter((t) => t.platform === "douyin"));
      setForm((f) => f ?? s.config);
    } catch (e) {
      fail(e);
    }
  }, [fail]);
  usePoll(refresh);
  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const read = (name: string, args = {}) =>
    act(() =>
      api("/v1/douyin/read", "POST", {
        tool: name,
        args,
        requestId: crypto.randomUUID(),
      }),
    );
  if (!state || !form) return <Loading>正在加载…</Loading>;
  return (
    <section>
      <h2>抖音</h2>
      <p>
        {state.config.enabled ? "已启用" : "未启用"} ·{" "}
        {state.browser.state === "ready" ? "浏览器已打开" : "浏览器已关闭"} ·{" "}
        {
          {
            verified: "账号已验证",
            "login-required": "需要登录",
            "account-mismatch": "账号不匹配",
            unverified: "账号未验证",
          }[state.accountState]
        }
      </p>
      <Disclosure  title={<>浏览器与账号设置</>}>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(() =>
              api("/v1/douyin", "PUT", { ...form, revision: state.revision }),
            );
          }}
        >
          <Field>
            <Checkbox

              checked={form.enabled}
              onCheckedChange={(value) => setForm({ ...form, enabled: value })}
            />
            启用
          </Field>
          <Field>
            浏览器路径（留空自动发现）
            <Input
              value={form.executablePath}
              onChange={(e) =>
                setForm({ ...form, executablePath: e.target.value })
              }
            />
          </Field>
          <Field>
            Python 路径
            <Input
              value={form.pythonPath}
              onChange={(e) => setForm({ ...form, pythonPath: e.target.value })}
            />
          </Field>
          <Field>
            账号 ID
            <Input
              value={form.accountId}
              onChange={(e) => setForm({ ...form, accountId: e.target.value })}
            />
          </Field>
          <Field>
            <Checkbox

              checked={form.headless}
              onCheckedChange={(value) => setForm({ ...form, headless: value })}
            />
            无窗口运行
          </Field>
          <Button type="submit" variant="primary" disabled={busy}>
            保存
          </Button>
        </form>
      </Disclosure>
      <ActionRow className="actions">
        <Button
          type="button"
          disabled={busy}
          onClick={() => void read("douyin_login_qr")}
        >
          打开登录
        </Button>
        <Button
          type="button"
          disabled={busy}
          onClick={() => void read("douyin_login_poll")}
        >
          检查登录
        </Button>
        <Button
          type="button"
          disabled={busy}
          onClick={() => void read("douyin_check_credential")}
        >
          验证账号
        </Button>
        <Button
          type="button"
          onClick={() => void act(() => api("/v1/douyin/close", "POST"))}
        >
          关闭浏览器
        </Button>
      </ActionRow>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void read("douyin_search", { keyword: query });
        }}
      >
        <ActionRow>
          <Field>
            搜索
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              required
            />
          </Field>
          <ActionRow>
            <Button type="submit" variant="primary" disabled={busy}>
              搜索
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={() => void read("douyin_feed")}
            >
              推荐
            </Button>
          </ActionRow>
        </ActionRow>
      </form>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void act(() =>
            api("/v1/douyin/watch", "POST", {
              videoId,
              audio,
              requestId: crypto.randomUUID(),
            }),
          );
        }}
      >
        <Field>
          视频 ID
          <Input
            value={videoId}
            onChange={(e) => setVideoId(e.target.value)}
            required
          />
        </Field>
        <Field>
          <Checkbox

            checked={audio}
            onCheckedChange={(value) => setAudio(value)}
          />
          理解采样音轨
        </Field>
        <ActionRow>
          <Button type="submit" variant="primary" disabled={busy}>
            观看
          </Button>
          <Button
            type="button"
            onClick={() => void read("douyin_video", { aweme_id: videoId })}
          >
            详情
          </Button>
          <Button
            type="button"
            onClick={() => void read("douyin_comments", { aweme_id: videoId })}
          >
            评论
          </Button>
        </ActionRow>
      </form>
      <Disclosure  title={<>准备互动</>}>

        <p>暂不支持私信、分享和投稿。</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const args =
              tool === "douyin_like"
                ? { aweme_id: videoId }
                : tool === "douyin_comment"
                  ? { aweme_id: videoId, text }
                  : tool === "douyin_chat_send"
                    ? { nickname, peer_id: peerId, text }
                    : tool === "douyin_share_video"
                      ? { aweme_id: videoId, nickname, peer_id: peerId }
                      : {
                          attachmentId,
                          title: text,
                          tags: "",
                          draft,
                          ai_declare: aiDeclare,
                        };
            void act(() => api("/v1/douyin/approvals", "POST", { tool, args }));
          }}
        >
          <Field>
            操作
            <Select value={tool} onValueChange={(value) => setTool(value)}>
              {Object.entries({
                douyin_like: "点赞",
                douyin_comment: "评论",
                douyin_chat_send: "私信",
                douyin_share_video: "分享视频",
                douyin_publish: "投稿",
              }).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          {["douyin_comment", "douyin_chat_send", "douyin_publish"].includes(
            tool,
          ) && (
            <Field>
              {tool === "douyin_publish" ? "标题" : "正文"}
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                required
              />
            </Field>
          )}
          {["douyin_chat_send", "douyin_share_video"].includes(tool) && (
            <Field>
              接收人昵称
              <Input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
              />
            </Field>
          )}
          {["douyin_chat_send", "douyin_share_video"].includes(tool) && (
            <Field>
              接收人 ID
              <Input
                value={peerId}
                onChange={(e) => setPeerId(e.target.value)}
                required
              />
            </Field>
          )}
          {tool === "douyin_publish" && (
            <>
              <Field>
                视频文件（最多16MB）
                <Input
                  type="file"
                  accept="video/mp4"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 16_000_000) {
                      fail("INVALID_MEDIA");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () =>
                      void act(async () => {
                        const v = await api<{ id: string }>(
                          "/v1/douyin/attachments",
                          "POST",
                          { data: String(reader.result).split(",")[1] },
                        );
                        setAttachmentId(v.id);
                      });
                    reader.readAsDataURL(f);
                  }}
                />
              </Field>
              <Field>
                <Checkbox

                  checked={draft}
                  onCheckedChange={(value) => setDraft(value)}
                />
                仅保存草稿
              </Field>
              <Field>
                <Checkbox

                  checked={aiDeclare}
                  onCheckedChange={(value) => setAiDeclare(value)}
                />
                声明 AI 生成
              </Field>
            </>
          )}
          <Button type="submit" variant="primary" disabled={busy}>
            生成审批预览
          </Button>
        </form>
      </Disclosure>
      <DouyinApprovals fail={fail} />
      <h3>最近任务</h3>
      <ActivityRows
        tasks={tasks.slice(0, 10)}
        fail={fail}
        refresh={refresh}
        onVideo={setVideoId}
      />
    </section>
  );
}
export function ActivityRows({
  tasks,
  fail,
  refresh,
  onVideo,
}: {
  tasks: ActivityTask[];
  fail: (e: unknown) => void;
  refresh: () => Promise<void>;
  onVideo?: (id: string) => void;
}) {
  return (
    <>
      {tasks.map((t) => (
        <Card key={t.id}>
          <p>
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
            · {activityState[t.status] ?? t.status} ·{" "}
            {t.mode === "Autonomous"
              ? "自主"
              : t.mode === "Scheduled"
                ? "定时"
                : "用户发起"}
          </p>
          {t.result?.evidence && typeof t.result.evidence === "object" ? (
            <p>
              {String(
                (t.result.evidence as Record<string, unknown>).title ?? "",
              )}{" "}
              ·{" "}
              {String(
                (t.result.evidence as Record<string, unknown>).observedAt ?? "",
              )}
              <br />
              {String((t.result.evidence as Record<string, unknown>).url ?? "")}
            </p>
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
                  {onVideo && !!item.aweme_id && (
                    <Button
                      type="button"
                      onClick={() => onVideo(String(item.aweme_id))}
                    >
                      选择视频
                    </Button>
                  )}
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
    </>
  );
}
export function DouyinApprovals({ fail }: { fail: (e: unknown) => void }) {
  const [items, setItems] = useState<StoredApproval[]>([]);
  const load = useCallback(async () => {
    try {
      setItems(await api("/v1/douyin/approvals"));
    } catch (e) {
      fail(e);
    }
  }, [fail]);
  usePoll(load);
  return (
    <>
      <h3>抖音审批</h3>
      {!items.length && <p>暂无待审批动作</p>}
      {items.slice(0, 10).map((a) => (
        <Card key={a.id}>
          <p>
            {
              (
                {
                  douyin_like: "点赞",
                  douyin_comment: "评论",
                  douyin_chat_send: "私信",
                  douyin_share_video: "分享视频",
                  douyin_publish: "投稿",
                } as Record<string, string>
              )[String(a.payload.tool)]
            }{" "}
            · {activityState[a.status]} · 账号 {String(a.payload.accountId)}
          </p>
          <dl className="approval-details">
            {Object.entries(a.payload.args as Record<string, unknown>).map(
              ([k, v]) => (
                <div key={k}>
                  <dt>
                    {(
                      {
                        aweme_id: "视频 ID",
                        text: "正文",
                        reply_cid: "回复评论 ID",
                        nickname: "接收人",
                        peer_id: "接收人 ID",
                        attachmentId: "附件",
                        title: "标题",
                        tags: "标签",
                        draft: "仅保存草稿",
                        ai_declare: "声明 AI 生成",
                        undo: "取消点赞",
                      } as Record<string, string>
                    )[k] ?? k}
                  </dt>
                  <dd>
                    {typeof v === "boolean"
                      ? v
                        ? "是"
                        : "否"
                      : String(v) || "无"}
                  </dd>
                </div>
              ),
            )}
          </dl>
          {!!a.payload.attachmentDigest && (
            <p>附件摘要：{String(a.payload.attachmentDigest)}</p>
          )}
          <small>有效至 {new Date(a.expiresAt).toLocaleString()}</small>
          <ActionRow className="approval-actions">
            {a.status === "pending" &&
              ["approve", "reject"].map((d) => (
                <Button
                  type="button"
                  key={d}
                  onClick={() =>
                    void api(`/v1/douyin/approvals/${a.id}/decide`, "POST", {
                      digest: a.digest,
                      decision: d,
                    })
                      .then(load)
                      .catch(fail)
                  }
                >
                  {d === "approve" ? "批准这次操作" : "拒绝"}
                </Button>
              ))}
            {["pending", "executing"].includes(a.status) && (
              <Button
                type="button"
                onClick={() =>
                  void api(`/v1/douyin/approvals/${a.id}/revoke`, "POST")
                    .then(load)
                    .catch(fail)
                }
              >
                撤销
              </Button>
            )}
          </ActionRow>
        </Card>
      ))}
    </>
  );
}
export function Activities({ fail }: { fail: (e: unknown) => void }) {
  const [data, setData] = useState<ActivityOverview>(),
    [platform, setPlatform] = useState("douyin"),
    [videoId, setVideoId] = useState(""),
    [interval, setInterval] = useState(60),
    [autonomous, setAutonomous] = useState(false);
  const load = useCallback(async () => {
    try {
      setData(await api("/v1/activities"));
    } catch (e) {
      fail(e);
    }
  }, [fail]);
  usePoll(load);
  return (
    <section>
      <h2>任务与调度</h2>
      <Button
        type="button"
        onClick={() =>
          void api("/v1/activities/pause", "POST", { paused: !data?.paused })
            .then(load)
            .catch(fail)
        }
      >
        {data?.paused ? "恢复活动" : "暂停全部活动"}
      </Button>
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
            .then(load)
            .catch(fail);
        }}
      >
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
          {autonomous ? "允许搜索的主题" : "允许观看的视频 ID（逗号分隔）"}
          <Input
            value={videoId}
            onChange={(e) => setVideoId(e.target.value)}
            required
          />
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
      <ActivityRows tasks={data?.tasks ?? []} fail={fail} refresh={load} />
    </section>
  );
}
