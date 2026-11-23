import { acceptsPurpose } from "../../api/model-purposes";
import { cancelMessage, createConversation, loadLocalConversations, sendMessage, type PendingMessage } from "../../api/chat";
import { subscribeChat } from '../../api/chat-stream';
import { mergeChatMessage, statusText } from './chat-messages';
import { notifyMessage } from '../../components/Notifications';
import { PromptInput } from "../../components/beui/prompt-input";
import { Message, MessageAvatar, MessageContent, MessageBubble, MessageBubbleContent } from "../../components/beui/message";
import { EmptyState } from "../../components/PageLayout";
import { History, Volume2, AudioLines, SendHorizontal } from "lucide-react";
import { Disclosure, Menu, Alert, ContentScroll } from "../../components/Surfaces";
import { Button, Input, Field, Select, ActionRow } from "../../components/Controls";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  ChatMessage,
  Conversation,
  ModelConfig, ModelPurpose,
} from "../../../../runtime/src/ai/types";
import { api } from "../../api/client";
import { modelErrorText } from "../../api/model-error-text";
import { errorText } from "../../api/errors";
import { Drawer, FishAvatar, Icon } from "../../components/UI";
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
  configureModel: (complete?: (id: string) => void | Promise<void>, conversationOnly?: boolean) => void;
  connected?: boolean;
  active?: boolean;
  renderHeader: (content: ReactNode) => ReactNode;
}) {
  const [voiceOpen, setVoiceOpen] = useState(false);
  useEffect(() => { if (!active) setVoiceOpen(false); }, [active]);
  const [sessions, setSessions] = useState<Conversation[]>([]),
    [selection, setSelection] = useState({ id: "" }),
    [routes, setRoutes] = useState<Partial<Record<ModelPurpose, string>>>({}),
    [messages, setMessages] = useState<ChatMessage[]>([]),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState(false),
    [streamOffline, setStreamOffline] = useState(false),
    [streamRetry, setStreamRetry] = useState(0),
    [changingModel, setChangingModel] = useState(false),
    [lastRepaired, setLastRepaired] = useState("");
  const [tools, setTools] = useState<
      { name: string; state: string; at: string }[]
    >([]),
    [audio, setAudio] = useState(""),
    [mediaBusy, setMediaBusy] = useState(false),
    [voice, setVoice] = useState(() => localStorage.getItem("bff-voice") ?? "");
  const selected = selection.id,
    currentSelection = useRef(selection),
    draftVersion = useRef(0),
    transcribedDrafts = useRef(new Set<string>()),
    mounted = useRef(false),
    pending = useRef(new Map<string, PendingMessage>()),
    sending = useRef<PendingMessage | null>(null),
    drafts = useRef(new Map<string, string>()),
    textRef = useRef(text),
    fileInput = useRef<HTMLInputElement>(null);
  const currentSession = sessions.find(session => session.id === selected);
  const sessionModel = currentSession?.modelId;
  const canChat = models.some(model => model.id === (selected ? sessionModel : routes.chat));
  const chatCandidates = models.filter(model => model.id !== sessionModel
    && acceptsPurpose(model, "chat", routes, sessions.some(session => session.modelId === model.id)));
  const lastReply = messages.filter(message => message.role === "assistant").at(-1);
  const failedModel = lastReply?.status === "failed" && !!lastReply.error && !!modelErrorText(lastReply.error) && lastRepaired !== lastReply.id;
  const recoverModel = !currentSession?.readOnly && (!canChat || failedModel);
  async function useModel(modelId: string) {
    if (selected) {
      const updated = await api<Conversation>(`/v1/conversations/${selected}/model`, "PUT", { modelId });
      setSessions(items => items.map(item => item.id === updated.id ? updated : item));
    } else {
      const routes = await api<Record<string, string>>("/v1/model-routes");
      if (routes.chat !== modelId) await api("/v1/model-routes", "PUT", { ...routes, chat: modelId });
      setRoutes({...routes, chat: modelId});
    }
    setLastRepaired(lastReply?.id ?? "");
  }
  function addChatModel() { configureModel(useModel, !!selected); }
  function updateText(value: string) {
    draftVersion.current++;
    if (!value) transcribedDrafts.current.delete(currentSelection.current.id);
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
    void api<Partial<Record<ModelPurpose, string>>>("/v1/model-routes").then(value => { if (live) setRoutes(value); }).catch(fail);
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
    void loadLocalConversations()
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
      !connected ||
      !canChat
    )
      return;
    let origin = currentSelection.current;
    const version = draftVersion.current;
    const inputOrigin = transcribedDrafts.current.has(origin.id) ? "transcription" : undefined;
    if (pending.current.get(origin.id)?.content !== text || pending.current.get(origin.id)?.inputOrigin !== inputOrigin)
      pending.current.set(origin.id, {
        content: text,
        inputOrigin,
        requestId: crypto.randomUUID(),
      });
    const request = pending.current.get(origin.id)!;
    sending.current = request;
    setBusy(true);

    try {
      if (!origin.id) {
        const session = await createConversation();
        if (!mounted.current) return;
        setSessions((items) => [session, ...items]);
        if (currentSelection.current !== origin) return;
        pending.current.delete("");
        pending.current.set(session.id, request);
        // The unsaved conversation slot now belongs to this persistent session,
        // including edits made while conversation creation was in flight.
        drafts.current.set(session.id, textRef.current);
        drafts.current.delete(origin.id);
        if (transcribedDrafts.current.delete(origin.id)) transcribedDrafts.current.add(session.id);
        origin = { id: session.id };
        currentSelection.current = origin;
        setSelection(origin);
      }
      await sendMessage(origin.id, request);
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
      ) {
        transcribedDrafts.current.add(origin.id);
        updateText(result.text);
      } else if (mounted.current)
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
    <Menu open={active && voiceOpen} onOpenChange={setVoiceOpen} side="top" align="start"
      trigger={<Button variant="ghost" size="compact"><Volume2 size={16} aria-hidden="true" />声音</Button>} className="voice-options">
      <Field>声音名称
        <Input value={voice} placeholder="例如 alloy" onChange={(e) => {
          setVoice(e.target.value);
          localStorage.setItem("bff-voice", e.target.value);
        }} />
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
            variant="ghost"
            size="icon"
            aria-label="历史对话"
            title="历史对话"
            onClick={() => setHistory(true)}
            aria-expanded={history}
          >
            <History size={16} aria-hidden="true" />
          </Button>
          <h1 className="chat-title" title={title}>
            {title}
          </h1>
          {selected && <Button
            type="button"
            className="new-chat-button"
            aria-label="新对话"
            title="新对话"
            disabled={busy}
            onClick={() => selectSession("")}
          >
            <Icon name="plus" />
            <span>新对话</span>
          </Button>}
        </>,
      )}
      {active && history && (
        <Drawer title="历史对话" close={() => setHistory(false)}>
          <div className="session-list">
            {sessions.length ? (
              sessions.map((s) => (
                <Button
                  type="button"
                  className={s.id === selected ? "active" : ""}
                  aria-current={s.id === selected ? "true" : undefined}
                  key={s.id}
                  onClick={() => selectSession(s.id)}
                >
                  <span>{s.title}</span>
                  <small>{new Date(s.createdAt).toLocaleDateString()}</small>
                </Button>
              ))
            ) : (
              <EmptyState title="还没有对话" />
            )}
          </div>
        </Drawer>
      )}
      <div className="chat-layout">
        <div className="conversation">
          <div className="messages" aria-live="polite">
            {!messages.length && (
              <EmptyState className="chat-welcome" icon={<FishAvatar alt="" />}
                title={canChat ? "今天想聊些什么？" : "先为大肥鱼添加一个模型"}>
                {!canChat && !selected && !chatCandidates.length && <Button type="button" variant="primary" onClick={addChatModel}>添加聊天模型</Button>}
              </EmptyState>
            )}
            {messages.map((m) => (
              <Message from={m.role === "user" ? "user" : "assistant"} aria-label={m.role === "user" ? "你的消息" : "大肥鱼的消息"} className={`message ${m.role} flex-row`} key={m.id}>
                <MessageAvatar className="message-avatar">
                  {m.role === "assistant" ? <FishAvatar /> : <span>你</span>}
                </MessageAvatar>
                <MessageContent className="message-content items-start">
                  <strong>{m.role === "user" ? "你" : "大肥鱼"}</strong>
                  <MessageBubble align={m.role === "user" ? "end" : "start"} variant={m.role === "assistant" ? "ghost" : "soft"} className="chat-bubble"><MessageBubbleContent className="max-w-full text-[15px] leading-[1.85]">
                    {m.content ||
                      (["queued", "running"].includes(m.status)
                        ? "正在想…"
                        : "")}
                  </MessageBubbleContent></MessageBubble>
                  {m.error ? <Alert>{errorText(m.error)}</Alert> : statusText[m.status] ? <small>{statusText[m.status]}</small> : null}
                  {m.role === "assistant" &&
                  ["queued", "running"].includes(m.status) ? (
                    <Button
                      type="button"
                      size="compact"
                      onClick={() =>
                        void cancelMessage(m.id).catch(
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

                <ContentScroll label="本次工具活动">
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
                </ContentScroll>
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
            {recoverModel && (!!selected || !!chatCandidates.length) && <div className="chat-model-recovery">
              <p role="status">{!selected ? "选择一个聊天模型即可开始。" : failedModel ? "模型没有完成上次回复。可以重试，也可以更换模型继续这段对话。" : "这段对话的模型不可用。换一个模型继续聊，历史和草稿都会保留。"}</p>
              <ActionRow>
                {!!chatCandidates.length && <Field>可用聊天模型<Select disabled={!connected || busy || changingModel} value="" onValueChange={modelId => {
                  if (!modelId || changingModel) return;
                  setChangingModel(true);
                  void useModel(modelId).catch(fail).finally(() => setChangingModel(false));
                }}>
                  <option value="">{changingModel ? "正在切换…" : "选择并使用模型"}</option>{chatCandidates.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
                </Select></Field>}
                <Button disabled={!connected || busy || changingModel} onClick={addChatModel}>添加聊天模型</Button>
              </ActionRow>
            </div>}
            <PromptInput className="composer" onSubmit={() => send()}
              aria-label="消息" value={text} onValueChange={updateText}
              placeholder="和大肥鱼聊聊…"
              submitDisabled={busy || !connected || !canChat || changingModel} footer={
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
                  disabled={mediaBusy ||  !connected}
                  onClick={() => fileInput.current?.click()}
                >
                  <AudioLines size={16} aria-hidden="true" />{mediaBusy ? "处理中…" : "上传音频"}
                </Button>
                {voiceOptions}
                <Button variant="primary" className="send-button" type="submit"
                  disabled={busy ||  !connected || !canChat || !text.trim()}>
                  <SendHorizontal size={16} aria-hidden="true" />{busy ? "发送中…" : "发送"}
                </Button>
              </div>
            } />
          </div>
        </div>
      </div>
    </section>
  );
}
