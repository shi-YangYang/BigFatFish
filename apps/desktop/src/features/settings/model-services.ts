import type { ModelConfig, ModelPurpose } from "../../../../runtime/src/ai/types";

interface Service {
  label: string;
  provider: ModelConfig["provider"];
  baseURL: string;
  models: readonly string[];
  needsKey: boolean;
}
export const services = {
  bailian: { label: "阿里云百炼（按量，北京）", provider: "openai", baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", models: ["qwen3.7-plus", "qwen3.8-flash", "qwen4-max"], needsKey: true },
  deepseek: { label: "DeepSeek", provider: "deepseek", baseURL: "https://api.deepseek.com/anthropic", models: ["deepseek-flash", "deepseek-v4-pro"], needsKey: true },
  ollama: { label: "Ollama（本机）", provider: "openai", baseURL: "http://127.0.0.1:11434/v1", models: [], needsKey: false },
  custom: { label: "自定义 / OpenAI 兼容", provider: "openai", baseURL: "", models: [], needsKey: false },
} as const satisfies Record<string, Service>;
export type ServiceId = keyof typeof services;
export const chatServices = Object.keys(services) as ServiceId[];
export const normalizedAddress = (value: string) => value.trim().replace(/\/+$/, "");
export function savedService(model: ModelConfig, purpose: ModelPurpose): ServiceId {
  if (purpose === "chat") {
    if (model.provider === "deepseek") return "deepseek";
    for (const id of ["bailian", "ollama"] as const)
      if (normalizedAddress(model.baseURL) === services[id].baseURL) return id;
  }
  return "custom";
}
