import { loadConversations } from "../../api/chat";
import { ContentScroll, Card , Alert} from "../../components/Surfaces";
import {
  Field,
  Select,
  Button,
  Input,
  Checkbox,
  Textarea,
  FormGrid,
  ActionRow,
} from "../../components/Controls";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import { Sources, TaskList, useLifeRefresh } from "./Life";
import type {
  Memory,
  MemoryKind,
  MemoryTask,
} from "../../../../runtime/src/memory/types";
import type { Conversation } from "../../../../runtime/src/ai/types";
const labels: Record<MemoryKind, string> = {
  fact: "事实",
  preference: "偏好",
  relationship: "关系",
  experience: "经历",
  interest: "兴趣",
  persona: "人格",
};
const states: Record<string, string> = {
  candidate: "待确认",
  confirmed: "已确认",
  rejected: "已拒绝",
};
const empty = {
  kind: "fact" as MemoryKind,
  subject: "",
  content: "",
  importance: 3,
};
export function Memories({ fail }: { fail: (e: unknown) => void }) {
  const [memories, setMemories] = useState<Memory[]>([]),
    [sessions, setSessions] = useState<Conversation[]>([]),
    [tasks, setTasks] = useState<MemoryTask[]>([]),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [kind, setKind] = useState(""),
    [offset, setOffset] = useState(0),
    [session, setSession] = useState(""),
    [editing, setEditing] = useState<Memory>(),
    [panel, setPanel] = useState<"edit" | "extract" | null>(null),
    [form, setForm] = useState(empty),
    [allowConflict, setAllowConflict] = useState(false),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [exportPath, setExportPath] = useState("");
  const load = useCallback(
    async (isCurrent: () => boolean = () => true) => {
      const [a, b, c] = await Promise.all([
        api<Memory[]>("/v1/memories/search", "POST", {
          query,
          status,
          kind,
          offset,
        }),
        loadConversations(),
        api<MemoryTask[]>("/v1/memory-tasks"),
      ]);
      if (isCurrent()) {
        setMemories(a);
        setSessions(b);
        setTasks(c);
      }
    },
    [query, status, kind, offset],
  );
  const refreshError = useLifeRefresh(load);
  useEffect(() => {
    setSelected([]);
  }, [query, status, kind, offset]);
  const acting = useRef(false);
  const act = async (run: () => Promise<unknown>) => {
    if (acting.current) return;
    acting.current = true;
    setBusy(true);
    try {
      await run();
      await load();
    } catch (e) {
      fail(e);
    } finally {
      acting.current = false;
      setBusy(false);
    }
  };
  const save = () =>
    act(async () => {
      await api(
        editing ? `/v1/memories/${editing.id}` : "/v1/memories",
        editing ? "PUT" : "POST",
        { ...form, version: editing?.version, allowConflict },
      );
      setEditing(undefined);
      setForm(empty);
      setAllowConflict(false);
      setPanel(null);
    });
  const download = async (format: string) => {
    const result = await api<{ path: string }>("/v1/memories/export", "POST", {
      format,
      ids: selected,
    });
    setExportPath(result.path);
  };
  return (
    <section className="page-section">
      <div className="section-heading">
        <h2>记忆</h2>
        <ActionRow>
          <Button disabled={busy} aria-expanded={panel === "extract"} onClick={() => setPanel(panel === "extract" ? null : "extract")}>从对话整理</Button>
          <Button variant="primary" disabled={busy} aria-expanded={panel === "edit"} onClick={() => setPanel(panel === "edit" ? null : "edit")}>{editing ? "继续编辑" : "添加记忆"}</Button>
        </ActionRow>
      </div>
      {refreshError && (
        <Alert role="alert" className="error">
          {refreshError}
        </Alert>
      )}
      {panel === "extract" && <Card>
      <h3>从对话整理</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void act(() =>
            api("/v1/memory-tasks/extract", "POST", {
              conversationId: session,
              requestId: crypto.randomUUID(),
            }),
          );
        }}
      >
        <ActionRow>
          <Field>
            选择对话
            <Select
              disabled={busy}
              value={session}
              onValueChange={(value) => setSession(value)}
              required
            >
              <option value="">选择对话</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" variant="primary" disabled={busy || !session}>
            提取候选
          </Button>
        </ActionRow>
      </form>
      </Card>}
      <TaskList
        tasks={tasks.filter((t) => t.kind === "extract")}
        refresh={load}
        fail={fail}
      />
      {panel === "edit" && <Card>
      <h3>{editing ? "编辑记忆" : "添加记忆"}</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <FormGrid>
        <Field>
          类型
          <Select
            disabled={busy}
            value={form.kind}
            onValueChange={(value) =>
              setForm({ ...form, kind: value as MemoryKind })
            }
          >
            {Object.entries(labels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          重要性
          <Input
            disabled={busy}
            type="number"
            min={1}
            max={5}
            value={form.importance}
            onChange={(e) =>
              setForm({ ...form, importance: Number(e.target.value) })
            }
          />
        </Field>
        </FormGrid>
        <Field>
          主题
          <Input
            disabled={busy}
            required
            maxLength={120}
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
        </Field>
        <Field>
          内容
          <Textarea
            disabled={busy}
            required
            maxLength={2000}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
          />
        </Field>

        <Field className="check">
          <Checkbox
            disabled={busy}

            checked={allowConflict}
            onCheckedChange={(value) => setAllowConflict(value)}
          />
          允许与同主题已确认记忆并存
        </Field>
        <ActionRow>
        <Button type="submit" variant="primary" disabled={busy}>
          保存
        </Button>
        <Button disabled={busy} onClick={() => setPanel(null)}>收起</Button>
        {editing && (
          <Button
            disabled={busy}
            type="button"
            onClick={() => {
              setPanel(null);
              setEditing(undefined);
              setForm(empty);
              setAllowConflict(false);
            }}
          >
            取消编辑
          </Button>
        )}
        </ActionRow>
      </form>
      </Card>}
      <FormGrid className="filters">
        <Field>
          搜索
          <Input
            disabled={busy}
            value={query}
            onChange={(e) => {
              setOffset(0);
              setQuery(e.target.value);
            }}
          />
        </Field>
        <Field>
          状态
          <Select
            disabled={busy}
            value={status}
            onValueChange={(value) => {
              setOffset(0);
              setStatus(value);
            }}
          >
            <option value="">全部</option>
            {Object.entries(states).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          类型
          <Select
            disabled={busy}
            value={kind}
            onValueChange={(value) => {
              setOffset(0);
              setKind(value);
            }}
          >
            <option value="">全部</option>
            {Object.entries(labels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
      </FormGrid>
      {selected.length > 0 && <ActionRow>
        <span>已选 {selected.length} 条</span>
        <Button
          type="button"
          disabled={selected.length !== 2 || busy}
          onClick={() => {
            const a = memories.find((m) => m.id === selected[0]),
              b = memories.find((m) => m.id === selected[1]);
            if (
              a &&
              b &&
              window.confirm(
                `将两条同类型记忆合并，保留「${a.content}」及其状态，并汇总来源？`,
              )
            )
              void act(async () => {
                await api(`/v1/memories/${a.id}/merge`, "POST", {
                  version: a.version,
                  otherId: b.id,
                  otherVersion: b.version,
                });
                setSelected([]);
              });
          }}
        >
          合并所选两条
        </Button>
        <Button
          type="button"
          disabled={!selected.length || busy}
          onClick={() => void act(() => download("json"))}
        >
          导出所选 JSON
        </Button>
        <Button
          type="button"
          disabled={!selected.length || busy}
          onClick={() => void act(() => download("markdown"))}
        >
          导出所选 Markdown
        </Button>
      </ActionRow>}
      {exportPath && <p className="prewrap">导出已保存：{exportPath}</p>}
      {!memories.length && <p>没有符合条件的记忆。可整理对话，或直接添加。</p>}
      <ContentScroll label="记忆记录" className="content-scroll-list">
      {memories.map((m) => (
        <Card key={m.id}>
          <Field className="check">
            <Checkbox
              disabled={busy}

              checked={selected.includes(m.id)}
              onCheckedChange={(value) =>
                setSelected(
                  value
                    ? [...selected, m.id]
                    : selected.filter((id) => id !== m.id),
                )
              }
            />
            {labels[m.kind]} · {states[m.status]} · 重要性 {m.importance}
          </Field>
          <h3>{m.subject}</h3>
          <p>
            {m.visibility === "shared" ? "允许在已授权群聊中使用" : "主人私有"}
          </p>
          <p className="prewrap">{m.content}</p>
          {!!m.conflicts.length && (
            <Alert variant="warning">
              与 {m.conflicts.length} 条已确认记忆可能冲突，请检查同主题记录。
            </Alert>
          )}
          <Sources sources={m.sources} fail={fail} />
          <ActionRow className="actions">
            <Button
              type="button"
              disabled={busy}
              onClick={() => {
                if (
                  m.visibility === "shared" ||
                  window.confirm(
                    "允许所有已授权 QQ 群使用这条记忆的内容？来源原文仍保持私有。",
                  )
                )
                  void act(() =>
                    api(`/v1/memories/${m.id}`, "PUT", {
                      version: m.version,
                      visibility:
                        m.visibility === "shared" ? "private" : "shared",
                    }),
                  );
              }}
            >
              {m.visibility === "shared" ? "设为私有" : "允许群聊使用"}
            </Button>
            {m.status !== "confirmed" && (
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  void act(() =>
                    api(`/v1/memories/${m.id}`, "PUT", {
                      version: m.version,
                      status: "confirmed",
                    }),
                  )
                }
              >
                确认
              </Button>
            )}
            {m.status !== "rejected" && (
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  void act(() =>
                    api(`/v1/memories/${m.id}`, "PUT", {
                      version: m.version,
                      status: "rejected",
                    }),
                  )
                }
              >
                拒绝
              </Button>
            )}
            <Button
              type="button"
              disabled={busy}
              onClick={() => {
                setPanel("edit");
                setEditing(m);
                setForm({
                  kind: m.kind,
                  subject: m.subject,
                  content: m.content,
                  importance: m.importance,
                });
                setAllowConflict(false);
              }}
            >
              编辑
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "删除这条记忆？它将不再用于后续记忆检索，原始聊天会保留。",
                  )
                )
                  void act(() =>
                    api(`/v1/memories/${m.id}/delete`, "POST", {
                      version: m.version,
                    }),
                  );
              }}
            >
              删除
            </Button>
          </ActionRow>
        </Card>
      ))}
      </ContentScroll>
      {(offset > 0 || memories.length >= 100) && <ActionRow>
        <Button
          type="button"
          disabled={busy || offset === 0}
          onClick={() => setOffset(Math.max(0, offset - 100))}
        >
          上一页
        </Button>
        <Button
          type="button"
          disabled={busy || memories.length < 100}
          onClick={() => setOffset(offset + 100)}
        >
          下一页
        </Button>
      </ActionRow>}
    </section>
  );
}
