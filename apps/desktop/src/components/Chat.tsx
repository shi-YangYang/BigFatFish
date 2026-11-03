import { Button, Textarea, Input, Field, Select } from "./Controls";
import { useEffect, useRef, useState } from "react";
import type {
  ChatMessage,
  Conversation,
  ModelConfig,
} from "../../../runtime/src/ai/types";
import { api, errorText, statusText } from "../api";
import { FishAvatar, Icon } from "./UI";
type PendingMessage = { content: string; requestId: string };
export function Chat({
  models,
  fail,
  configureModel,
  connected = true,
  active = true,
}: {
  models: ModelConfig[];
  fail: (e: unknown) => void;
  configureModel: () => void;
  connected?: boolean;
  active?: boolean;
}) {
  const [sessions, setSessions] = useState<Conversation[]>([]),
    [selection, setSelection] = useState({ id: "" }),
    [model, setModel] = useState(""),
    [messages, setMessages] = useState<ChatMessage[]>([]),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState(false),
    [readOnly, setReadOnly] = useState<string[]>([]),
    [notice, setNotice] = useState("");
  const [tools, setTools] = useState<
      { name: string; state: string; at: string }[]
    >([]),
    [audio, setAudio] = useState(""),
    [mediaBusy, setMediaBusy] = useState(false),
    [voice, setVoice] = useState(() => localStorage.getItem("bff-voice") ?? "");
  const selected = selection.id,
    currentSelection = useRef(selection),
    draftVersion = useRef(0),
    mounted = useRef(false),
    pending = useRef(new Map<string, PendingMessage>()),
    sending = useRef<PendingMessage | null>(null),
    drafts = useRef(new Map<string, string>()),
    textRef = useRef(text),
    fileInput = useRef<HTMLInputElement>(null);
  const locked = readOnly.includes(selected);
  function updateText(value: string) {
    draftVersion.current++;
    textRef.current = value;
    setText(value);
  }
  function selectSession(id: string) {
    if (currentSelection.current.id === id) return;
    drafts.current.set(currentSelection.current.id, textRef.current);
    const next = { id };
    currentSelection.current = next;
    setSelection(next);
    updateText(drafts.current.get(id) ?? "");
    setMessages([]);
    setTools([]);
    setNotice("");
    setHistory(false);
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let live = true;
    const origin = currentSelection.current;
    void api<Conversation[]>("/v1/conversations")
      .then((items) => {
        if (!live) return;
        setSessions(items);
        if (currentSelection.current === origin && draftVersion.current === 0)
          selectSession(items[0]?.id ?? "");
      })
      .catch((e) => {
        if (live) fail(e);
      });
    return () => {
      live = false;
    };
  }, [fail]);
  useEffect(() => {
    if (!selected || !connected || !active) return;
    let live = true,
      loading = false;
    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const data = await api<ChatMessage[]>(
          `/v1/conversations/${selected}/messages`,
        );
        if (live && currentSelection.current === selection) setMessages(data);
        const actions = await api<typeof tools>(
          `/v1/conversations/${selected}/tools`,
        );
        if (live && currentSelection.current === selection) setTools(actions);
      } catch (e) {
        if (live && currentSelection.current === selection) fail(e);
      } finally {
        loading = false;
      }
    };
    void load();
    const timer = setInterval(() => void load(), 700);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [selection, selected, connected, active, fail]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (
      !text.trim() ||
      sending.current ||
      locked ||
      !connected ||
      !models.length
    )
      return;
    let origin = currentSelection.current;
    const version = draftVersion.current;
    if (pending.current.get(origin.id)?.content !== text)
      pending.current.set(origin.id, {
        content: text,
        requestId: crypto.randomUUID(),
      });
    const request = pending.current.get(origin.id)!;
    sending.current = request;
    setBusy(true);
    setNotice("");
    try {
      if (!origin.id) {
        const session = await api<Conversation>(
          "/v1/conversations",
          "POST",
          model ? { modelId: model } : {},
        );
        if (!mounted.current) return;
        setSessions((items) => [session, ...items]);
        if (currentSelection.current !== origin) return;
        pending.current.delete("");
        pending.current.set(session.id, request);
        // The unsaved conversation slot now belongs to this persistent session,
        // including edits made while conversation creation was in flight.
        drafts.current.set(session.id, textRef.current);
        drafts.current.delete(origin.id);
        origin = { id: session.id };
        currentSelection.current = origin;
        setSelection(origin);
      }
      await api(`/v1/conversations/${origin.id}/messages`, "POST", request);
      if (
        mounted.current &&
        currentSelection.current === origin &&
        draftVersion.current === version
      )
        updateText("");
      if (pending.current.get(origin.id) === request)
        pending.current.delete(origin.id);
    } catch (e) {
      if (mounted.current && currentSelection.current === origin) {
        if (
          (e instanceof Error ? e.message : String(e)) ===
          "EXTERNAL_CONVERSATION_READ_ONLY"
        ) {
          setReadOnly((items) => [...items, origin.id]);
          setNotice("这是外部渠道会话，请从 QQ 继续对话。");
        } else
          setNotice(
            `${errorText(e)} 若发送结果未知，请先核对历史；重试同一内容会沿用本次请求。`,
          );
      }
    } finally {
      if (sending.current === request) {
        sending.current = null;
        if (mounted.current) setBusy(false);
      }
    }
  }
  async function transcribe(file: File | undefined) {
    if (!file) return;
    if (file.size > 2_000_000) {
      fail("AUDIO_BUDGET_EXCEEDED");
      return;
    }
    const origin = currentSelection.current,
      version = draftVersion.current;
    setMediaBusy(true);
    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      let raw = "";
      for (const n of buffer) raw += String.fromCharCode(n);
      const result = await api<{ text: string }>(
        "/v1/media/transcribe",
        "POST",
        { mimeType: file.type, data: btoa(raw) },
      );
      if (
        mounted.current &&
        origin === currentSelection.current &&
        version === draftVersion.current
      )
        updateText(result.text);
      else if (mounted.current)
        fail("转写期间对话或草稿已变化，请重新选择音频。");
    } catch (e) {
      fail(e);
    } finally {
      if (mounted.current) setMediaBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  async function speak(content: string) {
    if (!voice.trim()) {
      setNotice("请先在输入区的声音选项中填写声音名称。");
      return;
    }
    setMediaBusy(true);
    try {
      const r = await api<{ mimeType: string; data: string }>(
        "/v1/media/synthesize",
        "POST",
        { text: content.slice(0, 4096), voice },
      );
      if (mounted.current) setAudio(`data:${r.mimeType};base64,${r.data}`);
    } catch (e) {
      fail(e);
    } finally {
      if (mounted.current) setMediaBusy(false);
    }
  }
  const title = sessions.find((s) => s.id === selected)?.title ?? "新对话";
  return (
    <section className="chat">
      <div className="chat-toolbar">
        <Button
          type="button"
          className="history-toggle"
          size="compact"
          onClick={() => setHistory(!history)}
          aria-expanded={history}
        >
          历史对话
        </Button>
        <span className="chat-title">{title}</span>
        <Button
          type="button"
          size="compact"
          disabled={busy}
          onClick={() => {
            selectSession("");
            setHistory(false);
          }}
        >
          <Icon name="plus" />
          新对话
        </Button>
      </div>
      <div className="chat-layout">
        <aside
          className={`session-list ${history ? "is-open" : ""}`}
          aria-label="历史对话"
        >
          <div className="session-heading">最近对话</div>
          {sessions.length ? (
            sessions.map((s) => (
              <Button
                type="button"
                className={s.id === selected ? "active" : ""}
                key={s.id}
                onClick={() => selectSession(s.id)}
              >
                <span>{s.title}</span>
                <small>{new Date(s.createdAt).toLocaleDateString()}</small>
              </Button>
            ))
          ) : (
            <p className="muted">还没有对话</p>
          )}
        </aside>
        <div className="conversation">
          <div className="messages" aria-live="polite">
            {!messages.length && (
              <div className="chat-welcome">
                <FishAvatar />
                <h2>
                  {models.length
                    ? "今天想聊些什么？"
                    : "先为大肥鱼添加一个模型"}
                </h2>
                {!models.length ? (
                  <Button type="button" onClick={configureModel}>
                    添加聊天模型
                  </Button>
                ) : (
                  <p>从一句话开始，慢慢了解彼此。</p>
                )}
              </div>
            )}
            {messages.map((m) => (
              <article className={`message ${m.role}`} key={m.id}>
                <div className="message-avatar">
                  {m.role === "assistant" ? <FishAvatar /> : <span>你</span>}
                </div>
                <div className="message-content">
                  <strong>{m.role === "user" ? "你" : "大肥鱼"}</strong>
                  <p>
                    {m.content ||
                      (["queued", "running"].includes(m.status)
                        ? "正在想…"
                        : "")}
                  </p>
                  <small>
                    {m.error ? errorText(m.error) : statusText[m.status]}
                  </small>
                  {m.role === "assistant" &&
                  ["queued", "running"].includes(m.status) ? (
                    <Button
                      type="button"
                      size="compact"
                      onClick={() =>
                        void api(`/v1/messages/${m.id}/cancel`, "POST").catch(
                          fail,
                        )
                      }
                    >
                      停止回复
                    </Button>
                  ) : (
                    m.role === "assistant" &&
                    m.content && (
                      <Button
                        type="button"
                        size="compact"
                        variant="ghost"
                        disabled={mediaBusy || !connected}
                        onClick={() => void speak(m.content)}
                      >
                        朗读
                      </Button>
                    )
                  )}
                </div>
              </article>
            ))}
            {tools.length > 0 && (
              <details className="tool-activity">
                <summary>工具活动 · {tools.length}</summary>
                {tools.map((t, i) => (
                  <p key={i}>
                    {t.name} ·{" "}
                    {t.state === "running"
                      ? "执行中"
                      : t.state === "completed"
                        ? "已完成"
                        : "失败"}
                  </p>
                ))}
              </details>
            )}
          </div>
          {audio && (
            <audio
              className="chat-audio"
              controls
              autoPlay
              src={audio}
              aria-label="AI 合成语音"
            />
          )}
          <div className="composer-area">
            {notice && (
              <p className="inline-notice" role="alert">
                {notice}
              </p>
            )}
            {locked && <p className="muted">此会话仅供查看，请从 QQ 继续。</p>}
            <form className="composer" onSubmit={send}>
              <Textarea
                aria-label="消息"
                value={text}
                onChange={(e) => updateText(e.target.value)}
                placeholder="和大肥鱼聊聊…"
                disabled={locked || !models.length}
              />
              <div className="composer-tools">
                <Input
                  ref={fileInput}
                  hidden
                  type="file"
                  accept="audio/wav,audio/mpeg,audio/mp4,audio/webm,audio/ogg"
                  onChange={(e) => void transcribe(e.target.files?.[0])}
                />
                <Button
                  type="button"
                  size="compact"
                  variant="ghost"
                  disabled={mediaBusy || locked || !connected}
                  onClick={() => fileInput.current?.click()}
                >
                  {mediaBusy ? "处理中…" : "上传音频"}
                </Button>
                <details className="voice-options">
                  <summary>声音</summary>
                  <Field>
                    声音名称
                    <Input
                      value={voice}
                      placeholder="例如 alloy"
                      onChange={(e) => {
                        setVoice(e.target.value);
                        localStorage.setItem("bff-voice", e.target.value);
                      }}
                    />
                  </Field>
                </details>
                {!selected && (
                  <Select
                    aria-label="新会话模型"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  >
                    <option value="">默认聊天模型</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                )}
                <Button
                  variant="primary"
                  className="send-button"
                  type="submit"
                  disabled={
                    busy ||
                    locked ||
                    !connected ||
                    !models.length ||
                    !text.trim()
                  }
                >
                  {busy ? "发送中…" : "发送"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
