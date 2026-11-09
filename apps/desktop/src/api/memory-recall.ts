import { api } from "./client";

export interface RecallStatus {
  state: "off" | "downloading" | "ready" | "failed";
  downloadedBytes?: number;
  totalBytes?: number;
  indexing?: boolean;
  failed?: boolean;
}

const route = "/v1/memory-recall";
export const loadRecall = () => api<RecallStatus>(route);
export const setRecallEnabled = (enabled: boolean) => api<RecallStatus>(route, "PUT", { enabled });
