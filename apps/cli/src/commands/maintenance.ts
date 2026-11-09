import {
  exportArchive,
  inspectArchive,
  restoreArchive,
  type Scope,
} from "../../../runtime/src/maintenance/archive.js";
import { createRuntimeClient } from "../runtime/client.js";
import type { DataPaths } from "../../../runtime/src/paths.js";
import { start, stop } from "../runtime/process.js";
import {readInput} from '../io/input.js';
export async function maintenanceCommand(p: DataPaths, args: string[]) {
  const [command, action] = args;
  if (command === "backup") {
    const input = await readInput();
    if (typeof input.file !== "string")
      throw new Error("ARCHIVE_PATH_REQUIRED");
    const password =
      typeof input.password === "string" ? input.password : undefined;
    if (action === "inspect") return inspectArchive(input.file, password);
    if (!["export", "restore"].includes(action ?? ""))
      throw new Error("INVALID_ARGUMENTS");
    if (action === "restore") inspectArchive(input.file, password);
    // Stop drains DSH, browser and background tasks. The core then owns the instance lock.
    await stop(p);
    if (action === "export")
      return exportArchive(p, input.file, {
        scopes: input.scopes as Scope[] | undefined,
        credentials: input.credentials === true,
        password,
      });
    return restoreArchive(p, input.file, password);
  }
  if (command !== "config" && command !== "onboard")
    throw new Error("INVALID_ARGUMENTS");
  const input = command === "onboard" ? await readInput() : {};
  await start(p, 0);
  const { request } = createRuntimeClient(p);
  if (command === "config")
    return {
      models: await request("/v1/models"),
      persona: await request("/v1/persona"),
      routes: await request("/v1/model-routes"),
    };
  if (input.model) {
    const model = input.model as { id: string };
    await request("/v1/models", "POST", model);
    await request("/v1/model-routes", "PUT", { chat: model.id });
  }
  if (input.name) {
    const persona = await request<Record<string, unknown>>("/v1/persona");
    await request("/v1/persona", "PUT", {
      ...persona,
      name: input.name,
    });
  }
  return { configured: true, dataDir: p.root, modelConfigured: !!input.model };
}
