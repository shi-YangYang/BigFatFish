import {
  Button,
  Field,
  Select,
  Input,
  Checkbox,
  FormGrid,
  ActionRow,
} from "./Controls";
import { useState } from "react";
import type { ModelConfig, ModelPurpose } from "../../../runtime/src/ai/types";
import { api } from "../api";
type PublicModel = ModelConfig & { hasKey: boolean };
const blank: ModelConfig = {
  id: "",
  label: "",
  provider: "openai",
  baseURL: "",
  model: "",
  contextWindow: 32768,
  maxTokens: 4096,
  timeoutMs: 120000,
  vision: false,
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
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved("");
    try {
      const value = {
        ...form,
        id: form.id || crypto.randomUUID(),
        label: form.label.trim() || form.model,
      };
      await api("/v1/models", "POST", {
        ...value,
        ...(key ? { apiKey: key } : {}),
      });
      setForm(value);
      const routes = await api<Record<string, string>>("/v1/model-routes");
      if (!routes.chat)
        await api("/v1/model-routes", "PUT", { ...routes, chat: value.id });
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
                  setForm(m);
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
        <Field>
          提供商
          <Select
            value={form.provider}
            onChange={(e) =>
              setForm({
                ...form,
                provider: e.target.value as ModelConfig["provider"],
                baseURL:
                  e.target.value === "deepseek"
                    ? "https://api.deepseek.com/anthropic"
                    : form.baseURL,
              })
            }
          >
            <option value="openai">OpenAI 兼容 / 本地模型</option>
            <option value="deepseek">DeepSeek</option>
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
        <details className="advanced-fields">
          <summary>高级配置</summary>
          <FormGrid className="field-grid">
            <Field>
              显示名称
              <Input
                value={form.label}
                placeholder="默认使用模型名称"
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </Field>
            <Field>
              配置标识
              <Input readOnly value={form.id} placeholder="保存时自动生成" />
            </Field>
            {(["contextWindow", "maxTokens", "timeoutMs"] as const).map(
              (field, i) => (
                <Field key={field}>
                  {["上下文容量", "单次输出上限", "超时（毫秒）"][i]}
                  <Input
                    required
                    type="number"
                    value={form[field]}
                    onChange={(e) =>
                      setForm({ ...form, [field]: Number(e.target.value) })
                    }
                  />
                </Field>
              ),
            )}
            <Field className="check">
              <Checkbox
                type="checkbox"
                checked={form.vision}
                onChange={(e) => setForm({ ...form, vision: e.target.checked })}
              />
              支持图片输入
            </Field>
          </FormGrid>
        </details>
        <ActionRow className="form-actions">
          <Button variant="primary" type="submit" disabled={busy}>
            保存模型
          </Button>
          <span role="status">{saved}</span>
        </ActionRow>
      </form>
      {models.length > 0 && (
        <details>
          <summary>默认模型与用途</summary>
          <Field>
            用途
            <Select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as ModelPurpose)}
            >
              {Object.entries({
                chat: "聊天",
                reasoning: "推理",
                vision: "图片理解",
                memory: "记忆整理",
                asr: "音频转写",
                tts: "语音合成",
              }).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <ActionRow className="actions">
            {models.map((m) => (
              <Button
                type="button"
                key={m.id}
                onClick={() =>
                  void api<Record<string, string>>("/v1/model-routes")
                    .then((routes) =>
                      api("/v1/model-routes", "PUT", {
                        ...routes,
                        [purpose]: m.id,
                      }),
                    )
                    .then(() => setSaved("默认模型已更新"))
                    .catch(fail)
                }
              >
                使用 {m.label}
              </Button>
            ))}
          </ActionRow>
        </details>
      )}
    </section>
  );
}
