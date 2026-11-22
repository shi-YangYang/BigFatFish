import { PageStack, SectionHeading, SectionCard, EmptyState } from "../../components/PageLayout";
import { useModelConnection } from "./useModelConnection";
import { ModelServiceFields } from "./ModelServiceFields";
import { services, chatServices, savedService, normalizedAddress, type ServiceId } from "./model-services";
import {
  Button,
  Field,
  Select,
  ActionRow,
  FormGrid,
} from "../../components/Controls";
import { useEffect, useState } from "react";
import { Drawer } from "../../components/UI";
import type { ModelConfig, ModelPurpose } from "../../../../runtime/src/ai/types";
import { api } from "../../api/client";
type PublicModel = ModelConfig & { hasKey: boolean };
const blank: ModelConfig = {
  id: "",
  label: "",
  provider: "openai",
  baseURL: "",
  model: "",
};
export type ModelTask = {
  purpose: ModelPurpose;
  conversationOnly?: boolean;
  complete: (modelId: string) => void | Promise<void>;
};
export function Models({
  models,
  reload,
  fail, direct, dismiss,
}: {
  models: PublicModel[];
  reload: () => Promise<void>;
  fail: (e: unknown) => void;
  direct?: ModelTask;
  dismiss?: () => void;
}) {
  const [form, setForm] = useState(blank),
    [editorOpen, setEditorOpen] = useState(!!direct),
    [draftBaseline, setDraftBaseline] = useState(JSON.stringify([blank, "", direct?.purpose ?? "chat"])),
    [key, setKey] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(""),
    [purpose, setPurpose] = useState<ModelPurpose>(direct?.purpose ?? "chat");
  const [serviceId, setServiceId] = useState<ServiceId | "">(direct && direct.purpose !== "chat" ? "custom" : "");
  const stored = models.find(model => model.id === form.id);
  const sameAddress = stored && stored.provider === form.provider && normalizedAddress(stored.baseURL) === normalizedAddress(form.baseURL);
  const keepStoredKey = !!(stored?.hasKey && sameAddress);
  const apiKey = key || (stored?.hasKey && !sameAddress ? "" : undefined);
  const wrongKey = form.provider === "openai" && normalizedAddress(form.baseURL) === services.bailian.baseURL && key.trim().startsWith("sk-sp-");
  const connection = useModelConnection(form, apiKey, fail, purpose);
  function chooseService(value: ServiceId | "") {
    const service = value ? services[value] : undefined;
    setServiceId(value); setKey("");
    setForm(current => ({...current, provider:service?.provider ?? "openai", baseURL:service?.baseURL ?? "", model:service?.models[0] ?? "", reasoningEffort:undefined}));
  }
  const [routes, setRoutes] = useState<Partial<Record<ModelPurpose, string>>>({});
  useEffect(() => { let live = true; void api<Partial<Record<ModelPurpose, string>>>("/v1/model-routes").then(value => { if (live) setRoutes(value); }).catch(fail); return () => { live = false; }; }, [models, fail]);
  const purposes = { chat: "聊天模型", asr: "语音输入模型", tts: "朗读模型" };
  const hasDraft = JSON.stringify([form, key, purpose]) !== draftBaseline;
  function openEditor(model?: PublicModel) {
    if (hasDraft && form.id === (model?.id ?? "")) { setEditorOpen(true); return; }
    if (hasDraft && !window.confirm("放弃未保存的修改，打开另一份配置？")) { setEditorOpen(true); return; }
    const next = model ? { id: model.id, label: model.label, provider: model.provider, baseURL: model.baseURL, model: model.model, reasoningEffort: model.reasoningEffort } : blank;
    const nextPurpose = model ? (Object.keys(purposes) as ModelPurpose[]).find(p => routes[p] === model.id) ?? "chat" : "chat";
    setForm(next); setPurpose(nextPurpose); setServiceId(model ? savedService(model, nextPurpose) : ""); setKey(""); setSaved("");
    setDraftBaseline(JSON.stringify([next, "", nextPurpose])); setEditorOpen(true);
  }
  const waiting = busy || !!connection.pending;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceId || wrongKey) return;
    setBusy(true);
    setSaved("");
    try {
      const value = {
        ...form,
        id: form.id || crypto.randomUUID(),
        label: stored?.label && stored.label !== stored.model ? stored.label : form.model,
      };
      await api("/v1/models", "POST", {
        ...value,
        ...(apiKey !== undefined ? { apiKey } : {}),
      });
      setForm(value);
      const current = await api<Partial<Record<ModelPurpose, string>>>("/v1/model-routes");
      if (!direct?.conversationOnly || !current.chat) setRoutes(await api("/v1/model-routes", "PUT", { ...current, [purpose]: value.id }));
      setKey("");
      await reload();
      if (direct) await direct.complete(value.id);
      setSaved("配置已保存");
      setDraftBaseline(JSON.stringify([value, "", purpose]));
      setEditorOpen(false);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  function closeEditor() {
    if (waiting) return;
    if (!direct) { setEditorOpen(false); return; }
    if (!hasDraft || window.confirm("放弃未保存的模型配置？")) dismiss?.();
  }
  async function deleteEdited() {
    if (!stored || waiting || !window.confirm(`删除模型「${stored.label}」？`)) return;
    setBusy(true);
    try {
      await api("/v1/models/" + stored.id, "DELETE");
      setEditorOpen(false); setForm(blank); setServiceId(""); setKey(""); setPurpose("chat");
      setDraftBaseline(JSON.stringify([blank, "", "chat"])); setSaved("");
      await reload();
    } catch (error) { fail(error); } finally { setBusy(false); }
  }
  const editor = editorOpen && <Drawer title={direct ? "设置" + purposes[purpose] : form.id ? "编辑模型" : "新建模型"} close={closeEditor}>
      <form onSubmit={save} className="model-form">
        <FormGrid className="model-fields">
          {purpose === "chat" && <Field className={direct ? "field-wide" : undefined}>服务商<Select value={serviceId} required onValueChange={value => chooseService(value as ServiceId)}>
            <option value="" disabled>选择服务商</option>{chatServices.map(id => <option value={id} key={id}>{services[id].label}</option>)}
          </Select></Field>}
          {!direct && <Field>模型用途<Select value={purpose} onValueChange={value => {
            if ((purpose === "chat") !== (value === "chat")) chooseService(value === "chat" ? "" : "custom");
            setPurpose(value as ModelPurpose);
          }}>{Object.entries(purposes).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</Select></Field>}
          {serviceId && <ModelServiceFields key={serviceId} serviceId={serviceId} purpose={purpose} form={form} setForm={setForm} secret={key} setSecret={setKey}
            keepStoredKey={keepStoredKey} wrongKey={wrongKey} waiting={waiting} connection={connection} />}
        </FormGrid>
        <ActionRow className="form-actions">
          {stored && !direct && <Button variant="ghost" className="delete-model" disabled={waiting} onClick={() => void deleteEdited()}>删除配置</Button>}
          <Button variant="primary" type="submit" disabled={waiting || !serviceId || wrongKey}>
            {direct?.purpose === "chat" ? "保存并回到聊天" : "保存模型"}
          </Button>
        </ActionRow>
      </form>
      </Drawer>;
  if (direct) return <>{editor}</>;
  return (
    <PageStack className="settings-models">
      <SectionHeading title="模型" actions={<ActionRow>
        {!editorOpen && hasDraft && <Button disabled={waiting} onClick={() => setEditorOpen(true)}>继续编辑</Button>}
        <Button
          type="button"
          variant="primary"
          disabled={waiting}
          onClick={() => openEditor()}
        >
          新建配置
        </Button>
        </ActionRow>} />
      {editor}
      {models.length > 0 && (
        <div className="model-list">
          {models.map((m) => (
            <div key={m.id} className="model-row">
              <div className="model-summary">
                <h3 className="model-name">{m.label}</h3>
                {m.label !== m.model && <small>{m.model}</small>}
                <div className="model-meta">
                  <span>{(Object.keys(purposes) as ModelPurpose[]).filter(p => routes[p] === m.id).map(p => purposes[p]).join(" · ") || "未使用"}</span>
                  <span>{m.hasKey ? "密钥已设置" : "未设置密钥"}</span>
                </div>
              </div>
              <ActionRow>
                <Button type="button" disabled={waiting} aria-label={`编辑 ${m.label}`} onClick={() => openEditor(m)}>编辑</Button>
              </ActionRow>
            </div>
          ))}
        </div>
      )}
      {!models.length && !editorOpen && <EmptyState title="还没有模型" description="添加配置后就能开始聊天。" />}
      {saved && <p role="status">{saved}</p>}
      {models.length > 0 && <SectionCard level={3} title="默认用途">
        <div className="model-defaults">
          {(Object.keys(purposes) as ModelPurpose[]).map(p => <Field key={p}>{purposes[p]}<Select disabled={waiting} value={routes[p] ?? ""} onValueChange={id => {
            setBusy(true); const next = { ...routes }; if (id) next[p] = id; else delete next[p];
            void api<Partial<Record<ModelPurpose, string>>>("/v1/model-routes", "PUT", next).then(value => { setRoutes(value); setSaved("默认模型已更新"); return reload(); }).catch(fail).finally(() => setBusy(false));
          }}><option value="">未设置</option>{models.filter(m => p === "chat" || m.provider === "openai").map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</Select></Field>)}
        </div>
      </SectionCard>}
    </PageStack>
  );
}
