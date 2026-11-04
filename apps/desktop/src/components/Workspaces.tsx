import { Disclosure, Card, Badge } from "./Surfaces";
import { Button } from "./Controls";
import { useCallback, useEffect, useState } from "react";
import { api, isWeb } from "../api";
import { Home, Life } from "./Life";
import { Memories } from "./Memories";
import { Personality } from "./Personality";
import { Activities, Douyin } from "./Douyin";
import { Channels, Permissions } from "./Channels";
import { Bilibili } from "./Bilibili";
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
  const load = useCallback(async () => {
    const results = await Promise.allSettled([
      api<{ config?: { enabled: boolean }; health: { state: string } }>(
        "/v1/channels/qq",
      ),
      api<{ enabled: boolean; accountState: string }>("/v1/bilibili"),
      api<{ config: { enabled: boolean }; accountState: string }>("/v1/douyin"),
    ]);
    const next: Record<string, string> = {};
    results.forEach((r, i) => {
      const key = ["QQ", "B站", "抖音"][i];
      if (r.status === "rejected") {
        next[key] = "暂时无法获取状态";
        return;
      }
      if (i === 0) {
        const q = r.value as {
          config?: { enabled: boolean };
          health: { state: string };
        };
        next[key] = !q.config
          ? "未设置"
          : !q.config.enabled
            ? "已停用"
            : ({
                online: "已连接",
                connecting: "连接中",
                reconnecting: "重连中",
                not_logged_in: "需要登录",
                error: "连接异常",
                stopped: "已停用",
              }[q.health.state] ?? "未连接");
      } else {
        const p = r.value as {
          config?: { enabled: boolean };
          enabled?: boolean;
          accountState: string;
        };
        next[key] = !(p.config?.enabled ?? p.enabled)
          ? "未启用"
          : p.accountState === "verified"
            ? "已连接"
            : ["login-required", "signed-out"].includes(p.accountState)
              ? "需要登录"
              : p.accountState === "unverified"
                ? "待验证"
                : "账号异常";
      }
    });
    setStates(next);
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);
  if (tab)
    return (
      <>
        <Button
          type="button"
          className="back-button"
          onClick={() => {
            setTab("");
            void load();
          }}
        >
          ← 所有连接
        </Button>
        {tab === "QQ" ? (
          <div className="qq-workspace">
            <Channels fail={fail} />
            <Disclosure  title={<>主动消息与操作记录</>}>

              <Permissions fail={fail} />
            </Disclosure>
          </div>
        ) : tab === "B站" ? (
          <Bilibili fail={fail} />
        ) : (
          <Douyin fail={fail} />
        )}
      </>
    );
  return (
    <section>
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
          <WebSettings fail={fail} />
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
        <section>
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
    <section>
      <h2>运行诊断</h2>
      <Button type="button" onClick={() => void reload()}>
        刷新日志
      </Button>
      <pre className="log-output">{lines.join("\n") || "暂无日志"}</pre>
    </section>
  );
}
