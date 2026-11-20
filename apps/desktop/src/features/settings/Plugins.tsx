import { PageStack, SectionHeading, SectionCard, EmptyState } from "../../components/PageLayout";
import { Card, Disclosure, Badge, Loading, Alert } from "../../components/Surfaces";
import { Field, Input, Button, Textarea, ActionRow } from "../../components/Controls";
import { useEffect, useState } from "react";
import { Drawer } from "../../components/UI";
import { errorText } from "../../api/errors";
import { api } from "../../api/client";
import type { Manifest } from "../../../../runtime/src/plugins/package";
type Item = {
  id: string;
  manifest: Manifest;
  enabled: boolean;
  installed: boolean;
  health: string;
  config: Record<string, unknown>;
};
// Also keep older Runtime responses out of the extension manager during an upgrade.
const isPlatform = (id: string) => ["qq", "bilibili", "douyin"].includes(id);

export function Plugins({ fail }: { fail: (e: unknown) => void }) {
  const [detail, setDetail] = useState<string>();
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [readError, setReadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]),
    [bundle, setBundle] = useState<unknown>(),
    [manifest, setManifest] = useState<Manifest>(),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState(""),
    [args, setArgs] = useState('{"name":"主人"}');
  const reload = () => api<Item[]>("/v1/plugins").then(list => { setItems(list.filter(item => !isPlatform(item.id))); setReadError(""); });
  useEffect(() => {
    void reload().catch(error => setReadError(errorText(error))).finally(() => setLoading(false));
  }, []);
  const run = (fn: () => Promise<unknown>) => {
    setBusy(true);
    void Promise.resolve()
      .then(fn)
      .then(() => reload())
      .catch((e) => fail(e instanceof SyntaxError ? "PLUGIN_JSON_INVALID" : e))
      .finally(() => setBusy(false));
  };
  return (
    <PageStack className="settings-extensions">
      <SectionHeading title="扩展" />
      <div className="extension-import">
      <Field>
        选择插件文件
        <Input
          type="file"
          accept=".bff-plugin"
          onChange={(e) => {
            const file = e.target.files?.[0];
            setManifest(undefined);
            setBundle(undefined);
            if (!file) return;
            if (file.size > 24000000) {
              fail("PLUGIN_ARCHIVE_INVALID");
              return;
            }
            void file
              .text()
              .then(JSON.parse)
              .then(async (b) => {
                const m = await api<Manifest>("/v1/plugins/inspect", "POST", b);
                if (isPlatform(m.id)) throw new Error("PLATFORM_BUILTIN");
                setBundle(b);
                setManifest(m);
              })
              .catch(fail);
          }}
        />
      </Field>
      <p className="muted">仅安装你信任的插件。</p>
      </div>
      {manifest && (
        <SectionCard title={manifest.name} level={3} description={manifest.version}>
          <p>
            {manifest.source} · {manifest.author} · {manifest.license}
          </p>
          <p>申请权限：{manifest.permissions.join("、")}</p>
          <Button
            type="button"
            disabled={busy}
            onClick={() =>
              run(() =>
                api(
                  "/v1/plugins/" +
                    (items.some((i) => i.id === manifest.id && i.installed)
                      ? "update"
                      : "install"),
                  "POST",
                  bundle,
                ),
              )
            }
          >
            安装或更新
          </Button>
        </SectionCard>
      )}
      {loading && <Loading>正在读取扩展…</Loading>}
      {readError && <ActionRow><Alert role="alert">{readError}</Alert><Button onClick={() => { setLoading(true); setReadError(""); void reload().catch(error => setReadError(errorText(error))).finally(() => setLoading(false)); }}>重新读取扩展</Button></ActionRow>}
      {!loading && !readError && !items.length && !manifest && <EmptyState title="暂无第三方扩展" />}
      {items.map((item) => (
        <Card key={item.id}>
          <SectionHeading className="plugin-heading" level={3} title={item.manifest.name} actions={<Badge status={['crashed', 'failed'].includes(item.health) ? 'danger' : item.enabled ? 'success' : 'neutral'}>{['crashed', 'failed'].includes(item.health) ? '运行异常' : item.installed ? item.enabled ? '已启用' : '已停用' : '未安装'}</Badge>} />
          <ActionRow>
            <Button
              type="button"
              disabled={busy || !item.installed}
              onClick={() =>
                run(() =>
                  api(
                    `/v1/plugins/${item.id}/${item.enabled ? "disable" : "enable"}`,
                    "POST",
                    item.enabled
                      ? {}
                      : {
                          granted: item.manifest.permissions,
                          config: JSON.parse(
                            configs[item.id] ?? JSON.stringify(item.config),
                          ),
                        },
                  ),
                )
              }
            >
              {item.enabled ? "停用并撤销执行" : "信任并授权启用"}
            </Button>
            <Button
              type="button"
              disabled={busy || !item.installed}
              onClick={() => run(() => api(`/v1/plugins/${item.id}`, "DELETE"))}
            >
              卸载并保留数据
            </Button>
            <Button variant="ghost" onClick={() => setDetail(item.id)}>插件信息</Button>
          </ActionRow>
          {detail === item.id && <Drawer title={item.manifest.name} close={() => setDetail(undefined)}>
            <div className="page-section">
              <dl className="detail-list"><div><dt>版本</dt><dd>{item.manifest.version}</dd></div><div><dt>来源</dt><dd>{item.manifest.source}</dd></div><div><dt>许可</dt><dd>{item.manifest.license}</dd></div><div><dt>权限</dt><dd>{item.manifest.permissions.join("、")}</dd></div></dl>
              <Disclosure title="高级配置"><Field>配置（不接受密钥）<Textarea value={configs[item.id] ?? JSON.stringify(item.config)} onChange={e => setConfigs({ ...configs, [item.id]: e.target.value })} /></Field></Disclosure>
          {item.enabled && item.manifest.tools.length > 0 && (
            <Disclosure  title={<>工具调试</>}>

              <Field>
                工具参数
                <Input value={args} onChange={(e) => setArgs(e.target.value)} />
              </Field>
              <ActionRow className="actions">
                {item.manifest.tools.map((tool) => (
                  <Button
                    type="button"
                    key={tool.name}
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const v = await api(
                          `/v1/plugins/${item.id}/call`,
                          "POST",
                          { name: tool.name, args: JSON.parse(args) },
                        );
                        setResult(JSON.stringify(v));
                      })
                    }
                  >
                    {tool.description}
                  </Button>
                ))}
              </ActionRow>
            </Disclosure>
          )}
            </div>
          </Drawer>}
        </Card>
      ))}
      {result && <output>{result}</output>}
    </PageStack>
  );
}
