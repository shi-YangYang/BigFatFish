import { restoreSnapshot } from "../../../runtime/src/maintenance/archive.js";
import { createHash } from "node:crypto";
import {
  checkUpdate,
  stageUpdate,
  installPortable,
  rollbackUpdate,
  extractRelease,
  verifyRelease,
  loadTrust,
} from "../../../runtime/src/maintenance/update.js";
import { readInput } from "../io/input.js";
import { acquireInstance } from "../../../runtime/src/instance.js";
import { stop } from "../runtime/process.js";
import {
  writeFileSync,
  mkdtempSync,
  rmSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { preparePaths, type DataPaths } from "../../../runtime/src/paths.js";
export async function updateCommand(p: DataPaths, args: string[]) {
  const action = args[1] ?? "check";
  if (action === "trust") {
    const input = await readInput();
    if (
      typeof input.source !== "string" ||
      !input.source.startsWith("https://") ||
      typeof input.publicKey !== "string"
    )
      throw new Error("UPDATE_TRUST_INVALID");
    preparePaths(p);
    writeFileSync(join(p.config, "update-trust.json"), JSON.stringify(input), {
      mode: 0o600,
    });
    return { configured: true };
  }
  if (action === "rollback") {
    await stop(p);
    return rollbackUpdate(p);
  }
  if (action === "desktop-preflight") {
    const input = await readInput();
    if (typeof input.file !== "string" || typeof input.sha256 !== "string")
      throw new Error("UPDATE_FILE_INVALID");
    const bytes = readFileSync(input.file);
    if (createHash("sha256").update(bytes).digest("hex") !== input.sha256)
      throw new Error("UPDATE_CHECKSUM_INVALID");
    const directory = mkdtempSync(join(tmpdir(), "bff-desktop-update-"));
    try {
      extractRelease(bytes, directory);
      const entries = readdirSync(directory, { withFileTypes: true });
      const apps = entries.filter(
        (entry) =>
          entry.isDirectory() &&
          entry.name.endsWith(".app") &&
          !entry.name.startsWith("._"),
      );
      if (apps.length !== 1 || entries.length !== 1)
        throw new Error("UPDATE_ARCHIVE_INVALID");
      const app = apps[0]!.name;
      const candidate = join(directory, app, "Contents/Resources/runtime"),
        manifest = JSON.parse(
          readFileSync(join(candidate, "release.json"), "utf8"),
        );
      if (
        !Number.isInteger(manifest.schema) ||
        manifest.schema < 6 ||
        manifest.schema !== input.schema ||
        manifest.target !== `${process.platform}-${process.arch}`
      )
        throw new Error("UPDATE_SCHEMA_UNSUPPORTED");
      const data = join(directory, "probe");
      mkdirSync(data);
      for (const part of ["config", "data"])
        cpSync(
          join(p.runtime, "desktop-update-snapshot", part),
          join(data, part),
          { recursive: true },
        );
      const run = (command: string) =>
        spawnSync(
          join(candidate, "bin/node"),
          [
            join(candidate, "dist/cli/src/main.js"),
            command,
            "--data-dir",
            data,
            "--json",
          ],
          {
            timeout: 30000,
            encoding: "utf8",
            env: { ...process.env, BIGFATFISH_MAINTENANCE_PROBE: "1" },
          },
        );
      try {
        if (run("start").status !== 0) throw new Error("UPDATE_HEALTH_FAILED");
      } finally {
        run("stop");
      }
      return { state: "compatible" };
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
  if (action === "desktop-finish" || action === "desktop-unlock") {
    const input = await readInput();
    preparePaths(p);
    const release = acquireInstance(p.lock);
    try {
      const marker = join(p.runtime, "update-pending.json");
      if (existsSync(marker)) {
        const pending = JSON.parse(readFileSync(marker, "utf8"));
        if (action === "desktop-finish" && pending.version !== input.version)
          throw new Error("UPDATE_IN_PROGRESS");
        rmSync(marker);
      }
      return { state: "ready" };
    } finally {
      release();
    }
  }
  if (action === "desktop-snapshot") {
    const input = await readInput();
    await stop(p);
    preparePaths(p);
    const release = acquireInstance(p.lock);
    try {
      if (typeof input.installRoot === "string") {
        const application = realpathSync(input.installRoot),
          data = realpathSync(p.root);
        if (
          data === application ||
          data.startsWith(application + "/") ||
          application.startsWith(data + "/")
        )
          throw new Error("DATA_INSIDE_INSTALLATION");
      }
      const directory = join(p.runtime, "desktop-update-snapshot");
      if (existsSync(directory)) throw new Error("UPDATE_RECOVERY_REQUIRED");
      mkdirSync(directory, { mode: 0o700 });
      for (const part of ["config", "data"])
        cpSync(join(p.root, part), join(directory, part), { recursive: true });
      if (
        typeof input.installRoot === "string" &&
        process.platform === "darwin"
      ) {
        if (
          !input.installRoot.endsWith(".app") ||
          !existsSync(
            join(input.installRoot, "Contents/MacOS/bigfatfish-desktop"),
          )
        )
          throw new Error("UPDATE_INSTALLATION_INVALID");
        cpSync(input.installRoot, join(directory, "BigFatFish-previous.app"), {
          recursive: true,
        });
      }
      writeFileSync(
        join(p.runtime, "update-pending.json"),
        JSON.stringify({ version: input.version }),
        { mode: 0o600 },
      );
      return {
        directory,
        schema: 6,
        previousApplication: join(directory, "BigFatFish-previous.app"),
      };
    } finally {
      release();
    }
  }
  if (action === "desktop-rollback") {
    await stop(p);
    return restoreSnapshot(p, join(p.runtime, "desktop-update-snapshot"));
  }
  if (action === "check") return checkUpdate(p);
  if (!["install", "install-file"].includes(action))
    throw new Error("INVALID_ARGUMENTS");
  let selected: Awaited<ReturnType<typeof stageUpdate>>;
  if (action === "install-file") {
    const input = await readInput(),
      trust = loadTrust(p);
    if (
      !trust ||
      typeof input.file !== "string" ||
      typeof input.manifest !== "string"
    )
      throw new Error("UPDATE_TRUST_INVALID");
    selected = {
      file: input.file,
      release: verifyRelease(
        JSON.parse(readFileSync(input.manifest, "utf8")),
        trust,
      ),
    };
  } else selected = await stageUpdate(p);
  await stop(p);
  const root = fileURLToPath(new URL("../../../../", import.meta.url));
  return installPortable(p, root, selected, (candidate, snapshot) => {
    const temp = mkdtempSync(join(tmpdir(), "bff-update-health-"));
    for (const part of ["config", "data"])
      cpSync(join(snapshot, part), join(temp, part), { recursive: true });
    const run = (command: string) =>
      spawnSync(
        join(candidate, "bin", "node"),
        [
          join(candidate, "dist/cli/src/main.js"),
          command,
          "--data-dir",
          temp,
          "--json",
        ],
        {
          timeout: 30000,
          encoding: "utf8",
          env: { ...process.env, BIGFATFISH_MAINTENANCE_PROBE: "1" },
        },
      );
    try {
      const result = run("start");
      if (result.status !== 0) throw new Error("UPDATE_HEALTH_FAILED");
    } finally {
      run("stop");
      rmSync(temp, { recursive: true, force: true });
    }
  });
}
