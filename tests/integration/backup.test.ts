import { it, expect } from "vitest";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  writeFileSync,
  cpSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { startRuntime } from "../../apps/runtime/src/lifecycle.js";
import { paths } from "../../apps/runtime/src/paths.js";
import {
  exportArchive,
  restoreArchive,
  restoreSnapshot,
} from "../../apps/runtime/src/maintenance/archive.js";
import { requestRuntime } from "../../apps/runtime/src/connection.js";
import { fixtureModel } from "../fixtures/model.mjs";
import type { ChatMessage } from "../../apps/runtime/src/ai/types.js";
it("backs up a drained real DSH fish, restores without hidden engine context, resumes and protects credentials and original data", async () => {
  const root = mkdtempSync(join(tmpdir(), "bff 迁移 ")),
    p = paths(join(root, "source")),
    q = paths(join(root, "new fish")),
    fixture = await fixtureModel();
  let runtime = await startRuntime(p);
  try {
    const call = <T>(url: string, method = "GET", body?: unknown) =>
      requestRuntime<T>(runtime.connection, url, method, body);
    await call("/v1/models", "POST", {
      id: "fixture",
      label: "迁移模型",
      provider: "openai",
      baseURL: fixture.url,
      model: "fixture-model",
      contextWindow: 8192,
      maxTokens: 512,
      timeoutMs: 20000,
      vision: false,
      apiKey: "UNIQUE_SECRET_BACKUP_888",
    });
    const persona = await call<Record<string, unknown>>("/v1/persona");
    await call("/v1/persona", "PUT", { ...persona, name: "迁移鱼" });
    const conversation = await call<{ id: string }>(
      "/v1/conversations",
      "POST",
      { modelId: "fixture" },
    );
    async function chat(content: string) {
      const m = await call<ChatMessage>(
        `/v1/conversations/${conversation.id}/messages`,
        "POST",
        { content, requestId: content },
      );
      for (let i = 0; i < 300; i++) {
        const v = await call<ChatMessage>(`/v1/messages/${m.id}`);
        if (!["queued", "running"].includes(v.status)) return v;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error("timeout");
    }
    expect((await chat("迁移前蓝色标记")).status).toBe("completed");
    const oldToken = runtime.connection.token;
    await runtime.stop();
    const seeded = new DatabaseSync(p.database);
    seeded
      .prepare("INSERT INTO settings VALUES('model_routes',?)")
      .run(JSON.stringify({ chat: "fixture" }));
    seeded
      .prepare(
        "INSERT INTO daily_diaries VALUES('diary-test','2026-11-03','Asia/Shanghai','迁移日记','[]',1,'fixture','now','ready')",
      )
      .run();
    seeded
      .prepare(
        "INSERT INTO activity_records VALUES('experience-test','experience','source','迁移经历','now')",
      )
      .run();
    seeded
      .prepare("INSERT INTO experiences VALUES('experience-test','迁移经历')")
      .run();
    const history = seeded.prepare(
      "INSERT INTO messages(id,conversation_id,role,content,status,created_at,request_id,persona_version,author) VALUES(?,?,?,?,?,?,?,?,?)",
    );
    seeded.exec("BEGIN");
    for (let i = 0; i < 10001; i++)
      history.run(
        `old-${i}`,
        conversation.id,
        i % 2 ? "assistant" : "user",
        i === 10000 ? "迁移前蓝色标记 latest-history" : `old-history-${i}`,
        "completed",
        "now",
        `seed-${i}`,
        1,
        i % 2 ? "fish" : "local-owner",
      );
    seeded.exec("COMMIT");
    seeded.close();
    const archive = join(root, "fish.bff"),
      encrypted = join(root, "secret.bff");
    await exportArchive(p, archive);
    await exportArchive(p, encrypted, {
      credentials: true,
      password: "test-password-12345",
    });
    expect(readFileSync(archive, "utf8")).not.toContain("UNIQUE_SECRET");
    const inner = JSON.parse(
      Buffer.from(
        JSON.parse(readFileSync(archive, "utf8")).files[0].content,
        "base64",
      ).toString(),
    );
    expect(JSON.stringify(inner)).not.toContain("UNIQUE_SECRET");
    expect(() => restoreArchive(q, encrypted, "wrong")).toThrow(
      "ARCHIVE_DECRYPT_FAILED",
    );
    restoreArchive(q, archive);
    runtime = await startRuntime(q);
    expect(runtime.connection.token).not.toBe(oldToken);
    expect((await call<{ name: string }>("/v1/persona")).name).toBe("迁移鱼");
    expect(
      readFileSync(join(q.data, "diaries/diary-test.md"), "utf8"),
    ).toContain("迁移日记");
    expect((await call<Record<string, string>>("/v1/model-routes")).chat).toBe(
      "fixture",
    );
    expect((await call<{ hasKey: boolean }[]>("/v1/models"))[0]?.hasKey).toBe(
      false,
    );
    expect((await call<{ paused: boolean }>("/v1/activities")).paused).toBe(
      true,
    );
    const resumed = await chat("迁移后继续");
    expect(resumed.status).toBe("completed");
    expect(resumed.error).toMatch(/^RESTORED_CONTEXT_100_9903_0$/);
    const request = JSON.stringify(fixture.requests.at(-1)?.body.messages);
    expect(request).toContain("latest-history");
    expect(request).not.toContain("old-history-0");
    expect(request.match(/迁移后继续/g)?.length).toBe(1);
    expect(JSON.stringify(fixture.requests.at(-1)?.body.messages)).toContain(
      "迁移前蓝色标记",
    );
    await runtime.stop();
    const before = readFileSync(q.database);
    const bad = JSON.parse(readFileSync(archive, "utf8"));
    bad.files[0].path = "../../escape";
    writeFileSync(join(root, "bad"), JSON.stringify(bad));
    expect(() => restoreArchive(q, join(root, "bad"))).toThrow(
      "INVALID_ARCHIVE_PATH",
    );
    expect(readFileSync(q.database)).toEqual(before);
    inner.schema = 999;
    const b = Buffer.from(JSON.stringify(inner));
    bad.files[0] = {
      path: "data.json",
      content: b.toString("base64"),
      size: b.length,
      sha256: createHash("sha256").update(b).digest("hex"),
    };
    writeFileSync(join(root, "bad"), JSON.stringify(bad));
    expect(() => restoreArchive(q, join(root, "bad"))).toThrow(
      "ARCHIVE_SCHEMA_UNSUPPORTED",
    );
    restoreArchive(q, encrypted, "test-password-12345");
    runtime = await startRuntime(q);
    expect((await call<{ hasKey: boolean }[]>("/v1/models"))[0]?.hasKey).toBe(
      true,
    );
    await runtime.stop();
    const db = new DatabaseSync(q.database);
    expect(db.prepare("SELECT COUNT(*) AS n FROM approvals").get()?.n).toBe(0);
    db.close();
  } finally {
    await runtime.stop();
    await fixture.close();
    rmSync(root, { recursive: true, force: true });
  }
}, 60000);
it("selective exports do not reintroduce engine history; restore recovery keeps lock location and rejects unsafe model configuration", async () => {
  const root = mkdtempSync(join(tmpdir(), "bff restore guards ")),
    p = paths(join(root, "fish")),
    q = paths(join(root, "restored"));
  const runtime = await startRuntime(p);
  await runtime.stop();
  try {
    const file = join(root, "partial");
    await exportArchive(p, file, { scopes: ["persona"] });
    restoreArchive(q, file);
    const db = new DatabaseSync(q.database);
    expect(db.prepare("SELECT COUNT(*) AS n FROM conversations").get()?.n).toBe(
      0,
    );
    expect(
      db.prepare("SELECT COUNT(*) AS n FROM agent_sessions").get()?.n,
    ).toBe(0);
    db.close();
    const { acquireInstance } = await import(
      "../../apps/runtime/src/instance.js"
    );
    const unlock = acquireInstance(q.lock);
    try {
      expect(() => restoreArchive(q, file)).toThrow("ALREADY_RUNNING");
    } finally {
      unlock();
    }
    const source = new DatabaseSync(p.database);
    source.prepare("INSERT INTO models VALUES(?,?,NULL)").run(
      "bad",
      JSON.stringify({
        id: "bad",
        provider: "openai",
        baseURL: "file:///etc/passwd",
      }),
    );
    source.close();
    const unsafe = join(root, "unsafe");
    await exportArchive(p, unsafe, { scopes: ["models"] });
    const before = readFileSync(q.database);
    expect(() => restoreArchive(q, unsafe)).toThrow();
    expect(readFileSync(q.database)).toEqual(before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("keeps interrupted upgrades stopped and invalidates old approvals on snapshot rollback", async () => {
  const root = mkdtempSync(join(tmpdir(), "bff rollback gates ")),
    p = paths(root);
  const runtime = await startRuntime(p);
  await runtime.stop();
  try {
    const db = new DatabaseSync(p.database);
    db.prepare(
      "INSERT INTO approvals(id,payload,digest,revision,expires_at,status,created_at) VALUES('old','{}','digest','revision',?,'pending','now')",
    ).run(Date.now() + 60000);
    db.exec(
      "INSERT OR REPLACE INTO settings VALUES('activities.paused','false')",
    );
    db.close();
    const snapshot = join(root, "snapshot");
    for (const part of ["config", "data"])
      cpSync(join(root, part), join(snapshot, part), { recursive: true });
    writeFileSync(
      join(p.runtime, "update-journal.json"),
      JSON.stringify({ phase: "old-moved" }),
    );
    await expect(startRuntime(p)).rejects.toThrow("UPDATE_IN_PROGRESS");
    rmSync(join(p.runtime, "update-journal.json"));
    restoreSnapshot(p, snapshot);
    const restored = new DatabaseSync(p.database);
    expect(
      restored.prepare("SELECT COUNT(*) AS n FROM approvals").get()?.n,
    ).toBe(0);
    expect(
      restored
        .prepare("SELECT value FROM settings WHERE key='activities.paused'")
        .get()?.value,
    ).toBe("true");
    restored.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
