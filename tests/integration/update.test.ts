import { it, expect } from "vitest";
import { generateKeyPairSync, sign, createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
  symlinkSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import {
  verifyRelease,
  installPortable,
  extractRelease,
  rollbackUpdate,
} from "../../apps/runtime/src/maintenance/update.js";
import { paths, preparePaths } from "../../apps/runtime/src/paths.js";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "bff updates ")),
    p = paths(join(root, "fish")),
    install = join(root, "installed"),
    candidate = join(root, "candidate");
  preparePaths(p);
  for (const [directory, version, node] of [
    [install, "0.1.0", "old"],
    [candidate, "0.2.0", "new"],
  ] as const) {
    mkdirSync(join(directory, "bin"), { recursive: true });
    writeFileSync(join(directory, "bin/node"), node);
    writeFileSync(
      join(directory, "release.json"),
      JSON.stringify({ version, schema: 6, target: `${process.platform}-${process.arch}` }),
    );
  }
  writeFileSync(join(p.data, "marker"), "original");
  const file = join(root, "update.tar.gz");
  execFileSync("tar", ["-czf", file, "-C", candidate, "."]);
  const bytes = readFileSync(file);
  const { publicKey, privateKey } = generateKeyPairSync("ed25519"),
    trust = {
      source: "https://example.invalid/release",
      publicKey: publicKey.export({ format: "pem", type: "spki" }).toString(),
    };
  const payload = JSON.stringify({
      version: "0.2.0",
      platform: process.platform,
      arch: process.arch,
      schema: 6,
      minSchema: 6,
      url: "https://example.invalid/artifact",
      sha256: createHash("sha256").update(bytes).digest("hex"),
      size: bytes.length,
      kind: "portable",
    }),
    document = {
      payload,
      signature: sign(null, Buffer.from(payload), privateKey).toString("base64"),
    };
  return { root, p, install, file, trust, document };
}

// Signing and manifest checks apply on Windows too, even though portable
// installation is deliberately unsupported there.
it("verifies the platform release and rejects a modified signed payload", () => {
  const f = fixture();
  try {
    expect(verifyRelease(f.document, f.trust)).toMatchObject({
      version: "0.2.0", platform: process.platform, arch: process.arch,
    });
    expect(() => verifyRelease({ ...f.document, payload: f.document.payload + " " }, f.trust))
      .toThrow("UPDATE_SIGNATURE_INVALID");
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

it.runIf(process.platform === "win32")("requires the Windows installer before changing a portable installation or fish", () => {
  const f = fixture();
  try {
    let checked = 0;
    expect(() => installPortable(f.p, f.install, {
      file: f.file, release: verifyRelease(f.document, f.trust),
    }, () => { checked++; })).toThrow("UPDATE_REQUIRES_WINDOWS_INSTALLER");
    expect(checked).toBe(0);
    expect(readFileSync(join(f.install, "bin/node"), "utf8")).toBe("old");
    expect(readFileSync(join(f.p.data, "marker"), "utf8")).toBe("original");
    expect(existsSync(join(f.p.runtime, "update-data"))).toBe(false);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

it.runIf(process.platform !== "win32")("binds POSIX extraction to verified bytes; failed install and rollback retain fish and binary", () => {
  const { root, p, install, file, trust, document } = fixture();
  try {
    const release = verifyRelease(document, trust);
    expect(() =>
      installPortable(p, install, { file, release: { ...release, version: "0.1.0" } }, () => {}),
    ).toThrow("UPDATE_NOT_NEWER");
    expect(() => installPortable(p, install, { file, release }, () => {
      throw new Error("HEALTH_FAILED");
    })).toThrow("HEALTH_FAILED");
    expect(readFileSync(join(install, "bin/node"), "utf8")).toBe("old");
    expect(readFileSync(join(p.data, "marker"), "utf8")).toBe("original");
    rmSync(join(p.runtime, "update-data"), { recursive: true, force: true });
    let checked = 0;
    const result = installPortable(p, install, { file, release }, () => { checked++; });
    expect(result.state).toBe("installed");
    expect(checked).toBe(2);
    expect(readFileSync(join(install, "bin/node"), "utf8")).toBe("new");
    writeFileSync(join(p.data, "marker"), "changed");
    rollbackUpdate(p);
    expect(readFileSync(join(p.data, "marker"), "utf8")).toBe("original");
    expect(readFileSync(join(install, "bin/node"), "utf8")).toBe("old");
    const unsafe = join(root, "unsafe");
    mkdirSync(unsafe);
    symlinkSync("/tmp", join(unsafe, "escape"));
    const bad = join(root, "bad.tar.gz");
    execFileSync("tar", ["-czf", bad, "-C", unsafe, "."]);
    const output = join(root, "extract");
    mkdirSync(output);
    expect(() => extractRelease(readFileSync(bad), output)).toThrow("UPDATE_ARCHIVE_INVALID");
    expect(existsSync(join(output, "escape"))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
