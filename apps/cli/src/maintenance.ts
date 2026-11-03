import {
  exportArchive,
  inspectArchive,
  restoreArchive,
  type Scope,
} from "../../runtime/src/maintenance/archive.js";
import {
  readConnection,
  requestRuntime,
} from "../../runtime/src/connection.js";
import type { DataPaths } from "../../runtime/src/paths.js";
import { start, stop } from "./process.js";
import {readInput} from './input.js';
export {readInput} from './input.js';
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
  const c = readConnection(p);
  if (command === "config")
    return {
      models: await requestRuntime(c, "/v1/models"),
      persona: await requestRuntime(c, "/v1/persona"),
      routes: await requestRuntime(c, "/v1/model-routes"),
    };
  if (input.model) {
    const model = input.model as { id: string };
    await requestRuntime(c, "/v1/models", "POST", model);
    await requestRuntime(c, "/v1/model-routes", "PUT", { chat: model.id });
  }
  if (input.name) {
    const persona = await requestRuntime<Record<string, unknown>>(
      c,
      "/v1/persona",
    );
    await requestRuntime(c, "/v1/persona", "PUT", {
      ...persona,
      name: input.name,
    });
  }
  return { configured: true, dataDir: p.root, modelConfigured: !!input.model };
}
