import { Alert, Card, Disclosure } from "../../components/Surfaces";
import { Field, Input, Checkbox, Button, ActionRow } from "../../components/Controls";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Drawer } from "../../components/UI";
import { api } from "../../api/client";
interface Settings {
  dataDir: string;
  background: boolean;
  autostart: boolean;
  complete: boolean;
}
export function Setup({
  done,
  fail,
}: {
  done: () => void;
  fail: (e: unknown) => void;
}) {
  const [s, setS] = useState<Settings>(),
    [busy, setBusy] = useState(false),
    [name, setName] = useState("大肥鱼");
  useEffect(() => {
    void invoke<Settings>("desktop_settings").then(setS).catch(fail);
  }, [fail]);
  async function save() {
    if (!s) return;
    setBusy(true);
    try {
      await invoke("desktop_configure", { ...s, complete: true });
      const p = await api<Record<string, unknown>>("/v1/persona");
      if (!s.complete)
        await api("/v1/persona", "PUT", {
          ...p,
          name: name.trim() || "大肥鱼",
        });
      done();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page-section">
      <h2>{s?.complete ? "运行设置" : "欢迎养一条自己的鱼"}</h2>
      {s && (
        <div className="settings">
          {!s.complete && <Field>
            数据目录
            <Input
              disabled={s.complete}
              value={s.dataDir}
              onChange={(e) => setS({ ...s, dataDir: e.target.value })}
            />
          </Field>}
          {!s.complete && (
            <Field>
              鱼的名字
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          )}
          <Field>
            <Checkbox

              checked={s.background}
              onCheckedChange={(value) => setS({ ...s, background: value })}
            />
            关闭窗口后继续在后台运行
          </Field>
          <Field>
            <Checkbox

              checked={s.autostart}
              onCheckedChange={(value) => setS({ ...s, autostart: value })}
            />
            登录电脑时启动
          </Field>
          <Button
            type="button"
            variant="primary"
            disabled={busy}
            onClick={() => void save()}
          >
            {s.complete ? "保存设置" : "开始设置模型"}
          </Button>
          {s.complete && <div className="readonly-setting"><span>数据保存位置</span><span>{s.dataDir}</span></div>}
        </div>
      )}
    </section>
  );
}
const scopeNames: Record<string, string> = {
  persona: "人格",
  models: "模型设置",
  sessions: "聊天记录",
  memories: "记忆",
  life: "生活记录与计划",
  plugins: "平台配置",
};
function ConfirmAction({
  message,
  confirm,
  cancel,
}: {
  message: string;
  confirm: () => void;
  cancel: () => void;
}) {
  return (
    <div role="alertdialog" aria-label="确认操作">
      <Alert variant="warning">{message}</Alert>
      <ActionRow>
        <Button type="button" onClick={confirm}>
          确认继续
        </Button>
        <Button type="button" onClick={cancel}>
          取消
        </Button>
      </ActionRow>
    </div>
  );
}
export function Backup({ fail }: { fail: (e: unknown) => void }) {
  const [mode, setMode] = useState<"export" | "restore">("export");
  const [file, setFile] = useState(""),
    [password, setPassword] = useState(""),
    [credentials, setCredentials] = useState(false),
    [scopes, setScopes] = useState(Object.keys(scopeNames)),
    [confirm, setConfirm] = useState(false),
    [result, setResult] = useState(""),
    [busy, setBusy] = useState(false);
  async function run(action: string) {
    setBusy(true);
    try {
      const value = await invoke<{
        scopes?: string[];
        credentials?: boolean;
        encrypted?: boolean;
        rollback?: string;
        conversations?: number;
      }>("desktop_maintenance", {
        action,
        input: { file, password: password || undefined, credentials, scopes },
      });
      const selected = (value.scopes ?? scopes)
        .map((s) => scopeNames[s] ?? s)
        .join("、");
      setResult(
        action === "restore"
          ? `恢复完成。自动活动已暂停，平台需要重新启用。旧数据保留于：${value.rollback}`
          : action === "inspect"
            ? `备份有效：${selected}。包含 ${value.conversations ?? 0} 个会话；${value.credentials ? "包含凭据" : "不含凭据"}。文件：${file}`
            : `已导出${value.encrypted ? "加密" : ""}备份：${file}。内容：${selected}；${credentials ? "包含凭据" : "不含凭据"}。`,
      );
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  return <section className="page-section">
    <h2>备份与恢复</h2>
    <div className="memory-layer-switch" role="group" aria-label="备份操作">
      <Button aria-pressed={mode === "export"} disabled={busy} onClick={() => { setMode("export"); setConfirm(false); setResult(""); }}>备份数据</Button>
      <Button aria-pressed={mode === "restore"} disabled={busy} onClick={() => { setMode("restore"); setConfirm(false); setResult(""); }}>恢复数据</Button>
    </div>
    <Card>
      <h3>{mode === "export" ? "创建备份" : "从备份恢复"}</h3>
      <p className="muted">{mode === "export" ? "备份时会暂时停止服务。" : "恢复会替换当前数据，旧数据会保留用于回退。"}</p>
      <Field>{mode === "export" ? "保存到" : "备份文件"}<Input value={file} disabled={busy} placeholder="填写备份文件的完整路径" onChange={e => setFile(e.target.value)} /></Field>
      {mode === "export" && <Disclosure title="选择备份内容">
        <fieldset className="checkbox-grid"><legend>备份内容</legend>
          {Object.entries(scopeNames).map(([id, label]) => <Field key={id}><Checkbox checked={scopes.includes(id)} disabled={busy} onCheckedChange={value => setScopes(value ? [...scopes, id] : scopes.filter(scope => scope !== id))} />{label}</Field>)}
        </fieldset>
      </Disclosure>}
      <Field>{mode === "export" ? "加密密码（可选，至少 12 个字符）" : "备份密码（如有）"}<Input type="password" value={password} disabled={busy} onChange={e => setPassword(e.target.value)} /></Field>
      {mode === "export" && <Field><Checkbox checked={credentials} disabled={busy} onCheckedChange={setCredentials} />包含账号密钥（需要加密密码）</Field>}
      <ActionRow>
        {mode === "export" ? <Button variant="primary" disabled={busy || !file.trim() || !scopes.length || (credentials && password.length < 12) || (!!password && password.length < 12)} onClick={() => void run("export")}>创建备份</Button> : <>
          <Button disabled={busy || !file.trim()} onClick={() => void run("inspect")}>检查备份</Button>
          <Button variant="primary" disabled={busy || !file.trim()} onClick={() => setConfirm(true)}>恢复数据</Button>
        </>}
      </ActionRow>
      {confirm && <ConfirmAction message="恢复将停止服务并替换当前数据。自动活动会暂停，平台需要重新连接。旧数据会保留。" cancel={() => setConfirm(false)} confirm={() => { setConfirm(false); void run("restore"); }} />}
      {result && <p role="status">{result}</p>}
    </Card>
  </section>;
}

export function Updates({ fail }: { fail: (e: unknown) => void }) {
  const [version, setVersion] = useState("");
  const [panel, setPanel] = useState<"source" | "offline">();
  useEffect(() => {
    void invoke<{ version: string }>("desktop_settings")
      .then((s) => setVersion(s.version))
      .catch(fail);
  }, [fail]);
  const [manifest, setManifest] = useState(""),
    [archive, setArchive] = useState(""),
    [endpoint, setEndpoint] = useState(""),
    [key, setKey] = useState(""),
    [state, setState] = useState(""),
    [confirm, setConfirm] = useState<"online" | "offline">(),
    [busy, setBusy] = useState(false);
  async function run(install = false) {
    setBusy(true);
    try {
      const r = await invoke<{ state: string; version?: string }>(
        "desktop_update",
        { install },
      );
      setState(
        (
          {
            unconfigured: "尚未配置可信更新源",
            available: `可更新到 ${r.version}`,
            installed: "已安装，请重新启动应用",
            "no-release": "没有可用更新",
          } as Record<string, string>
        )[r.state] ?? r.state,
      );
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function offline(install: boolean) {
    setBusy(true);
    try {
      await invoke("desktop_update_file", { manifest, archive, install });
      setState(install ? "已安装，请重启应用" : "签名及版本已验证");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  const confirmation = confirm && <ConfirmAction
    message="安装将验证签名、停止服务并保留当前程序和数据，完成后需要重启应用。"
    cancel={() => setConfirm(undefined)} confirm={() => { const action = confirm; setConfirm(undefined); if (action === "online") void run(true); else void offline(true); }} />;
  return <section className="page-section">
    <h3>软件更新</h3>
    <p className="muted">当前版本 {version}</p>
    <ActionRow>
      <Button disabled={busy} onClick={() => void run()}>检查更新</Button>
      {state.startsWith("可更新到") && <Button variant="primary" disabled={busy} onClick={() => setConfirm("online")}>安装更新</Button>}
      <Button variant="ghost" disabled={busy} onClick={() => { setPanel("source"); setConfirm(undefined); }}>更新源</Button>
      <Button variant="ghost" disabled={busy} onClick={() => { setPanel("offline"); setConfirm(undefined); }}>离线更新</Button>
    </ActionRow>
    {state && <p role="status">{state}</p>}
    {!panel && confirmation}
    {state.startsWith("已安装") && <Button onClick={() => void invoke("desktop_restart").catch(fail)}>重启应用</Button>}
    {panel === "source" && <Drawer title="更新源" close={() => { if (!busy) setPanel(undefined); }}>
      <form onSubmit={event => { event.preventDefault(); setBusy(true); void invoke("desktop_update_trust", { endpoint, publicKey: key }).then(() => { setState("已保存更新源"); setPanel(undefined); }).catch(fail).finally(() => setBusy(false)); }}>
        <p className="muted">填写发行者提供的 HTTPS 地址与更新公钥。</p>
        <Field>更新地址<Input value={endpoint} required type="url" disabled={busy} onChange={e => setEndpoint(e.target.value)} /></Field>
        <Field>更新公钥<Input value={key} required disabled={busy} onChange={e => setKey(e.target.value)} /></Field>
        <Button variant="primary" type="submit" disabled={busy}>保存更新源</Button>
      </form>
    </Drawer>}
    {panel === "offline" && <Drawer title="离线更新" close={() => { if (!busy) { setPanel(undefined); setConfirm(undefined); } }}>
      <div className="settings">
        <Field>更新清单路径<Input value={manifest} disabled={busy} onChange={e => setManifest(e.target.value)} /></Field>
        <Field>更新包路径<Input value={archive} disabled={busy} onChange={e => setArchive(e.target.value)} /></Field>
        <ActionRow><Button disabled={busy || !manifest.trim() || !archive.trim()} onClick={() => void offline(false)}>验证更新包</Button><Button variant="primary" disabled={busy || !manifest.trim() || !archive.trim()} onClick={() => setConfirm("offline")}>安装更新</Button></ActionRow>
        {state && <p role="status">{state}</p>}
        {confirmation}
      </div>
    </Drawer>}
  </section>;
}
