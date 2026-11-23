import { useEffect, useRef, useState } from "react";
import { ActionRow, Button, Field, FormGrid, Select } from "../../components/Controls";
import { Drawer } from "../../components/UI";
import { Alert, Loading } from "../../components/Surfaces";
import type { ModelConfig, ModelPurpose } from "../../../../runtime/src/ai/types";
import { api } from "../../api/client";
import { acceptsPurpose, type ModelRoutes, modelPurposes, purposeLabels, setModelRoute } from "../../api/model-purposes";
import { ModelPurposeMenu, ModelPurposePanel } from "./ModelPurposePanel";
import { useModelConnection } from "./useModelConnection";
import { ModelServiceFields } from "./ModelServiceFields";
import { services, chatServices, savedService, normalizedAddress, type ServiceId } from "./model-services";

type PublicModel = ModelConfig & { hasKey: boolean };
const blank: ModelConfig = { id: "", label: "", provider: "openai", baseURL: "", model: "" };
export type ModelTask = {
  purpose: ModelPurpose;
  conversationOnly?: boolean;
  complete: (modelId: string) => void | Promise<void>;
};

export function Models({ models, reload, fail, direct, dismiss }: {
  models: PublicModel[]; reload: () => Promise<void>; fail: (e: unknown) => void;
  direct?: ModelTask; dismiss?: () => void;
}) {
  const [form, setForm] = useState(blank), [editorOpen, setEditorOpen] = useState(!!direct),
    [purpose, setPurpose] = useState<ModelPurpose>(direct?.purpose ?? "chat"), [panel, setPanel] = useState<ModelPurpose>(),
    [draftBaseline, setDraftBaseline] = useState(JSON.stringify([blank, "", direct?.purpose === "chat" || !direct ? "" : "custom"])),
    [key, setKey] = useState(""), [busy, setBusy] = useState(false), [saved, setSaved] = useState("");
  const [serviceId, setServiceId] = useState<ServiceId | "">(direct && direct.purpose !== "chat" ? "custom" : "");
  const [routes, setRoutes] = useState<ModelRoutes>(), [loadError, setLoadError] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (direct) return;
    let live = true;
    void api<ModelRoutes>("/v1/model-routes").then(value => {
      if (live) { setRoutes(value); setLoadError(false); }
    }).catch(() => { if (live) setLoadError(true); });
    return () => { live = false; };
  }, [direct, attempt, models]);
  const newModelId = useRef("");
  const stored = models.find(model => model.id === form.id);
  const sameAddress = stored && stored.provider === form.provider && normalizedAddress(stored.baseURL) === normalizedAddress(form.baseURL);
  const keepStoredKey = !!(stored?.hasKey && sameAddress);
  const apiKey = key || (stored?.hasKey && !sameAddress ? "" : undefined);
  const wrongKey = form.provider === "openai" && normalizedAddress(form.baseURL) === services.bailian.baseURL && key.trim().startsWith("sk-sp-");
  const connection = useModelConnection(form, apiKey, fail, purpose);
  const waiting = busy || !!connection.pending;
  const hasDraft = JSON.stringify([form, key, serviceId]) !== draftBaseline;
  function chooseService(value: ServiceId | "") {
    const service = value ? services[value] : undefined;
    setServiceId(value); setKey("");
    setForm(current => ({...current, provider:service?.provider ?? "openai", baseURL:service?.baseURL ?? "", model:service?.models[0] ?? "", reasoningEffort:undefined}));
  }
  function openEditor(p: ModelPurpose, model?: ModelConfig) {
    if (hasDraft && p === purpose && form.id === (model?.id ?? "")) { setEditorOpen(true); return; }
    if (hasDraft && !window.confirm("放弃未保存的修改，打开另一份配置？")) return;
    const next = model ? { id: model.id, label: model.label, provider: model.provider, baseURL: model.baseURL, model: model.model, reasoningEffort: model.reasoningEffort } : blank;
    const service = model ? savedService(model, p) : p === "chat" ? "" : "custom";
    newModelId.current = "";
    setForm(next); setPurpose(p); setServiceId(service); setKey(""); setSaved("");
    setDraftBaseline(JSON.stringify([next, "", service])); setEditorOpen(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (waiting || !serviceId || wrongKey) return;
    setBusy(true); setSaved("");
    try {
      const value = { ...form, id: form.id || (newModelId.current ||= crypto.randomUUID()), label: stored?.label && stored.label !== stored.model ? stored.label : form.model };
      await api("/v1/models", "POST", { ...value, purpose, ...(apiKey !== undefined ? { apiKey } : {}) });
      if (!stored || direct) setRoutes(await setModelRoute(purpose, value.id, direct?.conversationOnly));
      await reload();
      if (direct) await direct.complete(value.id);
      setKey(""); setForm(value); setDraftBaseline(JSON.stringify([value, "", serviceId]));
      setSaved("配置已保存"); setEditorOpen(false);
    } catch (error) { fail(error); } finally { setBusy(false); }
  }
  async function changeRoute(id?: string) {
    if (!panel || waiting) return;
    setBusy(true); setSaved("");
    try { setRoutes(await setModelRoute(panel, id)); await reload(); }
    catch (error) { fail(error); } finally { setBusy(false); }
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
      setForm(blank); setServiceId(""); setKey(""); setDraftBaseline(JSON.stringify([blank, "", ""]));
      setSaved("配置已删除"); setEditorOpen(false); await reload();
    } catch (error) { fail(error); } finally { setBusy(false); }
  }
  const sharedWith = stored ? modelPurposes.filter(p => p !== purpose && routes?.[p] === stored.id).map(p => purposeLabels[p]) : [];
  const editor = editorOpen && <Drawer title={(form.id ? "编辑" : "设置") + purposeLabels[purpose]} close={closeEditor}>
    <form onSubmit={save} className="model-form">
      {sharedWith.length > 0 && <p className="muted">也用于{sharedWith.join("、")}，修改会同时生效。</p>}
      <FormGrid className="model-fields">
        {purpose === "chat" && <Field className="field-wide">服务商<Select value={serviceId} required onValueChange={value => chooseService(value as ServiceId)}>
          <option value="" disabled>选择服务商</option>{chatServices.map(id => <option value={id} key={id}>{services[id].label}</option>)}
        </Select></Field>}
        {serviceId && <ModelServiceFields key={serviceId} serviceId={serviceId} purpose={purpose} form={form} setForm={setForm} secret={key} setSecret={setKey}
          keepStoredKey={keepStoredKey} wrongKey={wrongKey} waiting={waiting} connection={connection} />}
      </FormGrid>
      <ActionRow className="form-actions">
        {stored && !direct && <Button variant="ghost" className="delete-model" disabled={waiting} onClick={() => void deleteEdited()}>删除配置</Button>}
        <Button variant="primary" type="submit" busy={busy} disabled={waiting || !serviceId || wrongKey}>
          {direct?.purpose === "chat" ? "保存并回到聊天" : stored ? "保存修改" : "保存并使用"}
        </Button>
      </ActionRow>
    </form>
  </Drawer>;
  if (direct) return <>{editor}</>;
  if (loadError) return <Alert>模型设置读取失败。<Button onClick={() => { setLoadError(false); setAttempt(n => n + 1); }}>重试</Button></Alert>;
  if (!routes) return <Loading>正在读取模型设置…</Loading>;
  const candidates = (p: ModelPurpose) => models.filter(model => acceptsPurpose(model, p, routes));
  if (!panel) return <ModelPurposeMenu models={models} routes={routes} open={p => {
    setPanel(p); setSaved("");
    if (!candidates(p).length) openEditor(p);
  }} />;
  return <>
    <ModelPurposePanel purpose={panel} candidates={candidates(panel)} currentId={routes[panel]} waiting={waiting}
      draft={hasDraft && purpose === panel ? () => setEditorOpen(true) : undefined} saved={saved}
      back={() => { if (!waiting) setPanel(undefined); }} edit={model => openEditor(panel, model)} use={id => void changeRoute(id)} fail={fail} />
    {editor}
  </>;
}
