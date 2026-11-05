import {
  Button,
  Field,
  Input,
  Checkbox,
  ActionRow,
} from "../../desktop/src/components/Controls";
import { useState } from "react";
import { webRequest } from "../../desktop/src/api";
export function WebSettings({ fail }: { fail: (e: unknown) => void }) {
  const [password, setPassword] = useState(""),
    [credentials, setCredentials] = useState(false),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState("");
  return (
    <section className="page-section">
      <h2>管理设置</h2>
      <h3>更新与备份</h3>
      <ActionRow>
        <Button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void webRequest("/update/check", "POST")
              .then((r) => setResult(JSON.stringify(r)))
              .catch(fail)
              .finally(() => setBusy(false));
          }}
        >
          检查已配置的更新源
        </Button>
        <Button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!confirm("安装已验证签名的更新并重启服务？")) return;
            setBusy(true);
            setResult("正在更新…");
            void webRequest("/update/install", "POST")
              .then(() => setResult("更新已完成，请在主机重启 Web 管理服务。"))
              .catch(fail)
              .finally(() => setBusy(false));
          }}
        >
          安装更新
        </Button>
      </ActionRow>
      <p>
        维护会暂停鱼的活动，完成后重新连接。恢复将替换当前鱼的数据，原数据保留在服务器回退目录。
      </p>
      <div className="settings">
        <Field>
          加密口令
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
          包含账号凭据
        </Field>
        <Button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setResult("正在备份…");
            void webRequest<{ data: string }>("/maintenance/export", "POST", {
              password: password || undefined,
              credentials,
            })
              .then((r) => {
                const a = document.createElement("a"),
                  bytes = Uint8Array.from(atob(r.data), (c) => c.charCodeAt(0)),
                  url = URL.createObjectURL(new Blob([bytes]));
                a.href = url;
                a.download = "bigfatfish.bff";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                setResult("备份已完成，服务已重启。");
              })
              .catch((e) => {
                setResult("备份失败");
                fail(e);
              })
              .finally(() => setBusy(false));
          }}
        >
          下载备份
        </Button>
        <Field>
          恢复备份
          <Input
            type="file"
            accept=".bff"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (!confirm("恢复将替换当前数据，是否继续？")) return;
              if (f.size > 128 * 1024 * 1024) {
                fail("ARCHIVE_TOO_LARGE");
                return;
              }
              setBusy(true);
              setResult("正在恢复…");
              const reader = new FileReader();
              reader.onload = () => {
                void webRequest("/maintenance/restore", "POST", {
                  data: String(reader.result).split(",")[1],
                  password: password || undefined,
                })
                  .then(() => setResult("恢复已完成，渠道和插件需重新授权。"))
                  .catch((e) => {
                    setResult("恢复失败");
                    fail(e);
                  })
                  .finally(() => setBusy(false));
              };
              reader.readAsDataURL(f);
            }}
          />
        </Field>
        <p role="status">{result}</p>
      </div>
    </section>
  );
}
