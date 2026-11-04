import { Card, Disclosure , Alert, Loading} from "./Surfaces";
import { Button, Field, Input, FormGrid } from "./Controls";
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
    [connections, setConnections] = useState(""),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const [a, d, b, q, approvals] = await Promise.all([
        api<ActivityOverview>("/v1/activities"),
        api<{ config: { enabled: boolean }; accountState: string }>(
          "/v1/douyin",
        ),
        api<{ enabled: boolean; accountState: string }>("/v1/bilibili"),
        api<{ health: { state: string } }>("/v1/channels/qq"),
        api<unknown[]>("/v1/douyin/approvals"),
      ]);
      setData(a);
      setConnections(
        `抖音${d.config.enabled ? (d.accountState === "verified" ? "账号已验证" : "账号未验证") : "未启用"} · B站${b.enabled ? (b.accountState === "verified" ? "账号已验证" : "账号未验证") : "未启用"} · QQ ${q.health.state === "online" ? "在线" : "未连接"} · 待审批 ${approvals.filter((v) => (v as { status: string }).status === "pending").length}`,
      );
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
                : "调度"}
            ：{activityState[t.status]}
          </p>
        ))}
      <p>{connections}</p>
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
    <section>
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
          <p>{data.persona.role}</p>
          <p>
            {data.mood
              ? `${data.mood.mood} · ${data.mood.reason}`
              : "平静 · 等待第一次聊天"}
          </p>
          <small>心情为活动驱动的模拟状态</small>
        </div>
      </div>
      <div className="life-grid">
        <Card>
          <h3>当前活动</h3>
          <CurrentActivities />
          {navigate && (
            <p>
              <Button type="button" onClick={() => navigate("任务")}>
                查看任务
              </Button>
            </p>
          )}
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
                : "暂无聊天或整理任务"}
          </p>
          <p>已确认 {data.confirmedCount} 条记忆</p>
        </Card>
        <Card>
          <h3>兴趣</h3>
          {data.interests.length ? (
            data.interests.map((m) => <p key={m.id}>{m.content}</p>)
          ) : (
            <p>还没有确认的兴趣。在记忆页添加或确认。</p>
          )}
        </Card>
        <Card>
          <h3>关系</h3>
          {data.relationships.length ? (
            data.relationships.map((m) => <p key={m.id}>{m.content}</p>)
          ) : (
            <p>还没有确认的关系。</p>
          )}
        </Card>
        <Card>
          <h3>最近经历</h3>
          {data.recent.length ? (
            data.recent.map((a) => (
              <p key={a.id}>
                {a.summary}{" "}
                <small>{new Date(a.occurredAt).toLocaleString()}</small>
              </p>
            ))
          ) : (
            <p>开始聊天，留下第一段经历。</p>
          )}
        </Card>
      </div>
      <h3>最近日记</h3>
      {data.diaries.length ? (
        data.diaries.map((d) => (
          <Card key={d.id}>
            <b>{d.day}</b>
            <p>{d.content.slice(0, 240)}</p>
          </Card>
        ))
      ) : (
        <p>暂无日记，可在生活页整理当天经历。</p>
      )}
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
    <div>
      {tasks.slice(0, 8).map((t) => (
        <div className="task-row" key={t.id}>
          {t.kind === "extract" ? "记忆整理" : "日记"} · {taskState[t.status]} ·{" "}
          {t.modelId}{" "}
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
    </div>
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
    <section>
      <h2>经历与日记</h2>
      <CurrentActivities />
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
        <FormGrid>
          <Field>
            日记日期
            <Input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              required
            />
          </Field>
          <Field>
            时区
            <Input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              required
            />
          </Field>
        </FormGrid>
        <Button type="submit" variant="primary" disabled={busy}>
          生成或更新日记
        </Button>
      </form>
      <TaskList
        tasks={tasks.filter((t) => t.kind === "diary")}
        refresh={load}
        fail={fail}
      />
      <h3>日记</h3>
      {!diaries.length && <p>暂无日记。完成聊天后，选择日期生成。</p>}
      {diaries.map((d) => (
        <Card key={d.id}>
          <h3>
            {d.day}{" "}
            <small>
              {d.timezone} · 第 {d.version} 版
            </small>
          </h3>
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
      <h3>经历时间线</h3>
      {!timeline.length && <p>暂无经历，开始聊天后会记录实际活动。</p>}
      {timeline.map((a) => (
        <Card key={a.id}>
          <time>{new Date(a.occurredAt).toLocaleString()}</time>
          <p>{a.summary}</p>
        </Card>
      ))}
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
    </Disclosure>
  );
}
