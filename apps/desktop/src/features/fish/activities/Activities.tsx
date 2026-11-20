import { PageStack, SectionHeading, EmptyState } from "../../../components/PageLayout";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ActivityTask } from "../../../../../runtime/src/tasks/queue";
import { Card, ContentScroll, Alert, Loading } from "../../../components/Surfaces";
import { ActionRow, Button } from "../../../components/Controls";
import { Drawer } from "../../../components/UI";
import { api } from "../../../api/client";
import { errorText } from "../../../api/errors";
import { cancelActivity, loadActivities, type ActivityOverview } from "../../../api/activities";
import { activityState, actionNames } from "./activity-labels";
import { usePoll } from "../../../hooks/usePoll";
import { WatchPlanForm } from "./WatchPlanForm";
import { newWatchPlan, type WatchPlatform } from "./watch-plan";

function ActivityRows({
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
                void cancelActivity(t.id)
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
export type PlanIntent = { platform: WatchPlatform; id: number };

export function Activities({ fail, planIntent, onPlanHandled }: {
  fail: (e: unknown) => void;
  planIntent?: PlanIntent;
  onPlanHandled?: (id: number) => void;
}) {
  const [data, setData] = useState<ActivityOverview>(),
    [draft, setDraft] = useState(() => newWatchPlan()),
    [readError, setReadError] = useState(""),
    [creating, setCreating] = useState(false);
  const consumed = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!planIntent || consumed.current === planIntent.id) return;
    consumed.current = planIntent.id;
    setDraft(newWatchPlan(planIntent.platform));
    setCreating(true);
    onPlanHandled?.(planIntent.id);
  }, [planIntent, onPlanHandled]);
  const load = useCallback(async () => {
    try {
      setData(await loadActivities());
      setReadError("");
    } catch (e) {
      setReadError(errorText(e));
    }
  }, []);
  usePoll(load);
  return (
    <PageStack className="fish-plans">
      <SectionHeading title="活动计划" actions={<ActionRow>
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
          <Button variant="primary" aria-expanded={creating} onClick={() => setCreating(!creating)}>创建计划</Button>
        </ActionRow>} />
      {creating && <Drawer title="创建计划" close={() => setCreating(false)}>
        <WatchPlanForm draft={draft} change={setDraft} saved={() => {
          setCreating(false); setDraft(newWatchPlan(draft.platform)); void load();
        }} />
      </Drawer>}
      {readError && <Alert role="alert">{readError}</Alert>}
      {!data && !readError && <Loading>正在读取活动计划…</Loading>}
      {data && !data.schedules.length && <EmptyState title="还没有活动计划。" />}
      {data?.schedules.map((s) => (
        <Card className="fish-plan-row" key={s.id}>
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
      {!!data?.tasks.length && <SectionHeading level={3} title="活动记录" />}
      <ActivityRows tasks={data?.tasks ?? []} fail={fail} refresh={load} />
    </PageStack>
  );
}
