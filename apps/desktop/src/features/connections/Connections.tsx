import { PlatformTile, platforms } from './shared/PlatformSurface';
import { PageStack, SectionHeading } from '../../components/PageLayout';
import { useEffect, useState } from "react";
import { Button } from "../../components/Controls";
import { api } from "../../api/client";
import { Bilibili } from "./bilibili/Bilibili";
import { Douyin } from "./douyin/Douyin";
import { QQConnection } from "./qq/QQConnection";
import { QQMessages } from "./qq/QQMessages";
import { activeQQMode, qqStatus, biliStatus, douyinStatus, type BiliStatus, type DouyinStatus } from "./shared/connection-status";
import type { ChannelStatus } from "../../../../runtime/src/channels/types";
import type { ManagedQQStatus } from "../../../../runtime/src/channels/managed/types";

export function Connections({ fail, onPlan }: { fail: (error: unknown) => void; onPlan?: (platform: "bilibili" | "douyin") => void }) {
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
      <PageStack className="connection-details">
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
          <Bilibili fail={fail} onPlan={onPlan && (() => onPlan("bilibili"))} onConfigureQQ={() => setTab("QQ")} />
        ) : (
          <Douyin fail={fail} onPlan={onPlan && (() => onPlan("douyin"))} />
        )}
      </PageStack>
    );
  return (
    <PageStack className="connection-directory">
      <SectionHeading title="平台连接"/>
      <div className="connection-list">
        {platforms.map(platform => <PlatformTile key={platform.name} platform={platform}
          status={states[platform.name] ?? "正在读取…"} open={() => setTab(platform.name)}/>)}
      </div>
    </PageStack>
  );
}
