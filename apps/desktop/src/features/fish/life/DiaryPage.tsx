import { useCallback, useState } from "react";
import { api } from "../../../api/client";
import { ActionRow, Button, Field, Input } from "../../../components/Controls";
import { EmptyState, PageStack, SectionHeading } from "../../../components/PageLayout";
import { Alert, ContentScroll, Disclosure, Loading } from "../../../components/Surfaces";
import { Drawer } from "../../../components/UI";
import type { Diary, MemoryTask } from "../../../../../runtime/src/memory/types";
import { DiaryEntry } from "./DiaryEntry";
import { DiarySettings } from "./DiarySettings";
import { Sources, TaskList, useLifeRefresh } from "./Life";

export function DiaryPage({ fail, startWriting = false }: { fail: (e: unknown) => void; startWriting?: boolean }) {
  const [panel, setPanel] = useState<"write" | "options" | null>(startWriting ? "write" : null);
  const [ready, setReady] = useState(false);
  const [diaries, setDiaries] = useState<Diary[]>([]),
    [tasks, setTasks] = useState<MemoryTask[]>([]),
    [day, setDay] = useState(new Date().toLocaleDateString("en-CA")),
    [timezone, setTimezone] = useState(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
    [busy, setBusy] = useState(false);
  const load = useCallback(async (isCurrent: () => boolean = () => true) => {
    const [entries, jobs] = await Promise.all([
      api<Diary[]>("/v1/diaries"),
      api<MemoryTask[]>("/v1/memory-tasks"),
    ]);
    if (isCurrent()) {
      setReady(true);
      setDiaries(entries);
      setTasks(jobs.filter(t => t.kind === "diary"));
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
      setPanel(null);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <PageStack className="fish-journal">
      {refreshError && (
        <Alert role="alert" className="error">
          {refreshError}
        </Alert>
      )}
      <section className="fish-reading-section">
      <SectionHeading title="日记" actions={<ActionRow>
        <Button size="compact" onClick={() => setPanel("write")}>手动写日记</Button>
        <Button size="compact" variant="ghost" onClick={() => setPanel("options")}>日记设置</Button>
      </ActionRow>} />
      {!ready && !refreshError && <Loading>正在读取日记…</Loading>}
      {ready && !diaries.length && <EmptyState title="还没有日记。" />}
      <ContentScroll label="日记" className="content-scroll-list">
      {diaries.map((d) => (
        <DiaryEntry key={d.id} day={d.day} content={d.content}>
          <Sources sources={d.sources} fail={fail} />
          {d.copyStatus !== "ready" && <><p className="muted">文件副本保存失败，日记仍保存在应用中。</p>
          <Button
            type="button"
            onClick={() =>
              void api(`/v1/diaries/${d.id}/rebuild`, "POST")
                .then(() => load())
                .catch(fail)
            }
          >
            重试保存副本
          </Button></>}
        </DiaryEntry>
      ))}
      </ContentScroll>
      </section>
      {tasks.length > 0 && <Disclosure title="日记生成记录" className="secondary-options"><TaskList tasks={tasks} refresh={load} fail={fail} /></Disclosure>}
      {panel === "options" && <Drawer title="日记设置" close={() => setPanel(null)}><DiarySettings onSaved={() => setPanel(null)}/></Drawer>}
      {panel === "write" && <Drawer title="手动写日记" close={() => { if (!busy) setPanel(null); }}>
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
          <Button type="submit" variant="primary" busy={busy} disabled={busy}>
            生成或更新日记
          </Button>
        </ActionRow>
        <p className="muted">使用聊天模型，根据这一天的经历写日记。</p>
        <Disclosure title="日期设置" className="secondary-options">
          <Field>
            时区
            <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} required />
          </Field>
        </Disclosure>
      </form>
      </Drawer>}
    </PageStack>
  );
}
