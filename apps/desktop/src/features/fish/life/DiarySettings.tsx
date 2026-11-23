import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../../../api/client";
import { errorText } from "../../../api/errors";
import { ActionRow, Button, Checkbox, Field, FormGrid, Input, Select } from "../../../components/Controls";
import { Alert, Loading } from "../../../components/Surfaces";
import type { DiaryOptions } from "../../../../../runtime/src/memory/life/diary-auto";

type Status = DiaryOptions & { last: {day:string; status:string; error:string|null} | null };
type Draft = Pick<DiaryOptions, "enabled" | "hour" | "timezone">;

export function DiarySettings({ onSaved }: { onSaved: () => void }) {
  const [options, setOptions] = useState<Status>();
  const [draft, setDraft] = useState<Draft>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const saving = useRef(false), mounted = useRef(false);

  useEffect(() => {
    let current = true;
    mounted.current = true;
    setError("");
    void api<Status>("/v1/diary-options").then(value => {
      if (!current) return;
      setOptions(value);
      setDraft({enabled: value.enabled, hour: value.hour, timezone: value.timezone});
    }).catch(cause => {
      if (current) setError(/404|NOT_FOUND|Route .*not found/i.test(String(cause))
        ? "自动日记需要重启新版后台后使用。" : errorText(cause));
    });
    return () => { current = false; mounted.current = false; };
  }, [retry]);

  if (!options || !draft) return error
    ? <ActionRow><span className="muted">{error}</span><Button size="compact" onClick={() => setRetry(n => n + 1)}>重试</Button></ActionRow>
    : <Loading>正在读取日记设置…</Loading>;

  // Pausing keeps the last saved schedule, even if there were unfinished edits.
  const value = draft.enabled ? { ...draft, timezone: draft.timezone.trim() }
    : { enabled:false, hour:options.hour, timezone:options.timezone };
  const changed = value.enabled !== options.enabled || value.hour !== options.hour || value.timezone !== options.timezone;
  const edit = (patch: Partial<Draft>) => { setError(""); setDraft({...draft, ...patch}); };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving.current || conflict || !changed) return;
    saving.current = true; setBusy(true); setError("");
    try {
      await api("/v1/diary-options", "PUT", { ...value, revision:options.revision });
      if (mounted.current) onSaved();
    } catch (cause) {
      if (!mounted.current) return;
      if ((cause instanceof Error ? cause.message : String(cause)) === "DIARY_SETTINGS_CHANGED") {
        setConflict(true);
        setError("日记设置已在别处修改，本次更改未保存。重新载入会放弃当前修改。");
      } else setError(errorText(cause));
    }
    finally { saving.current = false; if (mounted.current) setBusy(false); }
  };

  return <form className="diary-settings-form" onSubmit={save}>
    <div className="diary-settings-mode">
      <Field><Checkbox checked={draft.enabled} disabled={busy || conflict} onCheckedChange={enabled => edit({enabled})} />自动写日记</Field>
      <p className="muted">使用聊天模型整理当天经历，会消耗少量额度。</p>
    </div>
    {draft.enabled && <FormGrid>
      <Field>写日记的时间<Select value={String(draft.hour)} disabled={busy || conflict} onValueChange={hour => edit({hour:Number(hour)})}>
        {Array.from({length:24}, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
      </Select></Field>
      <Field>时区<Input value={draft.timezone} required disabled={busy || conflict} onChange={e => edit({timezone:e.target.value})} /></Field>
    </FormGrid>}
    {options.last && ["failed", "retry"].includes(options.last.status) &&
      <p className="muted">{options.last.day} 的日记暂未写成，{options.last.status === "retry" ? "稍后重试。" : "可以手动补写。"}</p>}
    {error && <Alert role="alert">{error}</Alert>}
    <ActionRow className="diary-settings-actions">
      {conflict ? <Button onClick={() => {
        setOptions(undefined); setDraft(undefined); setError(""); setConflict(false); setRetry(n => n + 1);
      }}>重新载入</Button> : <Button type="submit" variant="primary" busy={busy} disabled={!changed || !value.timezone}>保存</Button>}
    </ActionRow>
  </form>;
}
