import { Card, Disclosure, Alert } from "./Surfaces";
import {
  Field,
  Input,
  Checkbox,
  Button,
  Select,
  Textarea,
  ActionRow,
  FormGrid,
} from "./Controls";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import type {
  ChannelStatus,
  QQConfig,
  Approval,
  Segment,
} from "../../../runtime/src/channels/types";
const initial: QQConfig = {
  url: "ws://127.0.0.1:3001",
  accountId: "",
  ownerId: "",
  groups: [],
  enabled: false,
  replyEnabled: true,
  proactiveEnabled: false,
};
const healthErrors: Record<string, string> = {
  INVALID_TOKEN: "连接凭据格式无效，请修改后保存",
  CONNECTION_INIT_FAILED: "连接初始化失败，请检查配置后保存",
  TOKEN_REJECTED: "连接凭据被拒绝",
  ACCOUNT_MISMATCH: "实际登录账号与配置不一致",
  LOGIN_REQUIRED: "请在 NapCat 登录",
  HEALTH_CHECK_FAILED: "无法确认账号在线状态",
  CONNECTION_LOST: "连接已断开",
};
const labels: Record<string, string> = {
  stopped: "已停用",
  connecting: "连接中",
  reconnecting: "正在重连",
  online: "已登录并在线",
  not_logged_in: "未登录，请在 NapCat 完成扫码",
  error: "连接错误",
  pending: "待审批",
  sent: "协议已确认发送",
  unknown: "发送结果未知，请勿重复发送",
  failed: "发送失败",
  expired: "已过期",
  rejected: "已拒绝",
  revoked: "授权已撤销",
  executing: "正在发送",
  queued: "等待处理",
  generating: "正在回复",
  blocked: "已阻止",
  interrupted: "已中断",
};
export function Channels({ fail }: { fail: (e: unknown) => void }) {
  const [status, setStatus] = useState<ChannelStatus>(),
    [form, setForm] = useState(initial),
    [token, setToken] = useState(""),
    [groups, setGroups] = useState(""),
    [revision, setRevision] = useState(""),
    [busy, setBusy] = useState(false),
    [deliveries, setDeliveries] = useState<
      { id: string; status: string; error: string | null }[]
    >([]);
  const acting = useRef(false);
  const refresh = useCallback(async () => {
    const s = await api<ChannelStatus>("/v1/channels/qq");
    setStatus(s);
    setDeliveries(await api("/v1/channels/qq/deliveries"));
    return s;
  }, []);
  const reset = (s: ChannelStatus) => {
    setForm(s.config ?? initial);
    setGroups(s.config?.groups.join(",") ?? "");
    setRevision(s.revision);
    setToken("");
  };
  useEffect(() => {
    void refresh().then(reset).catch(fail);
    const t = setInterval(() => void refresh().catch(fail), 3000);
    return () => clearInterval(t);
  }, [refresh, fail]);
  const act = async (run: () => Promise<ChannelStatus>) => {
    if (acting.current) return;
    acting.current = true;
    setBusy(true);
    try {
      const s = await run();
      setStatus(s);
      reset(s);
    } catch (e) {
      fail(e);
    } finally {
      acting.current = false;
      setBusy(false);
    }
  };
  return (
    <section>
      <h2>QQ</h2>
      <p>
        {labels[status?.health.state ?? "stopped"]}
      </p>
      {status?.health.error && <Alert>{healthErrors[status.health.error] ?? status.health.error}</Alert>}
      <p>
        先独立运行 NapCat，使用专用 QQ 小号扫码登录，开启正向
        WebSocket。非官方接入可能受平台限制。
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void act(() =>
            api("/v1/channels/qq", "PUT", {
              ...form,
              revision,
              groups: groups
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              ...(token ? { token } : {}),
            }),
          );
        }}
      >
        <fieldset disabled={busy}>
          <FormGrid>
            <Field>
              WebSocket 地址
              <Input
                required
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
            </Field>
            <Field>
              连接凭据
              <Input
                type="password"
                autoComplete="off"
                value={token}
                placeholder={status?.hasToken ? "已保存，留空保持不变" : "可选"}
                onChange={(e) => setToken(e.target.value)}
              />
            </Field>
          </FormGrid>
          <FormGrid>
            <Field>
              机器人 QQ 号
              <Input
                required
                value={form.accountId}
                onChange={(e) =>
                  setForm({ ...form, accountId: e.target.value })
                }
              />
            </Field>
            <Field>
              主人 QQ 号
              <Input
                required
                value={form.ownerId}
                onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
              />
            </Field>
          </FormGrid>
          <Field>
            允许的群号（逗号分隔，仅回应 @ 机器人）
            <Input value={groups} onChange={(e) => setGroups(e.target.value)} />
          </Field>
          <Field className="check">
            <Checkbox

              checked={form.enabled}
              onCheckedChange={(value) => setForm({ ...form, enabled: value })}
            />
            启用连接
          </Field>
          <Field className="check">
            <Checkbox

              checked={form.replyEnabled}
              onCheckedChange={(value) =>
                setForm({ ...form, replyEnabled: value })
              }
            />
            允许自动回复主人私聊及已授权群
          </Field>
          <Field className="check">
            <Checkbox

              checked={form.proactiveEnabled}
              onCheckedChange={(value) =>
                setForm({ ...form, proactiveEnabled: value })
              }
            />
            允许创建主动消息审批
          </Field>
          <Button type="submit" variant="primary">
            保存
          </Button>
        </fieldset>
      </form>
      <Button
        type="button"
        disabled={busy || !status?.config}
        onClick={() => void act(() => api("/v1/channels/qq/stop", "POST"))}
      >
        停用并撤销待审批消息
      </Button>
      <p>
        群聊默认不能读取主人私密记忆。已授权图片由聊天模型理解，语音由语音输入模型转写；无法取得媒体内容时会明确提示。自动回复为文本并引用原消息。
      </p>
      <h3>最近消息</h3>
      {deliveries.map((d) => (
        <div key={d.id}>
          <p>{d.id} · {labels[d.status] ?? d.status}</p>
          {d.error && <Alert>{d.error}</Alert>}
        </div>
      ))}
    </section>
  );
}
export function Permissions({
  fail,
  approvalsOnly = false,
}: {
  fail: (e: unknown) => void;
  approvalsOnly?: boolean;
}) {
  const [items, setItems] = useState<Approval[]>([]),
    [audit, setAudit] = useState<{ event: string; at: string }[]>([]),
    [kind, setKind] = useState("private"),
    [target, setTarget] = useState(""),
    [text, setText] = useState(""),
    [media, setMedia] = useState<Segment>(),
    [mediaName, setMediaName] = useState(""),
    [busy, setBusy] = useState(false);
  const acting = useRef(false);
  const selectMedia = async (file: File | undefined) => {
    setMedia(undefined);
    setMediaName("");
    if (!file) return;
    if (file.size > 2_000_000) throw new Error("MEDIA_TOO_LARGE");
    const type = file.type.startsWith("image/")
      ? "image"
      : file.type === "audio/wav" || file.name.toLowerCase().endsWith(".wav")
        ? "record"
        : /\.(txt|pdf)$/i.test(file.name)
          ? "file"
          : undefined;
    if (!type) throw new Error("UNSUPPORTED_MEDIA_FORMAT");
    const data = new Uint8Array(await file.arrayBuffer());
    let value = "";
    for (const byte of data) value += String.fromCharCode(byte);
    setMedia({
      type,
      data: {
        file: "base64://" + btoa(value),
        ...(type === "file" ? { name: file.name } : {}),
      },
    });
    setMediaName(file.name);
    if (type === "file") setText("");
  };
  const refresh = useCallback(async () => {
    setItems(await api("/v1/permissions/approvals"));
    setAudit(await api("/v1/permissions/audit"));
  }, []);
  useEffect(() => {
    void refresh().catch(fail);
    const t = setInterval(() => void refresh().catch(fail), 3000);
    return () => clearInterval(t);
  }, [refresh, fail]);
  const act = async (run: () => Promise<unknown>) => {
    if (acting.current) return;
    acting.current = true;
    setBusy(true);
    try {
      await run();
      await refresh();
    } catch (e) {
      fail(e);
    } finally {
      acting.current = false;
      setBusy(false);
    }
  };
  return (
    <section>
      <h2>QQ 消息</h2>
      <p>主动消息必须逐条批准，有效期 5 分钟。仅可发给主人或已授权群。</p>
      {!approvalsOnly && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(() =>
              api("/v1/permissions/approvals", "POST", {
                target: { kind, id: target },
                segments: [
                  ...(text ? [{ type: "text", data: { text } }] : []),
                  ...(media ? [media] : []),
                ],
              }),
            );
          }}
        >
          <fieldset disabled={busy}>
            <Field>
              对象
              <Select value={kind} onValueChange={(value) => setKind(value)}>
                <option value="private">主人私聊</option>
                <option value="group">已授权群</option>
              </Select>
            </Field>
            <Field>
              QQ 号或群号
              <Input
                required
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </Field>
            <Field>
              消息内容
              <Textarea
                disabled={media?.type === "file"}
                required={!media}
                maxLength={4000}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </Field>
            <Field>
              图片、语音或文件（PNG、JPEG、WAV、TXT、PDF，最多 2 MB）
              <Input
                type="file"
                accept="image/png,image/jpeg,audio/wav,.wav,.txt,.pdf"
                onChange={(e) =>
                  void selectMedia(e.target.files?.[0]).catch(fail)
                }
              />
            </Field>
            {mediaName && <p>{mediaName}</p>}
            <Button type="submit" variant="primary" disabled={!text && !media}>
              创建审批
            </Button>
          </fieldset>
        </form>
      )}
      {!items.length && <p className="muted">暂无审批记录</p>}
      {items.map((item) => (
        <Card key={item.id}>
          <h3>
            {item.payload.target.kind === "group" ? "群" : "私聊"}{" "}
            {item.payload.target.id}
          </h3>
          <p className="prewrap">
            {item.payload.segments
              .map((s) =>
                s.type === "text"
                  ? s.data.text
                  : `[${s.type === "image" ? "图片" : s.type === "record" ? "语音" : s.type === "file" ? `文件 ${s.data.name}` : "引用"}]`,
              )
              .join("\n")}
          </p>
          {item.payload.segments.map((s, i) =>
            s.type === "image" ? (
              <img
                key={i}
                className="media-preview"
                alt="待发送图片"
                src={`data:image/${s.data.file?.startsWith("base64:///9j/") ? "jpeg" : "png"};base64,${s.data.file?.slice(9)}`}
              />
            ) : s.type === "record" ? (
              <audio
                key={i}
                controls
                src={`data:audio/wav;base64,${s.data.file?.slice(9)}`}
              />
            ) : null,
          )}
          <p>
            {labels[item.status] ?? item.status} · 有效至{" "}
            {new Date(item.expiresAt).toLocaleString()}
          </p>
          {item.status === "pending" && (
            <ActionRow>
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  void act(() =>
                    api("/v1/permissions/approvals/" + item.id, "POST", {
                      digest: item.digest,
                      decision: "approve",
                    }),
                  )
                }
              >
                批准发送
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  void act(() =>
                    api("/v1/permissions/approvals/" + item.id, "POST", {
                      digest: item.digest,
                      decision: "reject",
                    }),
                  )
                }
              >
                拒绝
              </Button>
            </ActionRow>
          )}
        </Card>
      ))}
      <Disclosure  title={<>操作记录</>}>

        {audit.map((a, i) => (
          <p key={i}>
            {a.at} · {a.event}
          </p>
        ))}
      </Disclosure>
    </section>
  );
}
