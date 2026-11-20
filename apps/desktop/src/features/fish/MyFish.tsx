import { useEffect, useRef, useState } from "react";
import { Tabs } from "../../components/UI";
import { Home, Life } from "./life/Life";
import { Memories } from "./memory/Memories";
import { Personality } from "./Personality";
import { Activities, type PlanIntent } from "./activities/Activities";

export function MyFish({ fail, onChat, planIntent, onPlanHandled }: {
  fail: (error: unknown) => void;
  onChat?: () => void;
  planIntent?: PlanIntent;
  onPlanHandled?: (id: number) => void;
}) {
  const [tab, setTab] = useState("概览");
  const [writeDiary, setWriteDiary] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<PlanIntent>();
  const accepted = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!planIntent || accepted.current === planIntent.id) return;
    accepted.current = planIntent.id;
    setTab("活动计划");
    setPendingPlan(planIntent);
    onPlanHandled?.(planIntent.id);
  }, [planIntent, onPlanHandled]);
  function navigate(next: string) {
    setPendingPlan(undefined);
    setWriteDiary(next === "写日记");
    setTab(next === "写日记" ? "经历" : next);
  }
  return (
    <Tabs items={["概览", "设定", "记忆", "经历", "活动计划"]} value={tab} onChange={navigate} label="我的鱼">
      {tab === "概览" ? <Home navigate={navigate} onChat={onChat} />
        : tab === "设定" ? <Personality fail={fail} />
        : tab === "记忆" ? <Memories fail={fail} onChat={onChat} />
        : tab === "经历" ? <Life fail={fail} startWriting={writeDiary} />
        : <Activities fail={fail} planIntent={pendingPlan} onPlanHandled={() => setPendingPlan(undefined)} />}
    </Tabs>
  );
}
