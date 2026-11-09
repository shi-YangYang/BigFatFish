import { useEffect, useRef, useState } from "react";
import { Loading } from "../../components/Surfaces";
import { Field, Input, Select, Textarea, Button, FormGrid, ActionRow } from "../../components/Controls";
import type { Persona } from "../../../../runtime/src/ai/types";
import { applyPersonaPreset, matchPersonaPreset, personaPresets, personaCards } from "../../../../runtime/src/ai/persona-presets";
import { api } from "../../api/client";
import { Drawer } from "../../components/UI";

export function Personality({ fail }: { fail: (e: unknown) => void }) {
  const [persona, setPersona] = useState<Persona>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const savingRef = useRef(false);
  useEffect(() => {
    let active = true;
    void api<Persona>("/v1/persona").then(value => { if (active) setPersona(value); }).catch(fail);
    return () => { active = false; };
  }, [fail]);

  function change(next: Persona) {
    if (savingRef.current) return;
    setPersona(next);
    setSaved(false);
  }
  async function save() {
    if (!persona || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaved(false);
    try {
      const value = await api<Persona>("/v1/persona", "PUT", persona);
      setPersona(value);
      setSaved(true);
      setEditingPrompt(false);
    } catch (error) { fail(error); }
    finally { savingRef.current = false; setSaving(false); }
  }

  if (!persona) return <Loading>正在加载设定…</Loading>;
  const preset = matchPersonaPreset(persona);
  const source=personaCards.find(card=>card.id===persona.cardId);
  return (
    <section className="page-section personality-settings">
      <h2>鱼的设定</h2>
      <form className="settings" onSubmit={event => { event.preventDefault(); void save(); }}>
        <FormGrid>
          <Field>
            名字
            <Input value={persona.name} required maxLength={100} disabled={saving}
              onChange={event => change({ ...persona, name: event.target.value })} />
          </Field>
          <Field>
            性格
            <Select value={preset?.id ?? "custom"} disabled={saving} onValueChange={id => {
              const next = personaPresets.find(item => item.id === id);
              if (next) change(applyPersonaPreset(persona, next));
            }}>
              <option value="custom" disabled>自定义</option>
              {personaPresets.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </Select>
          </Field>
        </FormGrid>
        {preset && <div className="persona-example">
          <span>口吻示例</span>
          <p>{preset.example}</p>
        </div>}
        <ActionRow>
          <Button variant="primary" type="submit" disabled={saving}>{saving ? "正在保存…" : "保存设定"}</Button>
          {persona.cardPrompt !== undefined && <Button disabled={saving} onClick={() => setEditingPrompt(true)}>自定义人设</Button>}
          <span role="status">{saved ? "已保存" : ""}</span>
        </ActionRow>
        {source && <a className="persona-source" href={source.sourceURL} target="_blank" rel="noreferrer">人设来源：{source.title} · {source.author}</a>}
      </form>
      {editingPrompt && <Drawer title="自定义人设" close={() => { if (!saving) setEditingPrompt(false); }}>
        <form className="persona-editor" onSubmit={event => { event.preventDefault(); void save(); }}>
          <Field>完整人设<Textarea value={persona.cardPrompt ?? ""} rows={16} maxLength={32000} disabled={saving} onChange={event => change({ ...persona, cardPrompt: event.target.value })} /></Field>
          <ActionRow>
            <Button variant="primary" type="submit" disabled={saving}>{saving ? "正在保存…" : "保存人设"}</Button>
            <Button disabled={saving} onClick={() => setEditingPrompt(false)}>关闭编辑</Button>
          </ActionRow>
        </form>
      </Drawer>}
    </section>
  );
}
