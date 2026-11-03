import { pauseAfterRollback } from "./archive.js";
import { verify, createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  cpSync,
  renameSync,
  realpathSync,
} from "node:fs";
import { join, resolve, dirname } from "node:path";
import { x } from "tar";
import type { DataPaths } from "../paths.js";
import { assertRegular, preparePaths } from "../paths.js";
import { acquireInstance } from "../instance.js";
export interface UpdateTrust {
  source: string;
  publicKey: string;
}
interface Release {
  version: string;
  platform: string;
  arch: string;
  schema: number;
  minSchema: number;
  url: string;
  sha256: string;
  size: number;
  kind: "portable";
}
export function verifyRelease(
  document: { payload: string; signature: string },
  trust: UpdateTrust,
): Release {
  if (
    typeof document.payload !== "string" ||
    typeof document.signature !== "string" ||
    !verify(
      null,
      Buffer.from(document.payload),
      trust.publicKey,
      Buffer.from(document.signature, "base64"),
    )
  )
    throw new Error("UPDATE_SIGNATURE_INVALID");
  const release = JSON.parse(document.payload) as Release;
  if (
    !/^\d+\.\d+\.\d+$/.test(release.version) ||
    release.platform !== process.platform ||
    release.arch !== process.arch ||
    release.kind !== "portable"
  )
    throw new Error("UPDATE_PLATFORM_UNSUPPORTED");
  if (
    !Number.isSafeInteger(release.size) ||
    release.size < 1 ||
    release.size > 1024 * 1024 * 1024 ||
    !/^[a-f0-9]{64}$/.test(release.sha256)
  )
    throw new Error("UPDATE_METADATA_INVALID");
  if (
    !Number.isInteger(release.schema) ||
    release.schema < 6 ||
    !Number.isInteger(release.minSchema) ||
    release.minSchema < 1 ||
    release.minSchema > 6
  )
    throw new Error("UPDATE_SCHEMA_UNSUPPORTED");
  return release;
}
async function download(url: string, max: number) {
  const address = new URL(url);
  if (address.protocol !== "https:" || address.username || address.password)
    throw new Error("UPDATE_HTTPS_REQUIRED");
  const response = await fetch(address, {
    redirect: "error",
    signal: AbortSignal.timeout(120000),
  });
  if (response.status === 204 || response.status === 404) return undefined;
  if (!response.ok || !response.body) throw new Error("UPDATE_DOWNLOAD_FAILED");
  const chunks: Buffer[] = [];
  let size = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) throw new Error("UPDATE_TOO_LARGE");
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks);
}
export function loadTrust(p: DataPaths): UpdateTrust | undefined {
  const file = join(p.config, "update-trust.json");
  if (!existsSync(file)) return;
  assertRegular(file);
  return JSON.parse(readFileSync(file, "utf8"));
}
export async function checkUpdate(p: DataPaths) {
  const trust = loadTrust(p);
  if (!trust) return { state: "unconfigured" as const };
  const document = await download(trust.source, 262144);
  if (!document) return { state: "no-release" as const };
  const release = verifyRelease(JSON.parse(document.toString()), trust);
  return { state: "available" as const, release };
}
export async function stageUpdate(p: DataPaths) {
  const check = await checkUpdate(p);
  if (check.state !== "available") throw new Error("UPDATE_NOT_AVAILABLE");
  const bytes = await download(check.release.url, check.release.size);
  if (
    !bytes ||
    bytes.length !== check.release.size ||
    createHash("sha256").update(bytes).digest("hex") !== check.release.sha256
  )
    throw new Error("UPDATE_CHECKSUM_INVALID");
  mkdirSync(p.runtime, { recursive: true, mode: 0o700 });
  const file = join(p.runtime, "verified-update.tar.gz");
  writeFileSync(file, bytes, { mode: 0o600 });
  return { file, release: check.release };
}
// The signed artifact is parsed with no links, no path rewriting and a total expansion budget.
export function extractRelease(bytes: Buffer, destination: string) {
  let expanded = 0,
    entries = 0;
  const extractor = x({
    cwd: destination,
    sync: true,
    strict: true,
    preservePaths: false,
    chmod: true,
    filter: (name, entry) => {
      expanded += entry.size;
      entries++;
      if (
        name.startsWith("/") ||
        name.includes("\\") ||
        name.split("/").includes("..") ||
        name.includes(":") ||
        !("type" in entry) ||
        !["File", "Directory"].includes(entry.type) ||
        expanded > 2 * 1024 * 1024 * 1024 ||
        entries > 200000
      )
        throw new Error("UPDATE_ARCHIVE_INVALID");
      return true;
    },
  });
  extractor.end(bytes);
}
interface Journal {
  root: string;
  next: string;
  old: string;
  snapshot: string;
  phase: "prepared" | "old-moved" | "installed" | "committed";
}
function journalPath(p: DataPaths) {
  return join(p.runtime, "update-journal.json");
}
function saveJournal(p: DataPaths, j: Journal) {
  writeFileSync(journalPath(p), JSON.stringify(j), { mode: 0o600 });
}
function recover(p: DataPaths, j: Journal) {
  // Checking actual rename results makes recovery safe between a rename and its journal update.
  if (existsSync(j.old)) {
    if (existsSync(j.root)) {
      if (existsSync(j.next)) rmSync(j.next, { recursive: true });
      renameSync(j.root, j.next);
    }
    renameSync(j.old, j.root);
  }
  if (existsSync(j.snapshot))
    for (const part of ["config", "data"]) {
      const original = join(j.snapshot, part);
      if (!existsSync(original)) throw new Error("UPDATE_SNAPSHOT_INVALID");
      rmSync(join(p.root, part), { recursive: true, force: true });
      cpSync(original, join(p.root, part), { recursive: true });
    }
  pauseAfterRollback(p.database);
  rmSync(j.next, { recursive: true, force: true });
  rmSync(journalPath(p), { force: true });
}
export function rollbackUpdate(p: DataPaths) {
  preparePaths(p);
  const release = acquireInstance(p.lock);
  try {
    assertRegular(journalPath(p));
    const j = JSON.parse(readFileSync(journalPath(p), "utf8")) as Journal;
    if (
      !j.root ||
      j.old !== join(dirname(j.root), ".bigfatfish-previous") ||
      j.next !== join(dirname(j.root), ".bigfatfish-next") ||
      j.snapshot !== join(p.runtime, "update-data")
    )
      throw new Error("UPDATE_JOURNAL_INVALID");
    recover(p, j);
    return { state: "rolled-back", dataRestored: true };
  } finally {
    release();
  }
}
export function installPortable(
  p: DataPaths,
  installRoot: string,
  staged: { file: string; release: Release },
  health: (candidate: string, snapshot: string) => void,
) {
  if (process.platform === "win32")
    throw new Error("UPDATE_REQUIRES_WINDOWS_INSTALLER");
  const root = realpathSync(resolve(installRoot)),
    data = realpathSync(p.root);
  if (
    process.platform === "darwin" &&
    root.split("/").some((part) => part.endsWith(".app"))
  )
    throw new Error("UPDATE_REQUIRES_DESKTOP_INSTALLER");
  if (
    root === data ||
    data.startsWith(root + "/") ||
    root.startsWith(data + "/")
  )
    throw new Error("DATA_INSIDE_INSTALLATION");
  assertRegular(root, true);
  // Never replace a source checkout or an arbitrary directory.
  if (
    existsSync(join(root, ".git")) ||
    !existsSync(join(root, "release.json")) ||
    !existsSync(join(root, "bin/node"))
  )
    throw new Error("NOT_PORTABLE_INSTALLATION");
  const current = JSON.parse(readFileSync(join(root, "release.json"), "utf8"));
  if (current.target !== `${process.platform}-${process.arch}`)
    throw new Error("UPDATE_PLATFORM_UNSUPPORTED");
  const currentParts = String(current.version).split(".").map(Number),
    nextParts = staged.release.version.split(".").map(Number);
  if (
    currentParts.length !== 3 ||
    currentParts.some((n) => !Number.isSafeInteger(n))
  )
    throw new Error("UPDATE_METADATA_INVALID");
  const changed = nextParts.findIndex((n, i) => n !== currentParts[i]);
  if (changed < 0 || nextParts[changed]! < currentParts[changed]!)
    throw new Error("UPDATE_NOT_NEWER");
  assertRegular(staged.file);
  const bytes = readFileSync(staged.file);
  if (
    bytes.length !== staged.release.size ||
    createHash("sha256").update(bytes).digest("hex") !== staged.release.sha256
  )
    throw new Error("UPDATE_CHECKSUM_INVALID");
  preparePaths(p);
  const release = acquireInstance(p.lock);
  const j: Journal = {
    root,
    next: join(dirname(root), ".bigfatfish-next"),
    old: join(dirname(root), ".bigfatfish-previous"),
    snapshot: join(p.runtime, "update-data"),
    phase: "prepared",
  };
  if (
    existsSync(j.next) ||
    existsSync(j.old) ||
    existsSync(j.snapshot) ||
    existsSync(journalPath(p))
  ) {
    release();
    throw new Error("UPDATE_RECOVERY_REQUIRED");
  }
  try {
    mkdirSync(j.next, { mode: 0o700 });
    extractRelease(bytes, j.next);
    const metadata = JSON.parse(
      readFileSync(join(j.next, "release.json"), "utf8"),
    );
    if (
      metadata.target !== current.target ||
      metadata.version !== staged.release.version ||
      metadata.schema !== staged.release.schema
    )
      throw new Error("UPDATE_METADATA_INVALID");
    mkdirSync(j.snapshot, { mode: 0o700 });
    for (const part of ["config", "data"])
      cpSync(join(p.root, part), join(j.snapshot, part), {
        recursive: true,
        dereference: false,
      });
    saveJournal(p, j);
    health(j.next, j.snapshot);
    renameSync(root, j.old);
    j.phase = "old-moved";
    saveJournal(p, j);
    renameSync(j.next, root);
    j.phase = "installed";
    saveJournal(p, j);
    health(root, j.snapshot);
    j.phase = "committed";
    saveJournal(p, j);
    return {
      state: "installed",
      previous: j.old,
      snapshot: j.snapshot,
      restartRequired: true,
    };
  } catch (error) {
    if (existsSync(journalPath(p))) recover(p, j);
    else rmSync(j.next, { recursive: true, force: true });
    throw error;
  } finally {
    release();
  }
}
