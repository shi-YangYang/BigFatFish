import { expect, it } from "vitest";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const cli = resolve("dist/cli/src/main.js");
function invoke(data: string, args: string[], input?: string) {
  return new Promise<{ code: number | null; output: Record<string, unknown> }>((done, reject) => {
    const child = spawn(process.execPath, [cli, ...args, "--data-dir", data, "--json"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`CLI_TIMEOUT: ${stderr}`));
    }, 15000);
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("exit", code => {
      clearTimeout(timer);
      try { done({ code, output: JSON.parse(stdout) }); }
      catch { reject(new Error(`CLI_INVALID_OUTPUT: ${stdout} ${stderr}`)); }
    });
    // No input means the pipe stays open. config must exit without an EOF.
    if (input !== undefined) child.stdin.end(input);
  });
}

it("config returns with stdin open; onboard and encrypted backup still consume JSON from stdin", async () => {
  const root = mkdtempSync(join(tmpdir(), "bff cli input "));
  const data = join(root, "fish"), archive = join(root, "fish.bff");
  try {
    const initial = await invoke(data, ["config"]);
    expect(initial.code).toBe(0);
    expect(initial.output).toHaveProperty("persona");
    const onboard = await invoke(data, ["onboard"], JSON.stringify({ name: "输入回归鱼" }));
    expect(onboard.code).toBe(0);
    expect(onboard.output.configured).toBe(true);
    const configured = await invoke(data, ["config"]);
    expect(configured.output.persona).toMatchObject({ name: "输入回归鱼" });
    const password = "isolated-regression-password";
    const backup = await invoke(data, ["backup", "export"], JSON.stringify({ file: archive, credentials: true, password }));
    expect(backup.code).toBe(0);
    expect(existsSync(archive)).toBe(true);
    expect((await invoke(data, ["backup", "inspect"], JSON.stringify({ file: archive, password }))).code).toBe(0);
    expect((await invoke(data, ["backup", "inspect"], JSON.stringify({ file: archive, password: "incorrect-password" }))).code).toBe(1);
  } finally {
    execFileSync(process.execPath, [cli, "stop", "--data-dir", data, "--json"]);
    rmSync(root, { recursive: true, force: true });
  }
});

it("onboard preserves the JSON input size limit before starting a runtime", async () => {
  const root = mkdtempSync(join(tmpdir(), "bff cli oversized "));
  try {
    expect(await invoke(root, ["onboard"], " ".repeat(65537))).toEqual({
      code: 1, output: { error: "INPUT_TOO_LARGE" },
    });
    expect(existsSync(join(root, "runtime/connection.json"))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
