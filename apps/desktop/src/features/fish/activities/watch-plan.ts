export type WatchPlatform = "bilibili" | "douyin";
export type WatchMode = "按兴趣看" | "看指定视频";

export interface WatchPlanDraft {
  platform: WatchPlatform;
  mode: WatchMode;
  topic: string;
  videos: Record<WatchPlatform, string>;
  intervalMinutes: string;
}

export function newWatchPlan(platform: WatchPlatform = "douyin"): WatchPlanDraft {
  return {platform, mode:"按兴趣看", topic:"", videos:{bilibili:"", douyin:""}, intervalMinutes:"60"};
}

const platforms = {
  bilibili: {name:"B站", domain:"bilibili.com", validId:/^BV[0-9A-Za-z]{10}$/, idName:"BV 号"},
  douyin: {name:"抖音", domain:"douyin.com", validId:/^\d{6,30}$/, idName:"视频数字 ID"},
};

// Extract an ID only from the chosen platform's full video URL. No redirects or remote lookup.
function parseVideo(platform: WatchPlatform, token: string): string | null {
  const {domain, validId} = platforms[platform];
  if (validId.test(token)) return token;
  let url: URL;
  try { url = new URL(token); } catch { return null; }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port ||
    ![domain, "www."+domain].includes(url.hostname)) return null;
  const id = /^\/video\/([^/]+)\/?$/.exec(url.pathname)?.[1];
  return id && validId.test(id) ? id : null;
}

type Choice = {platform: WatchPlatform; query: string} | {platform: WatchPlatform; videoId: string};
interface Schedule {enabled:true; mode:"Autonomous" | "Scheduled"; intervalMinutes:number; choices:Choice[]}

export function readWatchPlan(draft: WatchPlanDraft): {schedule:Schedule} | {error:string} {
  const {platform} = draft;
  const intervalMinutes = Number(draft.intervalMinutes);
  if (!Number.isInteger(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 10080)
    return {error:"观看间隔须为 1 到 10080 分钟的整数。"};
  if (draft.mode === "按兴趣看") {
    const query = draft.topic.trim();
    if (!query || query.length > 200) return {error:"请填写 200 字以内的兴趣主题。"};
    return {schedule:{enabled:true, mode:"Autonomous", intervalMinutes, choices:[{platform, query}]}};
  }
  const {name,idName} = platforms[platform];
  const parts = draft.videos[platform].trim().split(/[，,\s]+/).filter(Boolean);
  if (!parts.length) return {error:`请填写${name}视频的完整链接或${idName}。`};
  if (parts.length > 10) return {error:"一个计划最多指定 10 个视频。"};
  const ids = new Set<string>();
  for (const [index, part] of parts.entries()) {
    const id = parseVideo(platform, part);
    if (!id) return {error:`第 ${index+1} 项不是有效的${name}视频。请粘贴视频页完整链接或${idName}，不要用分享短链。`};
    ids.add(id);
  }
  return {schedule:{enabled:true, mode:"Scheduled", intervalMinutes, choices:[...ids].map(videoId => ({platform, videoId}))}};
}
