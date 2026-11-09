import { useCallback, useState } from "react";
import type { ActivityTask } from "../../../../runtime/src/tasks/queue";
import { Card, ContentScroll, Alert } from "../../components/Surfaces";
import { ActionRow, Field, Input, Button, Select, FormGrid, Checkbox } from "../../components/Controls";
import { Drawer } from "../../components/UI";
import { api } from "../../api/client";
import { errorText } from "../../api/errors";
import { cancelActivity, loadActivities, type ActivityOverview } from "../../api/activities";
import { activityState, actionNames } from "./activity-labels";
import { usePoll } from "../../hooks/usePoll";

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
export function Activities({ fail }: { fail: (e: unknown) => void }) {
  const [data, setData] = useState<ActivityOverview>(),
    [platform, setPlatform] = useState("douyin"),
    [videoId, setVideoId] = useState(""),
    [interval, setInterval] = useState(60),
    [autonomous, setAutonomous] = useState(false),
    [creating, setCreating] = useState(false);
  const load = useCallback(async () => {
    try {
      setData(await loadActivities());
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
          <Button variant="primary" aria-expanded={creating} onClick={() => setCreating(!creating)}>创建计划</Button>
        </ActionRow>
      </div>
      {creating && <Drawer title="创建计划" close={() => setCreating(false)}>
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
      </Drawer>}
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
