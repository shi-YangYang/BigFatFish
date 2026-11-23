import { useState } from "react";
import { Field, Input, Select, ActionRow, Button } from "../../components/Controls";
import { Alert, Disclosure } from "../../components/Surfaces";
import { reasoningEfforts } from "../../../../runtime/src/ai/models/model-options";
import type { ModelConfig, ModelPurpose, ReasoningEffort } from "../../../../runtime/src/ai/types";
import { normalizedAddress, services, type ServiceId } from "./model-services";
import type { useModelConnection } from "./useModelConnection";

interface Props {
  serviceId: ServiceId;
  purpose: ModelPurpose;
  form: ModelConfig;
  setForm: (model: ModelConfig) => void;
  secret: string;
  setSecret: (key: string) => void;
  keepStoredKey: boolean;
  wrongKey: boolean;
  waiting: boolean;
  connection: ReturnType<typeof useModelConnection>;
}
const effortLabels: Record<ReasoningEffort, string> = { none: "关闭", minimal: "极低", low: "低", medium: "中", high: "高", xhigh: "极高", max: "最高" };

export function ModelServiceFields({ serviceId, purpose, form, setForm, secret, setSecret, keepStoredKey, wrongKey, waiting, connection }: Props) {
  const service = services[serviceId];
  const suggestions: readonly string[] = service.models;
  const [manual, setManual] = useState(() => !suggestions.includes(form.model));
  function pickModel(model: string) {
    setManual(!suggestions.includes(model));
    setForm({...form, model});
  }
  const preset = serviceId !== "custom";
  const address = <Field className="field-wide">服务地址<Input required type="url" value={form.baseURL} placeholder="https://api.example.com/v1"
    onChange={e => {setSecret(""); setForm({...form, baseURL:e.target.value});}} /></Field>;
  const manualModel = <Field className="field-wide">模型名称<Input required value={form.model} placeholder="服务提供的模型名称" onChange={e => setForm({...form, model:e.target.value})} /></Field>;
  const requiresKey = service.needsKey && normalizedAddress(form.baseURL) === service.baseURL;
  const keyMissing = requiresKey && !keepStoredKey && !secret.trim();
  const connectionControls = <>
    {purpose === "chat" && <Field className="field-wide">推理强度<Select value={form.reasoningEffort ?? ""} onValueChange={value => setForm({ ...form, reasoningEffort: value ? value as ReasoningEffort : undefined })}>
      <option value="">默认</option>{reasoningEfforts[form.provider].map(effort => <option key={effort} value={effort}>{effortLabels[effort]}</option>)}
    </Select></Field>}
    <div className="form-feedback field-wide">
      <ActionRow><Button busy={connection.pending === "discover"} disabled={waiting || keyMissing || wrongKey || !form.baseURL.trim()} onClick={() => void connection.run("discover")}>
        {connection.pending === "discover" ? "正在获取…" : "获取模型列表"}</Button>
        {purpose === "chat" && <Button busy={connection.pending === "test"} disabled={waiting || keyMissing || wrongKey || !form.baseURL.trim() || !form.model.trim()} onClick={() => void connection.run("test")}>
          {connection.pending === "test" ? "正在测试…" : "测试连接"}</Button>}</ActionRow>
      {purpose === "chat" && <p className="muted">测试会调用所选模型，消耗少量 token。</p>}
      {connection.result && <p role="status">{connection.result.message}</p>}
    </div>
    {connection.models.length > 0 && <Field className="field-wide">可用模型<Select value={connection.models.some(model => model.id === form.model) ? form.model : ""} onValueChange={pickModel}>
      <option value="">选择获取到的模型</option>{connection.models.map(model => <option key={model.id} value={model.id}>{model.name === model.id ? model.id : `${model.name}（${model.id}）`}</option>)}
    </Select></Field>}
  </>;
  return <>
    {!preset && address}
    {suggestions.length > 0 && <Field className="field-wide">文本模型<Select value={manual ? "__manual" : form.model} onValueChange={value => pickModel(value === "__manual" ? "" : value)}>
      {suggestions.map(model => <option value={model} key={model}>{model}</option>)}<option value="__manual">手动填写模型名称</option>
    </Select></Field>}
    {manual && manualModel}
    <Field className="field-wide">API Key<Input type="password" autoComplete="off" value={secret} onChange={e => setSecret(e.target.value)}
      required={requiresKey && !keepStoredKey} placeholder={keepStoredKey ? "已保存，留空保持不变" : serviceId === "bailian" ? "北京地域的按量 API Key" : service.needsKey ? "填入服务商的 API Key" : "本地模型可留空"} /></Field>
    {wrongKey && <Alert className="field-wide">这是套餐专属 Key。百炼按量服务需要单独的 API Key，不会使用 Token Plan 额度。</Alert>}
    {preset ? <Disclosure className="field-wide" title="连接选项" defaultOpen={normalizedAddress(form.baseURL) !== service.baseURL || serviceId === "ollama"}>
      <div className="model-options">{address}{connectionControls}</div>
    </Disclosure> : connectionControls}
  </>;
}
