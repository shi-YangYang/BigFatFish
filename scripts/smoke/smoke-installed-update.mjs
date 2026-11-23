import {
  cpSync,
  readFileSync,
  writeFileSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { generateKeyPairSync, sign, createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import assert from "node:assert/strict";
const test = mkdtempSync(join(tmpdir(), "bff real update ")),
  install = join(test, "installed"),
  candidate = join(test, "candidate"),
  data = join(test, "fish");
const cli = (args, input) =>
  JSON.parse(
    execFileSync(
      join(install, "bin/node"),
      [
        join(install, "dist/cli/src/main.js"),
        ...args,
        "--data-dir",
        data,
        "--json",
      ],
      {
        input: JSON.stringify(input ?? {}),
        encoding: "utf8",
        env: { ...process.env, PATH: "/usr/bin:/bin" },
        timeout: 60000,
      },
    ),
  );
try {
  cpSync(resolve("build/portable"), install, {
    recursive: true,
    dereference: true,
  });
  cpSync(resolve("dist"), join(install, "dist"), { recursive: true });
  const old = JSON.parse(readFileSync(join(install, "release.json")));
  old.version = "0.1.0";
  writeFileSync(join(install, "release.json"), JSON.stringify(old));
  cpSync(install, candidate, { recursive: true, dereference: true });
  const next = { ...old, version: "0.1.1" };
  writeFileSync(join(candidate, "release.json"), JSON.stringify(next));
  const file = join(test, "update.tar.gz");
  execFileSync("tar", ["-chzf", file, "-C", candidate, "."]);
  const bytes = readFileSync(file),
    keys = generateKeyPairSync("ed25519"),
    payload = JSON.stringify({
      version: "0.1.1",
      platform: process.platform,
      arch: process.arch,
      schema: 6,
      minSchema: 6,
      kind: "portable",
      url: "https://example.invalid/test-artifact",
      sha256: createHash("sha256").update(bytes).digest("hex"),
      size: bytes.length,
    });
  const manifest = join(test, "update.json");
  writeFileSync(
    manifest,
    JSON.stringify({
      payload,
      signature: sign(null, Buffer.from(payload), keys.privateKey).toString(
        "base64",
      ),
    }),
  );
  cli(["onboard"], { name: "实际升级鱼" });
  cli(["update", "trust"], {
    source: "https://example.invalid/test-feed",
    publicKey: keys.publicKey
      .export({ type: "spki", format: "pem" })
      .toString(),
  });
  assert.equal(
    cli(["update", "install-file"], { file, manifest }).state,
    "installed",
  );
  assert.equal(
    JSON.parse(readFileSync(join(install, "release.json"))).version,
    "0.1.1",
  );
  cli(["start"]);
  assert.equal(cli(["persona"]).name, "实际升级鱼");
  cli(["stop"]);
  assert.equal(cli(["update", "rollback"]).state, "rolled-back");
  assert.equal(
    JSON.parse(readFileSync(join(install, "release.json"))).version,
    "0.1.0",
  );
  cli(["start"]);
  assert.equal(cli(["persona"]).name, "实际升级鱼");
  console.log(
    JSON.stringify({
      result: "PASS",
      kind: "real-installed-portable",
      platform: process.platform,
      update: "0.1.0 -> 0.1.1 -> 0.1.0",
      dataRetained: true,
    }),
  );
} finally {
  try {
    cli(["stop"]);
  } catch {
    /* cleanup after a failed installation may have no running instance */
  }
  rmSync(test, { recursive: true, force: true });
}
