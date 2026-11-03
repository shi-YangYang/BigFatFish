import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash, sign } from "node:crypto";
const release = JSON.parse(readFileSync("build/portable/release.json"));
mkdirSync("build/artifacts", { recursive: true });
const file = `build/artifacts/BigFatFish-${release.version}-${release.target}.tar.gz`;
execFileSync("tar", ["-chzf", file, "-C", "build/portable", "."]);
const bytes = readFileSync(file),
  sha256 = createHash("sha256").update(bytes).digest("hex");
writeFileSync(file + ".sha256", sha256 + "\n");
// Signing is explicit and offline; no publishing and no bundled private or test trust key.
if (process.env.BFF_RELEASE_PRIVATE_KEY && process.env.BFF_RELEASE_URL) {
  const payload = JSON.stringify({
    version: release.version,
    platform: process.platform,
    arch: process.arch,
    schema: 6,
    minSchema: 6,
    url: process.env.BFF_RELEASE_URL,
    sha256,
    size: bytes.length,
    kind: "portable",
  });
  writeFileSync(
    file + ".update.json",
    JSON.stringify({
      payload,
      signature: sign(
        null,
        Buffer.from(payload),
        readFileSync(process.env.BFF_RELEASE_PRIVATE_KEY),
      ).toString("base64"),
    }),
  );
}
console.log(file);
