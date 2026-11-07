import type { Activity } from "../../../../runtime/src/memory/types";

/** Transport receipts remain in the audit log, not in the fish's experiences. */
export function visibleExperiences(items: Activity[]): Activity[] {
  return items.filter(item => !["qq.received", "qq.sent"].includes(item.kind)).map(item => {
    let summary = item.summary;
    if (item.kind === "chat.completed") summary = summary.replace(/^完成对话：/, "聊了聊：");
    if (item.kind === "extract.completed") summary = "整理了聊天中的记忆";
    if (item.kind === "scheduled.decision" || item.kind === "autonomous.decision") summary = summary.replace(/；任务 [^；]+$/, "");
    if (item.kind === "bilibili.watched" || item.kind === "douyin.watched") {
      const title = summary.match(/《[^》]+》/)?.[0];
      const result = summary.split("模型总结：")[1];
      if (title && result) summary = `看了${item.kind === "bilibili.watched" ? "B站" : "抖音"}${title}：${result}`;
    }
    return { ...item, summary };
  });
}
