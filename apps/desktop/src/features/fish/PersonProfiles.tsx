import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Memory, ProfileEntry } from "../../../../runtime/src/memory/types";
import { api } from "../../api/client";
import { errorText } from "../../api/errors";
import { ActionRow, Button, Field, Textarea } from "../../components/Controls";
import { Alert, Card, ContentScroll, Loading } from "../../components/Surfaces";
import { Drawer } from "../../components/UI";
import { Sources } from "./Life";

function origin(entry: ProfileEntry) {
  const [, , room, id] = entry.scopeKey.split(":");
  const person = entry.role === "owner" ? "主人" : `QQ ${entry.personKey.split(":").at(-1)}`;
  if (room === "group") return `${person} · QQ 群 ${id}`;
  return entry.role === "owner" ? "主人 · 私聊" : `${person} · 好友私聊`;
}

function ProfileDetail({ entry, close, refresh, fail }: {
  entry: ProfileEntry;
  close: () => void;
  refresh: () => Promise<void>;
  fail: (error: unknown) => void;
}) {
  const [memory, setMemory] = useState<Memory>();
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const route = `/v1/memories/${entry.memoryId}`;
  useEffect(() => {
    let active = true;
    api<Memory>(route).then(record => { if (active) setMemory(record); })
      .catch(e => { if (active) setError(errorText(e)); });
    return () => { active = false; };
  }, [route]);

  async function change(remove: boolean) {
    if (!memory || pending.current) return;
    if (remove && !window.confirm(`删除「${memory.content}」这条来源记忆？由它整理的资料也会移除，聊天原文会保留。`)) return;
    pending.current = true;
    setBusy(true);
    try {
      if (remove) await api(route + "/delete", "POST", { version: memory.version });
      else await api(route, "PUT", { content: draft.trim(), version: memory.version });
      close();
      await refresh();
    } catch (e) { fail(e); }
    finally { pending.current = false; setBusy(false); }
  }

  return <Drawer title={entry.label} close={() => { if (!pending.current) close(); }}>
    <p className="muted">{origin(entry)}{entry.asOf && ` · ${entry.asOf} 记录`}</p>
    {error ? <Alert role="alert">{error}</Alert> : !memory ? <Loading /> : <>
      {editing ? <form onSubmit={event => { event.preventDefault(); void change(false); }}>
        <Field>来源记忆<Textarea value={draft} required maxLength={2000} disabled={busy}
          onChange={event => setDraft(event.target.value)} /></Field>
        <ActionRow>
          <Button variant="primary" type="submit" disabled={busy || !draft.trim() || draft.trim() === memory.content}>保存更正</Button>
          <Button disabled={busy} onClick={() => setEditing(false)}>取消</Button>
        </ActionRow>
      </form> : <>
        <h3>来源记忆</h3>
        <p className="prewrap">{memory.content}</p>
        <ActionRow>
          <Button disabled={busy} onClick={() => { setDraft(memory.content); setEditing(true); }}>更正记忆</Button>
          <Button disabled={busy} onClick={() => void change(true)}>删除记忆</Button>
        </ActionRow>
      </>}
      <Sources sources={memory.sources.slice().sort((a, b) => Number(b.type === entry.source.type && b.id === entry.source.id) - Number(a.type === entry.source.type && a.id === entry.source.id))} fail={fail} />
    </>}
  </Drawer>;
}

export function PersonProfiles({ entries, refresh, fail }: {
  entries: ProfileEntry[];
  refresh: () => Promise<void>;
  fail: (error: unknown) => void;
}) {
  const [selected, setSelected] = useState<ProfileEntry>();
  const groups = new Map<string, ProfileEntry[]>();
  for (const entry of entries) {
    const key = `${entry.personKey}/${entry.scopeKey}`;
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }
  return <>
    {!entries.length && <p className="muted">暂无符合条件的人物资料。</p>}
    <ContentScroll label="人物资料" className="content-scroll-list">
      {Array.from(groups, ([id, group]) =>
        <Card key={id}><h3>{origin(group[0]!)}</h3>
          <div className="profile-fields">
            {group.map(entry => <Button variant="ghost" key={entry.memoryId + entry.key} className="profile-field"
              aria-label={`查看${entry.label}，${entry.value}`} onClick={() => setSelected(entry)}>
              <span className="profile-field-name">{entry.label}</span>
              <strong>{entry.value}</strong>
              {entry.asOf && <time dateTime={entry.asOf}>{entry.asOf} 记录</time>}
              <ChevronRight size={16} aria-hidden="true" />
            </Button>)}
          </div>
        </Card>)}
    </ContentScroll>
    {selected && <ProfileDetail key={selected.memoryId} entry={selected} refresh={refresh} fail={fail}
      close={() => setSelected(undefined)} />}
  </>;
}
