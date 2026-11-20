import { ArrowUpRight, MessageCircle, Music2, Tv, ScanLine } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../../components/Controls";
import { Card } from "../../../components/Surfaces";
import { SectionCard, SectionHeading } from "../../../components/PageLayout";
import { ConnectionStatus } from "./ConnectionStatus";
import "../connections.css";

export const platforms = [
  { name: "QQ", icon: MessageCircle, tone: "qq", description: "好友私聊、群聊和表情" },
  { name: "B站", icon: Tv, tone: "bilibili", description: "观看视频，把感兴趣的内容分享到 QQ" },
  { name: "抖音", icon: Music2, tone: "douyin", description: "浏览短视频、点赞和评论" },
] as const;
type Platform = (typeof platforms)[number]["name"];

function PlatformMark({ name }: { name: Platform }) {
  const { icon: Glyph, tone } = platforms.find(platform => platform.name === name)!;
  return <span className={`channel-mark channel-mark--${tone}`} aria-hidden="true"><Glyph size={22} strokeWidth={1.8}/></span>;
}

export function PlatformTile({ platform, status, open }: { platform: typeof platforms[number]; status: string; open: () => void }) {
  return <Card className="channel-tile">
    <div className="channel-tile-meta"><PlatformMark name={platform.name}/><ConnectionStatus label={status}/></div>
    <div className="channel-tile-copy"><h3>{platform.name}</h3><p>{platform.description}</p></div>
    <Button className="channel-tile-action" onClick={open}>管理连接<ArrowUpRight size={15} aria-hidden="true"/></Button>
  </Card>;
}

export function PlatformAccount({ platform, name, accountId, status, children }: {
  platform: Platform; name?: string; accountId?: string; status?: string; children?: ReactNode;
}) {
  return <Card className={`connection-account ${platform === "QQ" ? "qq-account-card" : "platform-account-card"}`}>
    <div className="channel-account-head"><PlatformMark name={platform}/>
      <SectionHeading className={platform === "QQ" ? "qq-account-heading" : "platform-account-heading"} title={<>{platform}{name && <span className="account-name"> · {name}</span>}</>}
        description={accountId || undefined}
        actions={status && <span className="account-status"><ConnectionStatus label={status}/></span>}/>
    </div>
    {children}
  </Card>;
}

export function LoginPrompt({ instruction, code, alt }: { instruction: string; code?: string; alt?: string }) {
  return <div className={`channel-login-prompt${code ? " with-qr" : ""}`}>
    {code ? <img src={code} alt={alt}/> : <ScanLine aria-hidden="true" size={21}/>}
    <p>{instruction}</p>
  </div>;
}


export function WatchPlanPrompt({ platform, onPlan }: { platform: "B站" | "抖音"; onPlan: () => void }) {
  return <SectionCard title="还没有观看记录" description={`给大肥鱼安排${platform}观看计划，观看结果会出现在这里。`}>
    <div><Button variant="primary" onClick={onPlan}>创建观看计划</Button></div>
  </SectionCard>;
}
