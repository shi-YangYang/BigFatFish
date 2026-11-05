import { ContentScroll, Card, Disclosure , Alert, Loading} from "./Surfaces";
import { Button, Field, Input, ActionRow } from "./Controls";
import { FishAvatar } from "./UI";
import { usePoll, activityState, type ActivityOverview } from "./Douyin";
import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "../api";
import type {
  LifeOverview,
  Activity,
  Diary,
  MemoryTask,
  Source,
} from "../../../runtime/src/memory/types";
export const taskState: Record<string, string> = {
  queued: "等待整理",
  running: "正在整理",
  completed: "已完成",
  partial: "日记已保存，文件副本失败",
  failed: "整理失败",
  cancelled: "已取消",
  interrupted: "服务重启，已中断",
};
export function useLifeRefresh(
  load: (isCurrent?: () => boolean) => Promise<void>,
) {
  const [refreshError, setRefreshError] = useState("");
  useEffect(() => {
    let active = true,
      timer: ReturnType<typeof setTimeout>,
      previous = "";
    const refresh = async () => {
      try {
        const { revision } = await api<{ revision: string }>(
          "/v1/life/updates",
        );
        if (active && revision !== previous) {
          await load(() => active);
          if (active) {
            previous = revision;
            setRefreshError("");
          }
        }
      } catch (e) {
        if (active) setRefreshError(errorText(e));
      } finally {
        if (active) timer = setTimeout(() => void refresh(), 1500);
      }
    };
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [load]);
  return refreshError;
}
function CurrentActivities() {
  const [data, setData] = useState<ActivityOverview>(),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setData(await api<ActivityOverview>("/v1/activities"));
      setError("");
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  usePoll(load);
  return (
    <>
      {error && <Alert role="alert">{error}</Alert>}
      {data?.paused && <p>活动已暂停</p>}
      {data?.tasks
        .filter((t) =>
          ["queued", "running", "understanding"].includes(t.status),
        )
        .map((t) => (
          <p key={t.id}>
            {t.platform === "douyin"
              ? "抖音"
              : t.platform === "bilibili"
                ? "B站"
                : "活动"}
            ：{activityState[t.status]}
          </p>
        ))}
    </>
  );
}
export function Home({ navigate }: { navigate?: (page: string) => void }) {
  const [data, setData] = useState<LifeOverview>();
  const load = useCallback(async (isCurrent: () => boolean = () => true) => {
    const value = await api<LifeOverview>("/v1/life");
    if (isCurrent()) setData(value);
  }, []);
  const refreshError = useLifeRefresh(load);
  if (!data) return refreshError ? <Alert>{refreshError}</Alert> : <Loading />;
  return (
    <section className="page-section">
      {refreshError && (
        <Alert role="alert" className="error">
          {refreshError}
        </Alert>
      )}
      <div className="fish-home">
        {data.persona.avatar ? (
          <img
            className="avatar"
            src={data.persona.avatar}
            alt={data.persona.name}
          />
        ) : (
          <FishAvatar />
        )}
        <div>
          <h2>{data.persona.name}</h2>
          <p>
            {data.mood
              ? `${data.mood.mood} · ${data.mood.reason}`
              : "平静 · 等待第一次聊天"}
          </p>
        </div>
      </div>
      <div className="life-grid">
        <Card>
          <h3>当前活动</h3>
          <ContentScroll label="当前活动">
          <CurrentActivities />
          <p>
            {data.activity.length
              ? data.activity
                  .map(
                    (t) =>
                      `${t.kind === "extract" ? "记忆整理" : "写日记"}：${taskState[t.status]}`,
                  )
                  .join("；")
              : data.chattingCount
                ? "正在聊天"
                : "暂无聊天或记忆整理"}
          </p>
          <p>已确认 {data.confirmedCount} 条记忆</p>
          </ContentScroll>
          {navigate && (
            <p>
              <Button type="button" onClick={() => navigate("任务")}>
                查看活动计划
              </Button>
            </p>
          )}
        </Card>
        {(data.interests.length > 0 || data.relationships.length > 0) && <Card>
          <h3>兴趣与关系</h3>
          <ContentScroll label="兴趣与关系">
          {data.interests.map((m) => <p key={m.id}>{m.content}</p>)}
          {data.relationships.map((m) => <p key={m.id}>{m.content}</p>)}
          </ContentScroll>
        </Card>}
        <Card>
          <h3>最近经历</h3>
          <ContentScroll label="最近经历" className="overview-recent">
          {data.recent.length ? (
            data.recent.map((a) => (
              <div key={a.id} className="summary-entry">
                <p>{a.summary}</p>
                <time>{new Date(a.occurredAt).toLocaleString()}</time>
              </div>
            ))
          ) : (
            <p>开始聊天，留下第一段经历。</p>
          )}
          </ContentScroll>
        </Card>
      </div>
      <h3>最近日记</h3>
      <ContentScroll label="最近日记" className="content-scroll-list">
      {data.diaries.length ? (
        data.diaries.map((d) => (
          <Card key={d.id}>
            <b>{d.day}</b>
            <p>{d.content.slice(0, 240)}</p>
          </Card>
        ))
      ) : (
        <p className="muted">还没有日记。<Button variant="ghost" onClick={() => navigate?.("经历")}>去写第一篇</Button></p>
      )}
      </ContentScroll>
    </section>
  );
}
export function TaskList({
  tasks,
  refresh,
  fail,
}: {
  tasks: MemoryTask[];
  refresh: () => Promise<void>;
  fail: (e: unknown) => void;
}) {
  return (
    <ContentScroll label="整理任务" className="task-list">
      {tasks.slice(0, 8).map((t) => (
        <div className="task-row" key={t.id}>
          <div className="task-summary"><strong>{t.kind === "extract" ? "记忆整理" : "日记"} · {taskState[t.status]}</strong><span className="muted">{t.modelId}</span></div>
          {t.error && <Alert>{errorText(t.error)}</Alert>}{" "}
          {["queued", "running"].includes(t.status) && (
            <Button
              type="button"
              onClick={() =>
                void api(`/v1/memory-tasks/${t.id}/cancel`, "POST")
                  .then(refresh)
                  .catch(fail)
              }
            >
              取消
            </Button>
          )}
        </div>
      ))}
    </ContentScroll>
  );
}
export function Life({ fail }: { fail: (e: unknown) => void }) {
  const [timeline, setTimeline] = useState<Activity[]>([]),
    [diaries, setDiaries] = useState<Diary[]>([]),
    [tasks, setTasks] = useState<MemoryTask[]>([]),
    [day, setDay] = useState(new Date().toLocaleDateString("en-CA")),
    [timezone, setTimezone] = useState(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
    [busy, setBusy] = useState(false);
  const load = useCallback(async (isCurrent: () => boolean = () => true) => {
    const [a, b, c] = await Promise.all([
      api<Activity[]>("/v1/life/timeline"),
      api<Diary[]>("/v1/diaries"),
      api<MemoryTask[]>("/v1/memory-tasks"),
    ]);
    if (isCurrent()) {
      setTimeline(a);
      setDiaries(b);
      setTasks(c);
    }
  }, []);
  const refreshError = useLifeRefresh(load);
  const generate = async () => {
    setBusy(true);
    try {
      await api("/v1/memory-tasks/diary", "POST", {
        day,
        timezone,
        requestId: crypto.randomUUID(),
      });
      await load();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="page-section">
      <h2>经历与日记</h2>
      {refreshError && (
        <Alert role="alert" className="error">
          {refreshError}
        </Alert>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void generate();
        }}
      >
        <ActionRow className="diary-controls">
          <Field>
            日记日期
            <Input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" variant="primary" disabled={busy}>
            生成或更新日记
          </Button>
        </ActionRow>
        <Disclosure title="日期设置" className="secondary-options">
          <Field>
            时区
            <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} required />
          </Field>
        </Disclosure>
      </form>
      <TaskList
        tasks={tasks.filter((t) => t.kind === "diary")}
        refresh={load}
        fail={fail}
      />
      <h3>日记</h3>
      {!diaries.length && <p>暂无日记。完成聊天后，选择日期生成。</p>}
      <ContentScroll label="日记" className="content-scroll-list">
      {diaries.map((d) => (
        <Card key={d.id}>
          <div className="record-title"><h3>{d.day}</h3><span className="muted">{d.timezone} · 第 {d.version} 版</span></div>
          <p className="prewrap">{d.content}</p>
          <Sources sources={d.sources} fail={fail} />
          <p>
            {d.copyStatus === "ready"
              ? "Markdown 副本已保存"
              : "Markdown 副本保存失败，日记仍保存在应用中"}
          </p>
          <Button
            type="button"
            onClick={() =>
              void api(`/v1/diaries/${d.id}/rebuild`, "POST")
                .then(() => load())
                .catch(fail)
            }
          >
            重建副本
          </Button>
        </Card>
      ))}
      </ContentScroll>
      <h3>经历时间线</h3>
      {!timeline.length && <p>暂无经历，开始聊天后会记录实际活动。</p>}
      <ContentScroll label="经历时间线" className="content-scroll-list">
      {timeline.map((a) => (
        <div className="timeline-entry" key={a.id}>
          <time>{new Date(a.occurredAt).toLocaleString()}</time>
          <p>{a.summary}</p>
        </div>
      ))}
      </ContentScroll>
    </section>
  );
}

export function Sources({
  sources,
  fail,
}: {
  sources: Source[];
  fail: (e: unknown) => void;
}) {
  const [original, setOriginal] = useState<{
    content: string;
    conversationId?: string;
    occurredAt: string;
  }>();
  return (
    <Disclosure  title={<>查看来源（{sources.length}）</>}>
      <ContentScroll label="来源记录">
      {sources.map((s) => (
        <p key={s.type + s.id}>
          {s.quote}
          <small>
            {" "}
            {s.type === "message"
              ? "聊天"
              : s.type === "user"
                ? "用户填写"
                : "活动"}{" "}
            · {s.id}
            {s.author && ` · ${s.author}`}
          </small>
          {s.type !== "user" && (
            <Button
              type="button"
              onClick={() =>
                void api<{
                  content: string;
                  conversationId?: string;
                  occurredAt: string;
                }>("/v1/life/source", "POST", { type: s.type, id: s.id })
                  .then(setOriginal)
                  .catch(fail)
              }
            >
              打开原文
            </Button>
          )}
        </p>
      ))}
      {original && (
        <Card>
          <time>{new Date(original.occurredAt).toLocaleString()}</time>
          {original.conversationId && <p>会话：{original.conversationId}</p>}
          <p className="prewrap">{original.content}</p>
          <Button type="button" onClick={() => setOriginal(undefined)}>
            收起原文
          </Button>
        </Card>
      )}
      </ContentScroll>
    </Disclosure>
  );
}
