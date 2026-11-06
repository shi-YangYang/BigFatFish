import { useEffect, useRef, useState } from "react";
import { Disclosure, Loading } from "../../components/Surfaces";
import { Field, Input, Select, Textarea, Button, FormGrid, ActionRow } from "../../components/Controls";
import type { Persona } from "../../../../runtime/src/ai/types";
import { applyPersonaPreset, matchPersonaPreset, personaPresets, personaCards } from "../../../../runtime/src/ai/persona-presets";
import { api } from "../../api/client";

const detailLabels = {
  avatar: "头像地址",
  role: "角色设定",
  traits: "基础性格",
  style: "说话风格",
  likes: "喜欢",
  dislikes: "不喜欢",
  boundaries: "行为边界",
  schedule: "作息偏好",
  autonomy: "自主活动偏好",
};

export function Personality({ fail }: { fail: (e: unknown) => void }) {
  const [persona, setPersona] = useState<Persona>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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
        {source && <a href={source.sourceURL} target="_blank" rel="noreferrer">{source.title} · {source.author}</a>}
        {persona.cardPrompt !== undefined && <Disclosure title="编辑完整人设"><Field>完整人设<Textarea value={persona.cardPrompt} rows={12} maxLength={32000} disabled={saving} onChange={event=>change({...persona,cardPrompt:event.target.value})}/></Field></Disclosure>}
        {preset && <div className="persona-example">
          <span>口吻示例</span>
          <p>{preset.example}</p>
        </div>}
        <Disclosure title="编辑详细设定">
          <FormGrid>
            {(Object.keys(detailLabels) as (keyof typeof detailLabels)[]).filter(key=>!persona.cardPrompt||!['role','traits','style','likes','dislikes'].includes(key)).map(key => (
              <Field key={key} className={key === "style" || key === "avatar" ? "persona-wide-field" : undefined}>
                {detailLabels[key]}
                {key === "avatar"
                  ? <Input value={persona[key]} maxLength={4000} disabled={saving}
                    onChange={event => change({ ...persona, [key]: event.target.value })} />
                  : <Textarea value={persona[key]} rows={key === "style" ? 7 : 3} maxLength={4000} disabled={saving}
                    onChange={event => change({ ...persona, [key]: event.target.value })} />}
              </Field>
            ))}
          </FormGrid>
        </Disclosure>
        <ActionRow>
          <Button variant="primary" type="submit" disabled={saving}>{saving ? "正在保存…" : "保存设定"}</Button>
          <span role="status">{saved ? "已保存" : ""}</span>
        </ActionRow>
      </form>
    </section>
  );
}
