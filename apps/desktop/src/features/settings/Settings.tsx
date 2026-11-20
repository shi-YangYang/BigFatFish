import { PageStack, SectionHeading, EmptyState } from "../../components/PageLayout";
import "./settings.css";
import { useCallback, useEffect, useState } from "react";
import { ContentScroll, Disclosure, Loading, Alert } from "../../components/Surfaces";
import { Button } from "../../components/Controls";
import { FishAvatar, Tabs } from "../../components/UI";
import { errorText } from "../../api/errors";
import { api } from "../../api/client";
import { Models } from "./Models";
import { Plugins } from "./Plugins";
import { Media } from "./Media";
import { Setup, Backup, Updates } from "./Setup";
import assetNotice from "../../assets/fish-girl.NOTICE.txt?raw";
import type { ModelConfig } from "../../../../runtime/src/ai/types";

type Fail = { fail: (e: unknown) => void };

export function Settings({
  models,
  reload,
  fail,
  done,
  tab,
  setTab, openSoundModel,
}: Fail & {
  models: (ModelConfig & { hasKey: boolean })[];
  reload: () => Promise<void>;
  done: () => void;
  tab: string;
  setTab: (s: string) => void;
  openSoundModel: (purpose: "asr" | "tts") => void;
}) {
  const [tool, setTool] = useState<"扩展" | "版本与更新" | "运行诊断" | null>(null);
  return <Tabs items={["模型与声音", "通用", "数据与维护"]} value={tab} onChange={next => { setTool(null); setTab(next); }} label="设置分类">
    {tab === "模型与声音" ? <PageStack>
      <Models models={models} reload={reload} fail={fail} />
      <Disclosure title="语音输入与朗读"><Media fail={fail} configureModel={openSoundModel} modelRevision={models} /></Disclosure>
    </PageStack> : tab === "通用" ? (
      <Setup fail={fail} done={done} />
    ) : <PageStack>
      {tool ? <>
        <div><Button variant="ghost" onClick={() => setTool(null)}>← 数据与维护</Button></div>
        {tool === "扩展" ? <Plugins fail={fail} /> : tool === "运行诊断" ? <Logs /> : <PageStack className="settings-about">
          <div className="settings-brand"><FishAvatar alt="" /><SectionHeading title="BigFatFish" /></div>
          <Updates fail={fail} />
          <Disclosure title="图像来源与许可"><pre className="asset-notice">{assetNotice}</pre></Disclosure>
        </PageStack>}
      </> : <>
        <Backup fail={fail} />
        <section className="maintenance-tools" aria-label="其他维护工具"><h3>其他工具</h3>
          <div className="maintenance-links">{(["扩展","版本与更新","运行诊断"] as const).map(item => <Button key={item} onClick={() => setTool(item)}>{item}</Button>)}</div>
        </section>
      </>}
    </PageStack>}
  </Tabs>;
}
function Logs() {
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const reload = useCallback(
    () => {
      setLoading(true);
      return api<{ lines: string[] }>("/v1/logs")
        .then((r) => { setLines(r.lines); setReadError(""); })
        .catch(error => setReadError(errorText(error))).finally(() => setLoading(false));
    },
    [],
  );
  useEffect(() => {
    void reload();
  }, [reload]);
  return (
    <PageStack>
      <SectionHeading title="运行诊断" actions={<Button busy={loading} onClick={() => void reload()}>刷新日志</Button>} />
      {readError && <Alert role="alert">{readError}</Alert>}
      {lines.length ? <ContentScroll label="运行日志"><pre className="log-output">{lines.join("\n")}</pre></ContentScroll> : loading ? <Loading>正在读取日志…</Loading> : !readError && <EmptyState title="暂无日志" />}
    </PageStack>
  );
}
