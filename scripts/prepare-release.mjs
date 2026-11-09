/* global fetch, Buffer */
import { trimPortableEmbedding } from "./portable-embedding.mjs";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  chmodSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
const version = "24.20.0";
const checksums = {
  "darwin-arm64":
    "40e5607e5ecb3db9192723776da2d75d966260fc74a7a9e731c1bd67dda96bc8",
  "darwin-x64":
    "9e5b2644cf107befb6aefca676b96d3296bc10138096f022ed378d6233ed81f4",
  "linux-arm64":
    "3515603e2487879a39bc75716f1a2affd027500c64ba50e845cf72cb33219013",
  "linux-x64":
    "855d581f8a4eb1a8117e3426de25fe02770592febcfb31369aee1ffbfee9e8ec",
  "win-x64": "6cac9ffbca8f6a47091e4b5c772e0606049c3871cb67d900c0cedde630e545ba",
  "win-arm64":
    "31c6799744de8a54601643098040c68c3697e56c94e407d61d0e5fa5f34191d7",
};
const win = process.platform === "win32",
  target = `${win ? "win" : process.platform}-${process.arch}`;
if (!checksums[target]) throw new Error("UNSUPPORTED_RELEASE_TARGET");
const filename = `node-v${version}-${target}.${win ? "zip" : "tar.gz"}`,
  url = `https://nodejs.org/download/release/v${version}/${filename}`;
const out = resolve("build/portable"),
  cache = resolve("build/downloads");
mkdirSync(cache, { recursive: true });
const download = join(cache, filename);
if (!existsSync(download)) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("NODE_DOWNLOAD_FAILED");
  writeFileSync(download, Buffer.from(await response.arrayBuffer()));
}
if (
  createHash("sha256").update(readFileSync(download)).digest("hex") !==
  checksums[target]
)
  throw new Error("NODE_CHECKSUM_MISMATCH");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const unpack = join(cache, `node-${target}`);
rmSync(unpack, { recursive: true, force: true });
mkdirSync(unpack);
// Windows tar supports ZIP via libarchive; use its native installed implementation.
execFileSync("tar", ["-xf", download, "-C", unpack]);
const nodeRoot = join(unpack, readdirSync(unpack)[0]);
mkdirSync(join(out, "bin"));
cpSync(
  join(nodeRoot, win ? "node.exe" : "bin/node"),
  join(out, "bin", win ? "node.exe" : "node"),
);
cpSync(join(nodeRoot, "LICENSE"), join(out, "NODE-LICENSE"));
for (const file of ["package.json", "package-lock.json", "LICENSE"])
  cpSync(file, join(out, file));
cpSync("dist", join(out, "dist"), { recursive: true });
execFileSync(
  win ? "npm.cmd" : "npm",
  ["ci", "--omit=dev", "--maxsockets=4", "--no-audit", "--no-fund"],
  { cwd: out, stdio: "inherit", shell: win },
);
trimPortableEmbedding(out);
for (const [command, entry] of [
  ["bigfatfish", "cli"],
  ["bigfatfishd", "runtime"],
]) {
  const script = win
    ? `@echo off\r\n"%~dp0node.exe" "%~dp0..\\dist\\${entry}\\src\\main.js" %*\r\n`
    : `#!/bin/sh\nHERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nexec "$HERE/node" "$HERE/../dist/${entry}/src/main.js" "$@"\n`;
  writeFileSync(join(out, "bin", command + (win ? ".cmd" : "")), script);
  if (!win) chmodSync(join(out, "bin", command), 0o755);
}
const inventory = [];
function walk(dir) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, name.name);
    if (name.isDirectory()) walk(file);
    else if (name.name === "package.json") {
      try {
        const p = JSON.parse(readFileSync(file));
        if (p.name)
          inventory.push({
            name: p.name,
            version: p.version,
            license: p.license ?? "SEE PACKAGE LICENSE",
          });
      } catch {
        /* non-package resource */
      }
    }
  }
}
walk(join(out, "node_modules"));
writeFileSync(
  join(out, "release.json"),
  JSON.stringify(
    {
      version: JSON.parse(readFileSync("package.json")).version,
      schema: 6,
      target,
      node: {
        version,
        url,
        sha256: checksums[target],
        license: "NODE-LICENSE",
      },
      dependencies: inventory,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ portable: out, target }));
