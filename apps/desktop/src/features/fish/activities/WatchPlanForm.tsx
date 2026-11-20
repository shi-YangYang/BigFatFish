import { useRef, useState, type FormEvent } from "react";
import { api } from "../../../api/client";
import { errorText } from "../../../api/errors";
import { Button, Field, Input, Select, Textarea } from "../../../components/Controls";
import { Alert } from "../../../components/Surfaces";
import { Tabs } from "../../../components/UI";
import { readWatchPlan, type WatchMode, type WatchPlanDraft } from "./watch-plan";

export function WatchPlanForm({draft, change, saved}:{
  draft:WatchPlanDraft; change:(next:WatchPlanDraft)=>void; saved:()=>void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  function edit(patch:Partial<WatchPlanDraft>) {
    setError("");
    change({...draft, ...patch});
  }
  async function submit(event:FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    const result = readWatchPlan(draft);
    if ("error" in result) { setError(result.error); return; }
    pending.current = true;
    setBusy(true); setError("");
    try {
      await api("/v1/schedules", "POST", result.schedule);
      saved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      pending.current = false; setBusy(false);
    }
  }
  return <Tabs<WatchMode> items={["按兴趣看", "看指定视频"]} value={draft.mode}
    label="观看方式" onChange={mode=>{ if (!pending.current) edit({mode}); }}>
    <form onSubmit={submit}>
      <Field>平台<Select value={draft.platform} disabled={busy} onValueChange={platform=>{
        if (platform === "bilibili" || platform === "douyin") edit({platform});
      }}>
        <option value="douyin">抖音</option><option value="bilibili">B站</option>
      </Select></Field>
      {draft.mode === "按兴趣看"
        ? <Field>兴趣主题<Input required maxLength={200} disabled={busy} placeholder="例如：海洋生物"
            value={draft.topic} onChange={e=>edit({topic:e.target.value})} /></Field>
        : <Field>视频链接或 ID<Textarea required rows={3} disabled={busy}
            placeholder={`粘贴视频页完整链接或${draft.platform==="bilibili"?" BV 号":"数字 ID"}，每行一个`}
            value={draft.videos[draft.platform]} onChange={e=>edit({videos:{...draft.videos,[draft.platform]:e.target.value}})} /></Field>}
      <Field>间隔（分钟）<Input type="number" required min={1} max={10080} step={1} disabled={busy}
        value={draft.intervalMinutes} onChange={e=>edit({intervalMinutes:e.target.value})} /></Field>
      {error && <Alert role="alert">{error}</Alert>}
      <Button type="submit" variant="primary" busy={busy}>启用计划</Button>
    </form>
  </Tabs>;
}
