import { subscribeChat } from '../chat-events';
import { mergeChatMessage } from '../chat-messages';
import { notifyMessage } from './Notifications';
import { PromptInput } from "./beui/prompt-input";
import { Message, MessageAvatar, MessageContent, MessageBubble, MessageBubbleContent } from "./beui/message";
import { Disclosure, Menu, Alert } from "./Surfaces";
import { Button, Input, Field } from "./Controls";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  ChatMessage,
  Conversation,
  ModelConfig,
} from "../../../runtime/src/ai/types";
import { api, errorText, statusText } from "../api";
import { Drawer, FishAvatar, Icon } from "./UI";
type PendingMessage = { content: string; requestId: string };
export function Chat({
  models,
  fail,
  configureModel,
  connected = true,
  active = true,
  renderHeader,
}: {
  models: ModelConfig[];
  fail: (e: unknown) => void;
  configureModel: () => void;
  connected?: boolean;
  active?: boolean;
  renderHeader: (content: ReactNode) => ReactNode;
}) {
  const [voiceOpen, setVoiceOpen] = useState(false);
  useEffect(() => { if (!active) setVoiceOpen(false); }, [active]);
  const [sessions, setSessions] = useState<Conversation[]>([]),
    [selection, setSelection] = useState({ id: "" }),
    [chatModel, setChatModel] = useState(""),
    [messages, setMessages] = useState<ChatMessage[]>([]),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState(false),
    [readOnly, setReadOnly] = useState<string[]>([]),
    [streamOffline, setStreamOffline] = useState(false),
    [streamRetry, setStreamRetry] = useState(0);
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
  const currentSession = sessions.find(session => session.id === selected);
  const locked = readOnly.includes(selected) || currentSession?.readOnly === true;
  const senderLabel = locked ? "对方" : "你";
  const sessionModel = currentSession?.modelId;
  const canChat = models.some(model => model.id === (selected ? sessionModel : chatModel));
  function updateText(value: string) {
    draftVersion.current++;
    textRef.current = value;
    setText(value);
  }
  function selectSession(id: string) {
    setHistory(false);
    if (currentSelection.current.id === id) return;
    drafts.current.set(currentSelection.current.id, textRef.current);
    const next = { id };
    currentSelection.current = next;
    setSelection(next);
    updateText(drafts.current.get(id) ?? "");
    setMessages([]);
    setTools([]);

  }
  useEffect(() => {
    let live = true;
    void api<{ chat?: string }>("/v1/model-routes").then(routes => { if (live) setChatModel(routes.chat ?? ""); }).catch(fail);
    return () => { live = false; };
  }, [models, fail]);
  useEffect(() => {
    if (!active) setHistory(false);
  }, [active]);
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
          selectSession(items.find(session => !session.readOnly)?.id ?? "");
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
    let live = true, attempt = 0, stop = () => {}, timer: ReturnType<typeof setTimeout>;
    function connectStream() {
      stop();
      stop = subscribeChat(selected, event => {
        if (!live || currentSelection.current !== selection || event.conversationId !== selected) return;
        if (event.type === 'snapshot-start') { setMessages([]); setTools([]); }
        else if (event.type === 'snapshot-end') { setTools(event.tools ?? []); setStreamOffline(false); attempt = 0; }
        else if ((event.type === 'message' || event.type === 'snapshot-message') && event.message) setMessages(items => mergeChatMessage(items, event.message!));
        else if (event.type === 'tool' && event.name && event.state && event.at) setTools(items => [...items.slice(-499), { name: event.name!, state: event.state!, at: event.at! }]);
      }, () => {
        if (!live) return;
        setStreamOffline(true); stop();
        if (attempt < 5) timer = setTimeout(connectStream, Math.min(10000, 500 * 2 ** attempt++));
      });
    }
    connectStream();
    return () => { live = false; clearTimeout(timer); stop(); };
  }, [selection, selected, connected, active, streamRetry]);
  async function send() {
    if (
      !text.trim() ||
      sending.current ||
      locked ||
      !connected ||
      !canChat
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

    try {
      if (!origin.id) {
        const session = await api<Conversation>(
          "/v1/conversations",
          "POST",
          {},
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
          notifyMessage("这是外部渠道会话，请从 QQ 继续对话。");
        } else
          notifyMessage(
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
      notifyMessage("请先在输入区的声音选项中填写声音名称。");
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
  const title = currentSession?.title ?? "新对话";
  const voiceOptions = (
<Menu open={active && voiceOpen} onOpenChange={setVoiceOpen} side="top" align="start" trigger={<Button variant="ghost" size="compact">声音</Button>} className="voice-options">

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
                </Menu>
  );
  return (
    <section className="chat">
      {active && renderHeader(
        <>
          <Button
            type="button"
            className="history-toggle"
            size="icon"
            aria-label="历史对话"
            title="历史对话"
            onClick={() => setHistory(true)}
            aria-expanded={history}
          >
            <Icon name="history" />
          </Button>
          <h1 className="chat-title" title={title}>
            {title}
          </h1>
          <Button
            type="button"
            className="new-chat-button"
            aria-label="新对话"
            title="新对话"
            disabled={busy}
            onClick={() => selectSession("")}
          >
            <Icon name="plus" />
            <span>新对话</span>
          </Button>
        </>,
      )}
      {active && history && (
        <Drawer title="历史对话" close={() => setHistory(false)}>
          <div className="session-list">
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
                  <small>{s.readOnly || readOnly.includes(s.id) ? "QQ · 只读" : "本地聊天"} · {new Date(s.createdAt).toLocaleDateString()}</small>
                </Button>
              ))
            ) : (
              <p className="muted">还没有对话</p>
            )}
          </div>
        </Drawer>
      )}
      <div className="chat-layout">
        <div className="conversation">
          <div className="messages" aria-live="polite">
            {!messages.length && (
              <div className="chat-welcome">
                <FishAvatar />
                <h2>
                  {locked ? "QQ 会话记录" : canChat
                    ? "今天想聊些什么？"
                    : "先为大肥鱼添加一个模型"}
                </h2>
                {locked ? <p>请在 QQ 中继续对话。</p> : !canChat ? (
                  <Button type="button" onClick={configureModel}>
                    添加聊天模型
                  </Button>
                ) : (
                  <p>从一句话开始，慢慢了解彼此。</p>
                )}
              </div>
            )}
            {messages.map((m) => (
              <Message from={m.role === "user" ? "user" : "assistant"} aria-label={m.role === "user" ? `${senderLabel}的消息` : "大肥鱼的消息"} className={`message ${m.role} flex-row`} key={m.id}>
                <MessageAvatar className="message-avatar">
                  {m.role === "assistant" ? <FishAvatar /> : <span>{locked ? "QQ" : "你"}</span>}
                </MessageAvatar>
                <MessageContent className="message-content items-start">
                  <strong>{m.role === "user" ? senderLabel : "大肥鱼"}</strong>
                  <MessageBubble align="start" variant={m.role === "assistant" ? "ghost" : "soft"} className="chat-bubble"><MessageBubbleContent className="max-w-full text-[15px] leading-[1.85]">
                    {m.content ||
                      (["queued", "running"].includes(m.status)
                        ? "正在想…"
                        : "")}
                  </MessageBubbleContent></MessageBubble>
                  {m.error ? <Alert>{errorText(m.error)}</Alert> : <small>{statusText[m.status]}</small>}
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
                </MessageContent>
              </Message>
            ))}
            {tools.length > 0 && (
              <Disclosure className="tool-activity" title={<>工具活动 · {tools.length}</>}>

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
              </Disclosure>
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
            {streamOffline && <p role="status" className="stream-status">聊天连接已断开，已有回复已保留。<Button size="compact" onClick={() => setStreamRetry(value => value + 1)}>重新连接</Button></p>}
            {locked && <div className="readonly-chat"><span>QQ 会话 · 只读，请在 QQ 中继续对话。</span>{voiceOptions}<Button onClick={() => selectSession("")}>开始本地对话</Button></div>}
            {!locked && <PromptInput className="composer" onSubmit={() => send()}
              aria-label="消息" value={text} onValueChange={updateText}
              placeholder="和大肥鱼聊聊…" disabled={locked || !canChat}
              submitDisabled={busy || !connected} footer={
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
                {voiceOptions}
                <Button variant="primary" className="send-button" type="submit"
                  disabled={busy || locked || !connected || !canChat || !text.trim()}>
                  {busy ? "发送中…" : "发送"}
                </Button>
              </div>
            } />}
          </div>
        </div>
      </div>
    </section>
  );
}
