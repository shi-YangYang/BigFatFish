import { PageStack, SectionHeading, EmptyState } from "../../../components/PageLayout";
import { DiaryEntry } from "./DiaryEntry";
import "../fish.css";
import { visibleExperiences } from "./life-presentation";
import { usePoll } from "../../../hooks/usePoll";
import { loadActivities, type ActivityOverview } from "../../../api/activities";
import { activityState } from "../activities/activity-labels";
import { ContentScroll, Card, Disclosure, Alert, Loading } from "../../../components/Surfaces";
import { Button, ActionRow } from "../../../components/Controls";
import { FishAvatar } from "../../../components/UI";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../../api/client";
import { errorText } from "../../../api/errors";
import type {
  LifeOverview,
  Activity,
  MemoryTask,
  Source,
} from "../../../../../runtime/src/memory/types";
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
function CurrentActivities({ life }: { life: LifeOverview }) {
  const [data, setData] = useState<ActivityOverview>();
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { setData(await loadActivities()); setError(""); }
    catch (e) { setError(errorText(e)); }
  }, []);
  usePoll(load);
  const current = data?.tasks.filter(t => ["queued", "running", "understanding"].includes(t.status)) ?? [];
  if (!error && !current.length && !life.activity.length && !life.chattingCount && !data?.paused) return null;
  return <section className="fish-reading-section">
    <SectionHeading level={3} title="当前活动" />
    {error && <Alert role="alert">{error}</Alert>}
    <ContentScroll label="当前活动">
      {data?.paused && <p>活动已暂停</p>}
      {!!life.chattingCount && <p>正在聊天</p>}
      {life.activity.map(t => <p key={t.id}>{t.kind === "extract" ? "记忆整理" : "写日记"}：{taskState[t.status]}</p>)}
      {current.map(t => <p key={t.id}>{t.platform === "douyin" ? "抖音" : t.platform === "bilibili" ? "B站" : "活动"}：{activityState[t.status]}</p>)}
    </ContentScroll>
  </section>;
}
export function Home({ navigate, onChat }: { navigate?: (page: string) => void; onChat?: () => void }) {
  const [data, setData] = useState<LifeOverview>();
  const load = useCallback(async (isCurrent: () => boolean = () => true) => {
    const value = await api<LifeOverview>("/v1/life");
    if (isCurrent()) setData(value);
  }, []);
  const refreshError = useLifeRefresh(load);
  if (!data) return refreshError ? <Alert>{refreshError}</Alert> : <Loading />;
  const diary = data.diaries[0];
  return <PageStack className="fish-overview">
    {refreshError && <Alert role="alert">{refreshError}</Alert>}
    <div className="fish-home">
      {data.persona.avatar ? <img className="avatar" src={data.persona.avatar} alt={data.persona.name} /> : <FishAvatar />}
      <div>
        <SectionHeading title={data.persona.name} />
        <p>{data.mood ? [data.mood.mood, data.mood.reason].filter(Boolean).join(" · ") : "今天还没有记下心情"}</p>
      </div>
      {onChat && <div className="fish-memory-count"><Button onClick={onChat}>和它聊聊</Button></div>}
    </div>
    {diary && <section className="fish-reading-section">
      <SectionHeading title="最近日记" level={3} actions={navigate && <Button size="compact" onClick={() => navigate("日记")}>查看全部日记</Button>} />
      <DiaryEntry day={diary.day} content={diary.content.slice(0, 240)} />
    </section>}
    <CurrentActivities life={data} />
    {navigate && (!diary || data.confirmedCount > 0) && <ActionRow>
      {!diary && <Button variant="ghost" onClick={() => navigate("写日记")}>去写第一篇</Button>}
      {data.confirmedCount > 0 && <Button variant="ghost" onClick={() => navigate("记忆")}>已记住 {data.confirmedCount} 条</Button>}
    </ActionRow>}
  </PageStack>;
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
          <div className="task-summary"><strong>{t.kind === "extract" ? "记忆整理" : "日记"} · {taskState[t.status]}</strong></div>
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
export function Experiences() {
  const [timeline, setTimeline] = useState<Activity[]>();
  const load = useCallback(async (isCurrent: () => boolean = () => true) => {
    const items = await api<Activity[]>("/v1/life/timeline");
    if (isCurrent()) setTimeline(visibleExperiences(items));
  }, []);
  const error = useLifeRefresh(load);
  return <PageStack className="fish-journal">
    <section className="fish-reading-section">
      <SectionHeading title="经历时间线" />
      {error && <Alert role="alert">{error}</Alert>}
      {!timeline && !error && <Loading>正在读取经历…</Loading>}
      {timeline?.length === 0 && <EmptyState title="暂无经历" description="开始聊天后会记录实际活动。" />}
      {!!timeline?.length && <ContentScroll label="经历时间线" className="content-scroll-list">
        {timeline.map(a => <div className="timeline-entry" key={a.id}>
          <time>{new Date(a.occurredAt).toLocaleString()}</time>
          <p>{a.summary}</p>
        </div>)}
      </ContentScroll>}
    </section>
  </PageStack>;
}

type SourceListProps = { sources: Source[]; fail: (error: unknown) => void };

export function Sources(props: SourceListProps) {
  if (!props.sources.length) return null;
  return <Disclosure title={<>查看来源（{props.sources.length}）</>}>
    <SourceList {...props} />
  </Disclosure>;
}

export function SourceList({sources, fail}: SourceListProps) {
  const [original, setOriginal] = useState<{
    content: string;
    conversationId?: string;
    occurredAt: string;
  }>();
  return (
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
                : "活动"}
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
          <h3>{original.conversationId ? "聊天原文" : "活动原文"}</h3>
          <p className="prewrap">{original.content}</p>
          <Button type="button" onClick={() => setOriginal(undefined)}>
            收起原文
          </Button>
        </Card>
      )}
      </ContentScroll>
  );
}
