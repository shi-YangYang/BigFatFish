import { Alert } from "./Surfaces";
import { Field, Input, Checkbox, Button, ActionRow } from "./Controls";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { api } from "../api";
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
    <section>
      <h2>{s?.complete ? "运行设置" : "欢迎养一条自己的鱼"}</h2>
      {s && (
        <div className="settings">
          <Field>
            数据目录
            <Input
              disabled={s.complete}
              value={s.dataDir}
              onChange={(e) => setS({ ...s, dataDir: e.target.value })}
            />
          </Field>
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
        </div>
      )}
    </section>
  );
}
const scopeNames: Record<string, string> = {
  persona: "人格",
  models: "模型与默认路由",
  sessions: "会话",
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
  return (
    <section>
      <h2>备份与迁移</h2>
      <p>
        导出和恢复会停止服务。恢复后自动活动暂停，平台需要重新启用。旧数据保留在回滚目录。
      </p>
      <div className="settings">
        <Field>
          备份文件的完整路径
          <Input value={file} onChange={(e) => setFile(e.target.value)} />
        </Field>
        <fieldset className="checkbox-grid">
          <legend>导出内容</legend>
          {Object.entries(scopeNames).map(([id, label]) => (
            <Field key={id}>
              <Checkbox

                checked={scopes.includes(id)}
                onCheckedChange={(value) =>
                  setScopes(
                    value
                      ? [...scopes, id]
                      : scopes.filter((s) => s !== id),
                  )
                }
              />
              {label}
            </Field>
          ))}
        </fieldset>
        <Field>
          加密口令（至少12个字符）
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field>
          <Checkbox

            checked={credentials}
            onCheckedChange={(value) => setCredentials(value)}
          />
          包含模型密钥及平台凭据（必须加密）
        </Field>
        <ActionRow>
          <Button
            type="button"
            disabled={busy}
            onClick={() => void run("export")}
          >
            导出备份
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => void run("inspect")}
          >
            检查备份
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => setConfirm(true)}
          >
            恢复备份
          </Button>
        </ActionRow>
        {confirm && (
          <ConfirmAction
            message="恢复将停止服务并替换当前鱼的数据，自动活动暂停。当前数据保留用于回退。"
            cancel={() => setConfirm(false)}
            confirm={() => {
              setConfirm(false);
              void run("restore");
            }}
          />
        )}
        <p role="status">{result}</p>
      </div>
    </section>
  );
}
export function Updates({ fail }: { fail: (e: unknown) => void }) {
  const [version, setVersion] = useState("");
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
  return (
    <section>
      <h2>软件更新</h2>
      <p>当前版本 {version}</p>
      <p>使用发行者提供的 HTTPS 地址与更新公钥。当前未配置官方发行源。</p>
      <div className="settings">
        <Field>
          更新地址
          <Input
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
          />
        </Field>
        <Field>
          更新公钥
          <Input value={key} onChange={(e) => setKey(e.target.value)} />
        </Field>
        <ActionRow>
          <Button
            type="button"
            onClick={() =>
              void invoke("desktop_update_trust", { endpoint, publicKey: key })
                .then(() => setState("已保存更新信任"))
                .catch(fail)
            }
          >
            保存更新源
          </Button>
          <Button type="button" disabled={busy} onClick={() => void run()}>
            检查更新
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => setConfirm("online")}
          >
            安装更新
          </Button>
        </ActionRow>
        <p role="status">{state}</p>
        <Field>
          离线更新清单路径
          <Input
            value={manifest}
            onChange={(e) => setManifest(e.target.value)}
          />
        </Field>
        <Field>
          离线更新包路径
          <Input value={archive} onChange={(e) => setArchive(e.target.value)} />
        </Field>
        <ActionRow>
          <Button
            type="button"
            disabled={busy}
            onClick={() => void offline(false)}
          >
            验证离线更新
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => setConfirm("offline")}
          >
            安装离线更新
          </Button>
        </ActionRow>
        {confirm && (
          <ConfirmAction
            message="安装将先验证签名、停止服务并保留当前程序和数据。完成后需要重启应用。"
            cancel={() => setConfirm(undefined)}
            confirm={() => {
              const action = confirm;
              setConfirm(undefined);
              if (action === "online") void run(true);
              else void offline(true);
            }}
          />
        )}
        <Button
          type="button"
          disabled={busy}
          onClick={() => void invoke("desktop_restart")}
        >
          重启应用
        </Button>
      </div>
    </section>
  );
}
