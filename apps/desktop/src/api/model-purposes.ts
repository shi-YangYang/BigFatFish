import type { ModelConfig, ModelPurpose } from "../../../runtime/src/ai/types";
import { api } from "./client";

export type ModelRoutes = Partial<Record<ModelPurpose, string>>;
export const modelPurposes = ["chat", "asr", "tts"] as const;
export const purposeLabels = { chat: "文本模型", asr: "语音输入模型", tts: "朗读模型" };

export function acceptsPurpose(model: ModelConfig, purpose: ModelPurpose, routes: ModelRoutes, usedInChat = false) {
  if (routes[purpose] === model.id) return true; // Keep existing bindings, including shared and legacy routes.
  if (purpose !== "chat" && model.provider !== "openai") return false;
  if (purpose === "chat" && usedInChat) return true;
  const known = modelPurposes.filter(p => model.purposes?.includes(p) || routes[p] === model.id);
  return !known.length || known.includes(purpose);
}

/** The Runtime stores all three routes together; change only the requested purpose. */
export async function setModelRoute(purpose: ModelPurpose, id: string | undefined, onlyIfMissing = false) {
  const current = await api<ModelRoutes>("/v1/model-routes");
  if (current[purpose] === id || (onlyIfMissing && current[purpose])) return current;
  const next = { ...current };
  if (id) next[purpose] = id; else delete next[purpose];
  return api<ModelRoutes>("/v1/model-routes", "PUT", next);
}
