import { useModelConnection } from "./useModelConnection";
import { reasoningEfforts } from "../../../runtime/src/ai/model-options";
import type { ReasoningEffort } from "../../../runtime/src/ai/types";
import { Card } from "./Surfaces";
import {
  Button,
  Field,
  Select,
  Input,
  ActionRow,
  FormGrid,
} from "./Controls";
import { useEffect, useRef, useState } from "react";
import type { ModelConfig, ModelPurpose } from "../../../runtime/src/ai/types";
import { api } from "../api";
type PublicModel = ModelConfig & { hasKey: boolean };
const blank: ModelConfig = {
  id: "",
  label: "",
  provider: "openai",
  baseURL: "",
  model: "",
};
export function Models({
  models,
  reload,
  fail,
}: {
  models: PublicModel[];
  reload: () => Promise<void>;
  fail: (e: unknown) => void;
}) {
  const [form, setForm] = useState(blank),
    [editorOpen, setEditorOpen] = useState(false),
    [hasDraft, setHasDraft] = useState(false),
    [key, setKey] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(""),
    [purpose, setPurpose] = useState<ModelPurpose>("chat");
  const connection = useModelConnection(form, key, fail, purpose);
  const editorHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!editorOpen) return;
    editorHeading.current?.focus({ preventScroll: true });
    editorHeading.current?.scrollIntoView({ block: "nearest" });
  }, [editorOpen, form.id]);
  const [routes, setRoutes] = useState<Partial<Record<ModelPurpose, string>>>({});
  useEffect(() => { let live = true; void api<Partial<Record<ModelPurpose, string>>>("/v1/model-routes").then(value => { if (live) setRoutes(value); }).catch(fail); return () => { live = false; }; }, [models, fail]);
  const purposes = { chat: "聊天模型", asr: "语音输入模型", tts: "朗读模型" };
  const waiting = busy || !!connection.pending;
  const effortLabels: Record<ReasoningEffort, string> = { none: "关闭", minimal: "极低", low: "低", medium: "中", high: "高", xhigh: "极高", max: "最高" };
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved("");
    try {
      const value = {
        ...form,
        id: form.id || crypto.randomUUID(),
        label: form.model,
      };
      await api("/v1/models", "POST", {
        ...value,
        ...(key ? { apiKey: key } : {}),
      });
      setForm(value);
      const current = await api<Partial<Record<ModelPurpose, string>>>("/v1/model-routes");
      setRoutes(await api("/v1/model-routes", "PUT", { ...current, [purpose]: value.id }));
      setKey("");
      await reload();
      setSaved("配置已保存");
      setHasDraft(false);
      setEditorOpen(false);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page-section">
      <div className="section-heading">
        <h2>模型</h2>
        <ActionRow>
        {!editorOpen && hasDraft && <Button disabled={waiting} onClick={() => setEditorOpen(true)}>继续编辑</Button>}
        <Button
          type="button"
          disabled={waiting}
          onClick={() => {
            setEditorOpen(true);
            setHasDraft(true);
            setPurpose("chat");
            setForm(blank);
            setKey("");
            setSaved("");
          }}
        >
          新建配置
        </Button>
        </ActionRow>
      </div>
      {editorOpen && <Card className="model-editor">
      <h3 ref={editorHeading} tabIndex={-1} className="focus-target">{form.id ? "编辑模型" : "新建模型"}</h3>
      <form onSubmit={save} className="model-form">
        <FormGrid className="model-fields">
          <Field>模型用途<Select value={purpose} onValueChange={value => {
            setPurpose(value as ModelPurpose);
            if (value !== "chat" && form.provider === "deepseek") setForm(current => ({ ...current, provider: "openai", baseURL: "", reasoningEffort: undefined }));
          }}>{Object.entries(purposes).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</Select></Field>
          <Field>
            提供商
            <Select
              value={form.provider}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  provider: value as ModelConfig["provider"],
                  reasoningEffort: undefined,
                  baseURL:
                    value === "deepseek"
                      ? "https://api.deepseek.com/anthropic"
                      : form.baseURL,
                })
              }
            >
              <option value="openai">OpenAI 兼容 / 本地模型</option>
              {purpose === "chat" && <option value="deepseek">DeepSeek</option>}
            </Select>
          </Field>
          <Field className="field-wide">
            服务地址
            <Input
              required
              type="url"
              value={form.baseURL}
              placeholder="https://api.example.com/v1"
              onChange={(e) => setForm({ ...form, baseURL: e.target.value })}
            />
          </Field>
          <Field className={purpose === "chat" ? undefined : "field-wide"}>
            模型名称
            <Input
              required
              value={form.model}
              placeholder="服务提供的模型名称"
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            />
          </Field>
        {purpose === "chat" && <div className="field-with-help">
          <Field>
            推理强度
            <Select value={form.reasoningEffort ?? ""} onValueChange={value => setForm({ ...form, reasoningEffort: value ? value as ReasoningEffort : undefined })}>
              <option value="">默认</option>
              {reasoningEfforts[form.provider].map(effort => <option key={effort} value={effort}>{effortLabels[effort]}</option>)}
            </Select>
          </Field>
        </div>}

          <Field className="field-wide">
            API Key
            <Input
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={
                models.some((m) => m.id === form.id && m.hasKey)
                  ? "已保存，留空保持不变"
                  : "本地模型可留空"
              }
            />
          </Field>
          <div className="form-feedback field-wide">
            <ActionRow>
              <Button disabled={waiting || !form.baseURL.trim()} onClick={() => void connection.run("discover")}>
                {connection.pending === "discover" ? "正在获取…" : "获取模型列表"}
              </Button>
              {purpose === "chat" && <Button disabled={waiting || !form.baseURL.trim() || !form.model.trim()} onClick={() => void connection.run("test")}>
                {connection.pending === "test" ? "正在测试…" : "测试连接"}
              </Button>}
            </ActionRow>
            {purpose === "chat" && <p className="muted">测试会调用所选模型，消耗少量 token。</p>}
            {connection.result && <p role="status">{connection.result.message}</p>}
          </div>
          {connection.models.length > 0 && <Field className="field-wide">
            可用模型
            <Select value={connection.models.some(model => model.id === form.model) ? form.model : ""} onValueChange={model => setForm({ ...form, model })}>
              <option value="">选择模型或在上方手动填写</option>
              {connection.models.map(model => <option key={model.id} value={model.id}>{model.name === model.id ? model.id : `${model.name}（${model.id}）`}</option>)}
            </Select>
          </Field>}
        </FormGrid>
        <ActionRow className="form-actions">
          <Button variant="primary" type="submit" disabled={waiting}>
            保存模型
          </Button>
          <Button disabled={waiting} onClick={() => setEditorOpen(false)}>收起</Button>
        </ActionRow>
      </form>
      </Card>}
      {models.length > 0 && (
        <div className="model-list">
          {models.map((m) => (
            <div key={m.id}>
              <Button
                type="button"
                className="model-name"
                disabled={waiting}
                onClick={() => {
                  setEditorOpen(true);
                  setHasDraft(true);
                  setForm({ id: m.id, label: m.model, provider: m.provider, baseURL: m.baseURL, model: m.model, reasoningEffort: m.reasoningEffort });
                  setPurpose((Object.keys(purposes) as ModelPurpose[]).find(p => routes[p] === m.id) ?? "chat");
                  setKey("");
                  setSaved("");
                }}
              >
                {m.label}
                {m.label !== m.model && <small>{m.model}</small>}
                <small>{(Object.keys(purposes) as ModelPurpose[]).filter(p => routes[p] === m.id).map(p => purposes[p]).join(" · ") || "尚未设为默认用途"}</small>
              </Button>
              <span>{m.hasKey ? "密钥已设置" : "未设置密钥"}</span>
              <Button
                type="button"
                disabled={waiting}
                onClick={() =>
                  void api("/v1/models/" + m.id, "DELETE")
                    .then(async () => { if (form.id === m.id) { setEditorOpen(false); setHasDraft(false); setForm(blank); } await reload(); })
                    .catch(fail)
                }
              >
                删除
              </Button>
            </div>
          ))}
        </div>
      )}
      {!models.length && !editorOpen && <p className="muted">还没有模型，添加配置后就能开始聊天。</p>}
      {saved && <p role="status">{saved}</p>}
      {models.length > 0 && <Card>
        <h3>默认用途</h3>
        <div className="model-defaults">
          {(Object.keys(purposes) as ModelPurpose[]).map(p => <Field key={p}>{purposes[p]}<Select disabled={waiting} value={routes[p] ?? ""} onValueChange={id => {
            setBusy(true); const next = { ...routes }; if (id) next[p] = id; else delete next[p];
            void api<Partial<Record<ModelPurpose, string>>>("/v1/model-routes", "PUT", next).then(value => { setRoutes(value); setSaved("默认模型已更新"); return reload(); }).catch(fail).finally(() => setBusy(false));
          }}><option value="">未设置</option>{models.filter(m => p === "chat" || m.provider === "openai").map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</Select></Field>)}
        </div>
      </Card>}
    </section>
  );
}
