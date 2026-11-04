import { useModelConnection } from "./useModelConnection";
import { reasoningEfforts } from "../../../runtime/src/ai/model-options";
import type { ReasoningEffort } from "../../../runtime/src/ai/types";
import { Disclosure } from "./Surfaces";
import {
  Button,
  Field,
  Select,
  Input,
  ActionRow,
} from "./Controls";
import { useEffect, useState } from "react";
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
    [key, setKey] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(""),
    [purpose, setPurpose] = useState<ModelPurpose>("chat");
  const connection = useModelConnection(form, key, fail, purpose);
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
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="section-heading">
        <h2>模型</h2>
        <Button
          type="button"
          onClick={() => {
            setForm(blank);
            setKey("");
            setSaved("");
          }}
        >
          新建配置
        </Button>
      </div>
      {models.length > 0 && (
        <div className="model-list">
          {models.map((m) => (
            <div key={m.id}>
              <Button
                type="button"
                className="model-name"
                onClick={() => {
                  setForm({ id: m.id, label: m.model, provider: m.provider, baseURL: m.baseURL, model: m.model, reasoningEffort: m.reasoningEffort });
                  setPurpose((Object.keys(purposes) as ModelPurpose[]).find(p => routes[p] === m.id) ?? "chat");
                  setKey("");
                  setSaved("");
                }}
              >
                {m.label}
                <small>{m.model}</small>
              </Button>
              <span>{m.hasKey ? "密钥已设置" : "未设置密钥"}</span>
              <Button
                type="button"
                onClick={() =>
                  void api("/v1/models/" + m.id, "DELETE")
                    .then(reload)
                    .catch(fail)
                }
              >
                删除
              </Button>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={save} className="model-form">
        <div className="form-section">
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
          <Field>
            服务地址
            <Input
              required
              type="url"
              value={form.baseURL}
              placeholder="https://api.example.com/v1"
              onChange={(e) => setForm({ ...form, baseURL: e.target.value })}
            />
          </Field>
          <Field>
            模型名称
            <Input
              required
              value={form.model}
              placeholder="服务提供的模型名称"
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            />
          </Field>
          <Field>
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
          <div className="form-feedback">
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
          {connection.models.length > 0 && <Field>
            可用模型
            <Select value={connection.models.some(model => model.id === form.model) ? form.model : ""} onValueChange={model => setForm({ ...form, model })}>
              <option value="">选择模型或在上方手动填写</option>
              {connection.models.map(model => <option key={model.id} value={model.id}>{model.name === model.id ? model.id : `${model.name}（${model.id}）`}</option>)}
            </Select>
          </Field>}
        </div>
        {purpose === "chat" && <div className="field-with-help">
          <Field>
            推理强度
            <Select value={form.reasoningEffort ?? ""} onValueChange={value => setForm({ ...form, reasoningEffort: value ? value as ReasoningEffort : undefined })}>
              <option value="">默认</option>
              {reasoningEfforts[form.provider].map(effort => <option key={effort} value={effort}>{effortLabels[effort]}</option>)}
            </Select>
          </Field>
          <p className="muted">具体强度由模型支持；不支持时请选择默认。保存后用于后续请求。</p>
        </div>}
        <ActionRow className="form-actions">
          <Button variant="primary" type="submit" disabled={waiting}>
            保存模型
          </Button>
          <span role="status">{saved}</span>
        </ActionRow>
      </form>
      {models.length > 0 && <Disclosure title={<>默认模型</>}>
        <div className="model-defaults">
          {(Object.keys(purposes) as ModelPurpose[]).map(p => <Field key={p}>{purposes[p]}<Select disabled={waiting} value={routes[p] ?? ""} onValueChange={id => {
            setBusy(true); const next = { ...routes }; if (id) next[p] = id; else delete next[p];
            void api<Partial<Record<ModelPurpose, string>>>("/v1/model-routes", "PUT", next).then(value => { setRoutes(value); setSaved("默认模型已更新"); return reload(); }).catch(fail).finally(() => setBusy(false));
          }}><option value="">未设置</option>{models.filter(m => p === "chat" || m.provider === "openai").map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</Select></Field>)}
        </div>
      </Disclosure>}
    </section>
  );
}
