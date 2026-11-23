import { invoke } from "@tauri-apps/api/core";

export function api<T>(route: string, method = "GET", body?: unknown): Promise<T> {
  return invoke<T>("runtime_request", { route, method, body });
}
