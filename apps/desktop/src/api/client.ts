import { invoke } from "@tauri-apps/api/core";
import { webRequest } from "./web-session";

export const isWeb = !("__TAURI_INTERNALS__" in window);

export function api<T>(route: string, method = "GET", body?: unknown): Promise<T> {
  return isWeb
    ? webRequest<T>("/api" + route, method, body)
    : invoke<T>("runtime_request", { route, method, body });
}
