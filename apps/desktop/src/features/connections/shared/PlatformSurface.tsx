import { ChevronRight, MessageCircle, Music2, Tv, ScanLine } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Button } from "../../../components/Controls";
import { Card } from "../../../components/Surfaces";
import { SectionCard, SectionHeading } from "../../../components/PageLayout";
import { ConnectionStatus } from "./ConnectionStatus";
import "../connections.css";

export const platforms = [
  { name: "QQ", icon: MessageCircle, tone: "qq" },
  { name: "B站", icon: Tv, tone: "bilibili" },
  { name: "抖音", icon: Music2, tone: "douyin" },
] as const;
type Platform = (typeof platforms)[number]["name"];

function PlatformMark({ name }: { name: Platform }) {
  const { icon: Glyph, tone } = platforms.find(platform => platform.name === name)!;
  return <span className={`channel-mark channel-mark--${tone}`} aria-hidden="true"><Glyph size={22} strokeWidth={1.8}/></span>;
}

export function PlatformTile({ platform, status, open, restoreFocus }: {
  platform: typeof platforms[number]; status: string; open: () => void; restoreFocus: boolean;
}) {
  const statusId = useId();
  return <Card className="channel-tile">
    <PlatformMark name={platform.name}/>
    <div className="channel-tile-copy"><h3>{platform.name}</h3><span id={statusId}><ConnectionStatus label={status}/></span></div>
    <ChevronRight className="channel-tile-chevron" size={16} strokeWidth={1.7} aria-hidden="true"/>
    <Button className="channel-tile-action" variant="ghost" aria-label={`打开 ${platform.name} 连接`}
      aria-describedby={statusId} autoFocus={restoreFocus} onClick={open}/>
  </Card>;
}

export function PlatformAccount({ platform, name, accountId, status, headerAction, children }: {
  platform: Platform; name?: string; accountId?: string; status?: string; headerAction?: ReactNode; children?: ReactNode;
}) {
  return <Card className={`connection-account ${platform === "QQ" ? "qq-account-card" : "platform-account-card"}`}>
    <div className="channel-account-head"><PlatformMark name={platform}/>
      <SectionHeading className={platform === "QQ" ? "qq-account-heading" : "platform-account-heading"} title={<>{platform}{name && <span className="account-name"> · {name}</span>}</>}
        description={accountId || undefined}
        actions={(status || headerAction) && <>{status && <span className="account-status"><ConnectionStatus label={status}/></span>}{headerAction}</>}/>
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
