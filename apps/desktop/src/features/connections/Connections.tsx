import { useEffect, useState } from "react";
import { Card, Badge } from "../../components/Surfaces";
import { Button } from "../../components/Controls";
import { api } from "../../api/client";
import { Bilibili } from "./Bilibili";
import { Douyin } from "./Douyin";
import { QQConnection } from "./qq/QQConnection";
import { QQMessages } from "./qq/QQMessages";
import { activeQQMode, qqStatus, biliStatus, douyinStatus, type BiliStatus, type DouyinStatus } from "./connection-status";
import type { ChannelStatus } from "../../../../runtime/src/channels/types";
import type { ManagedQQStatus } from "../../../../runtime/src/channels/managed/types";

export function Connections({ fail }: { fail: (error: unknown) => void }) {
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
            <QQConnection fail={fail}>
              <QQMessages />
            </QQConnection>
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
