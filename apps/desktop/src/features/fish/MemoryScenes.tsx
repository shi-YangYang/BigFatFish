import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { errorText } from "../../api/errors";
import { ActionRow, Button } from "../../components/Controls";
import { Alert, Card, ContentScroll, Loading } from "../../components/Surfaces";
import { Drawer } from "../../components/UI";
import type { Memory, MemoryAttribution, MemoryScene } from "../../../../runtime/src/memory/types";
import { SourceList } from "./Life";

export function sceneOrigin(entry: MemoryAttribution) {
  const [, , room, id] = entry.scopeKey.split(":");
  if (room === "group") return `QQ 群 ${id}`;
  if (entry.role === "owner") return "主人 · 私聊";
  if (room === "private") return `QQ ${id} · 好友私聊`;
  return "通用";
}

function SceneFact({ member, fail }: { member: MemoryScene["members"][number]; fail: (e: unknown) => void }) {
  const [open, setOpen] = useState(false);
  const [memory, setMemory] = useState<Memory>();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let active = true;
    api<Memory>(`/v1/memories/${member.id}`).then(record => { if (active) setMemory(record); })
      .catch(e => { if (active) setError(errorText(e)); });
    return () => { active = false; };
  }, [member.id, open]);
  return <li className="timeline-entry">
    <strong>{member.subject}</strong>
    {member.scopeKey.includes(":group:") && <small className="muted">
      {member.role === "owner" ? "主人" : `QQ ${member.personKey.split(":").at(-1)}`}
    </small>}
    <p className="prewrap">{member.content}</p>
    <Button size="compact" variant="ghost" aria-expanded={open} onClick={() => {
      setError("");
      setOpen(!open);
    }}>{open ? "收起来源" : "查看来源"}</Button>
    {open && (error ? <Alert role="alert">{error}</Alert> : !memory ? <Loading /> : <SourceList sources={memory.sources} fail={fail} />)}
  </li>;
}

export function SceneDetail({ scene, close, fail, back }: {
  scene: MemoryScene; close: () => void; fail: (e: unknown) => void; back?: () => void;
}) {
  return <Drawer title={scene.title} close={close}>
    {back && <Button variant="ghost" size="compact" onClick={back}>返回人物资料</Button>}
    <p className="muted">{sceneOrigin(scene)}</p>
    <p className="prewrap">{scene.summary}</p>
    <h3>相关记忆（{scene.members.length}）</h3>
    <ul className="scene-facts">{scene.members.map(member =>
      <SceneFact key={member.id + ":" + member.version} member={member} fail={fail} />)}</ul>
  </Drawer>;
}

export function MemoryScenes({ entries, fail }: { entries: MemoryScene[]; fail: (e: unknown) => void }) {
  const [id, setId] = useState("");
  const selected = entries.find(scene => scene.id === id);
  if (!entries.length) return <p className="muted">暂无符合条件的场景。</p>;
  return <>
    <ContentScroll label="场景记忆" className="content-scroll-list">
      {entries.map(scene => <Card key={scene.id}>
        <h3>{scene.title}</h3>
        <p className="muted">{sceneOrigin(scene)}</p>
        <p className="prewrap">{scene.summary}</p>
        <ActionRow><Button size="compact" onClick={() => setId(scene.id)}>查看相关记忆（{scene.members.length}）</Button></ActionRow>
      </Card>)}
    </ContentScroll>
    {selected && <SceneDetail scene={selected} close={() => setId("")} fail={fail} />}
  </>;
}
