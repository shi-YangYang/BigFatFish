import { ContentScroll, Disclosure, Card, Badge } from "./Surfaces";
import { Button } from "./Controls";
import { useCallback, useEffect, useState } from "react";
import { api, isWeb } from "../api";
import { Home, Life } from "./Life";
import { Memories } from "./Memories";
import { Personality } from "./Personality";
import { Activities, Douyin } from "./Douyin";
import { Channels, QQMessages } from "./Channels";
import { Bilibili } from "./Bilibili";
import { activeQQMode, qqStatus, biliStatus, douyinStatus, type BiliStatus, type DouyinStatus } from "./connection-status";
import type { ChannelStatus } from "../../../runtime/src/channels/types";
import type { ManagedQQStatus } from "../../../runtime/src/channels/managed/types";
import { Models } from "./Models";
import { Plugins } from "./Plugins";
import { Media } from "./Media";
import { Setup, Backup, Updates } from "./Setup";
import { WebSettings } from "../../../web/src/Settings";
import { Tabs } from "./UI";
import assetNotice from "../assets/fish-girl.NOTICE.txt?raw";
import type { ModelConfig } from "../../../runtime/src/ai/types";
type Fail = { fail: (e: unknown) => void };
export function MyFish({ fail }: Fail) {
  const [tab, setTab] = useState("概览");
  return (
    <>
      <Tabs
        items={["概览", "设定", "记忆", "经历", "活动计划"]}
        value={tab}
        onChange={setTab}
        label="我的鱼"
      >
      {tab === "概览" ? (
        <Home
          navigate={(p) =>
            setTab(p === "任务" ? "活动计划" : p === "记忆" ? "记忆" : "经历")
          }
        />
      ) : tab === "设定" ? (
        <Personality fail={fail} />
      ) : tab === "记忆" ? (
        <Memories fail={fail} />
      ) : tab === "经历" ? (
        <Life fail={fail} />
      ) : (
        <Activities fail={fail} />
      )}
      </Tabs>
    </>
  );
}
export function Connections({ fail }: Fail) {
  const [tab, setTab] = useState(""),
    [states, setStates] = useState<Record<string, string>>({});
  useEffect(() => {
    if (tab) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      const qq = async () => {
        const channel = await api<ChannelStatus>("/v1/channels/qq");
        const component = channel.config?.enabled && channel.config.mode !== "managed" ? undefined
          : await api<ManagedQQStatus>("/v1/channels/qq/component");
        return qqStatus(activeQQMode(channel, component), channel, component).label;
      };
      const results = await Promise.allSettled([
        qq(),
        api<BiliStatus>("/v1/bilibili").then(status => biliStatus(status).label),
        api<DouyinStatus>("/v1/douyin").then(status => douyinStatus(status).label),
      ]);
      if (!active) return;
      setStates(Object.fromEntries(["QQ", "B站", "抖音"].map((name, i) => {
        const result = results[i]!;
        return [name, result.status === "fulfilled" ? result.value : "暂时无法获取状态"];
      })));
      timer = setTimeout(() => void load(), 5000);
    };
    void load();
    return () => { active = false; clearTimeout(timer); };
  }, [tab]);
  if (tab)
    return (
      <>
        <Button
          type="button"
          className="back-button"
          onClick={() => {
            setTab("");
          }}
        >
          ← 所有连接
        </Button>
        {tab === "QQ" ? (
          <div className="qq-workspace">
            <Channels fail={fail}>
              <QQMessages />
            </Channels>
          </div>
        ) : tab === "B站" ? (
          <Bilibili fail={fail} />
        ) : (
          <Douyin fail={fail} />
        )}
      </>
    );
  return (
    <section className="page-section">
      <h2>连接你的世界</h2>
      <div className="connection-list">
        {(["QQ", "B站", "抖音"] as const).map((name, i) => (
          <Card key={name}>
            <div className={`platform-icon platform-${i}`}>
              {name === "B站" ? "B" : name === "抖音" ? "♪" : "Q"}
            </div>
            <div className="connection-info">
              <h3>{name}</h3>
              <p>{["消息与陪伴", "视频与兴趣", "发现与观看"][i]}</p>
              <Badge className="connection-state">
                {states[name] ?? "正在读取…"}
              </Badge>
            </div>
            <Button type="button" onClick={() => setTab(name)}>
              管理连接
            </Button>
          </Card>
        ))}
      </div>
    </section>
  );
}
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
