import { useState } from "react";
import { Tabs } from "../../components/UI";
import { Home, Life } from "./Life";
import { Memories } from "./Memories";
import { Personality } from "./Personality";
import { Activities } from "./Activities";

export function MyFish({ fail }: { fail: (error: unknown) => void }) {
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
