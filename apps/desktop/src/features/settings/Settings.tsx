import { useCallback, useEffect, useState } from "react";
import { ContentScroll, Disclosure } from "../../components/Surfaces";
import { Button } from "../../components/Controls";
import { Tabs } from "../../components/UI";
import { api, isWeb } from "../../api/client";
import { Models } from "./Models";
import { Plugins } from "./Plugins";
import { Media } from "./Media";
import { Setup, Backup, Updates } from "./Setup";
import { WebSettings } from "../../../../web/src/Settings";
import assetNotice from "../../assets/fish-girl.NOTICE.txt?raw";
import type { ModelConfig } from "../../../../runtime/src/ai/types";

type Fail = { fail: (e: unknown) => void };

export function Settings({
  models,
  reload,
  fail,
  done,
  tab,
  setTab,
}: Fail & {
  models: (ModelConfig & { hasKey: boolean })[];
  reload: () => Promise<void>;
  done: () => void;
  tab: string;
  setTab: (s: string) => void;
}) {
  return (
    <>
      <Tabs
        items={["模型", "扩展", "声音", "通用", "数据", "关于", "高级"]}
        value={tab}
        onChange={setTab}
        label="设置分类"
      >
      {tab === "模型" ? (
        <Models models={models} reload={reload} fail={fail} />
      ) : tab === "扩展" ? (
        <Plugins fail={fail} />
      ) : tab === "声音" ? (
        <Media fail={fail} />
      ) : tab === "通用" ? (
        isWeb ? (
          <WebSettings fail={fail} showLogout />
        ) : (
          <Setup fail={fail} done={done} />
        )
      ) : tab === "数据" ? (
        isWeb ? (
          <WebSettings fail={fail} />
        ) : (
          <Backup fail={fail} />
        )
      ) : tab === "关于" ? (
        <section className="page-section">
          <h2>BigFatFish</h2>
          <p>自己的大肥鱼，慢慢一起成长。</p>
          <Disclosure  title={<>图像来源与许可</>}>

            <pre className="asset-notice">{assetNotice}</pre>
          </Disclosure>
          {!isWeb && (
            <Disclosure  title={<>软件更新</>}>

              <Updates fail={fail} />
            </Disclosure>
          )}
        </section>
      ) : (
        <Logs fail={fail} />
      )}
      </Tabs>
    </>
  );
}
function Logs({ fail }: Fail) {
  const [lines, setLines] = useState<string[]>([]);
  const reload = useCallback(
    () =>
      api<{ lines: string[] }>("/v1/logs")
        .then((r) => setLines(r.lines))
        .catch(fail),
    [fail],
  );
  useEffect(() => {
    void reload();
  }, [reload]);
  return (
    <section className="page-section">
      <div className="section-heading"><h2>运行诊断</h2>
      <Button type="button" onClick={() => void reload()}>刷新日志</Button></div>
      <ContentScroll label="运行日志"><pre className="log-output">{lines.join("\n") || "暂无日志"}</pre></ContentScroll>
    </section>
  );
}
