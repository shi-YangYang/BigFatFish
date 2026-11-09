import type { Memory } from "../../../../runtime/src/memory/types";

export const memoryRoles = { owner: "主人", other: "其他人", general: "通用", unassigned: "未归属" };

export function memoryOrigin(m: Memory) {
  if (m.role === "unassigned") return "未归属 · 仅存档";
  const [, , room, id] = (m.scopeKey || "").split(":");
  const person = m.role === "other" ? `QQ ${m.personKey.split(":").at(-1)}` : memoryRoles[m.role] || "通用";
  if (room === "group") return `${person} · QQ 群 ${id}`;
  if (room === "private") return `${person} · 好友私聊`;
  return `${person} · ${m.visibility === "shared" ? "已共享" : "仅主人私聊"}`;
}
