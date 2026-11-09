import { fuseRanks } from './rank-fusion.js';
import type { DatabaseSync } from 'node:sqlite';

type Platform = 'bilibili' | 'douyin';
interface SceneOptions {
  platform?: Platform;
  recent?: boolean;
  limit?: number;
  excludeSourceId?: string;
}
interface WatchedScene {
  id: string;
  sourceId: string;
  platform: Platform;
  occurredAt: string;
  summary: string;
}

const words = new Intl.Segmenter('zh-CN', { granularity: 'word' });
const questionWords = new Set(('我 你 你在 你们 你的 的 了 过 过的 在 上 下 还 是 吗 呢 呀 啊 有 有没有 没有 和 与 也 那 这 个 次 天 两 一下 一些 一个 那个 这个 那些 哪些 啥 什么 怎么 怎样 关于 有关 说 说说 讲 聊聊 记得 记不记得 记忆 回忆 想起 印象 还有 ' +
  '看 看了 看到 看过 看看 观看 刷 刷到 刷过 到 到了 些 的是 哪个 相关 啦 最近 最新 上次 之前 以前 刚才 今天 昨天 这几天 视频 内容 经历 ' +
  'a an and the of on in you your did watch watched video videos recently').split(' '));
const platformName = /b\s*站|哔哩哔哩|bilibili|抖音|douyin|大肥鱼/giu;
const clip = (text: string, size: number) => text.length <= size ? text : text.slice(0, size - 1) + '…';

function searchTerms(query: string): string[] {
  const clean = query.slice(0, 512).normalize('NFKC').toLowerCase().replace(platformName, ' ')
    .replace(/([刷看])了点(?=什么|啥|哪些)/gu, '$1了');
  const terms = new Set<string>();
  for (const word of words.segment(clean)) {
    if (word.isWordLike && !questionWords.has(word.segment)) terms.add(word.segment);
    if (terms.size === 12) break;
  }
  return [...terms];
}

function evidence(summary: string) {
  // Current writers include the platform, URL and sampling method on every row.
  // Only the title and the observed content distinguish one watch from another.
  const title = summary.match(/^(?:读取\s*B站视频|观看抖音)《(.+?)》\s+https?:\/\//u)?.[1] ?? '';
  const marker = '。模型总结：';
  const markerAt = summary.indexOf(marker);
  const body = markerAt >= 0 ? summary.slice(markerAt + marker.length) : summary;
  return { title, body };
}

export function watchText(summary: string) {
  const {title, body} = evidence(summary);
  return title ? title + '\n' + body : body;
}

export class PlatformScenes {
  constructor(private db: DatabaseSync) {}

  recall(query: string, options: SceneOptions = {}, semanticIds: string[] = [], semanticOnly = false): WatchedScene[] {
    const requested = options.limit ?? 3;
    const limit = Math.min(4, Math.trunc(Number.isFinite(requested) ? requested : 3));
    const terms = searchTerms(query);
    if (limit <= 0 || (!terms.length && !options.recent && !semanticIds.length)) return [];

    const kinds = options.platform === 'bilibili' ? ['bilibili.watched']
      : options.platform === 'douyin' ? ['douyin.watched'] : ['bilibili.watched', 'douyin.watched'];
    const filters = [`kind IN (${kinds.map(() => '?').join(',')})`];
    const params: (string | number)[] = [...kinds];
    if (options.excludeSourceId) {
      filters.push('source_id <> ?');
      params.push(options.excludeSourceId);
    }
    if (terms.length) {
      filters.push('(' + terms.map(() => 'instr(lower(summary), ?) > 0').join(' OR ') + ')');
      params.push(...terms);
    }
    const sql = `SELECT id, source_id, kind, occurred_at, summary FROM activity_records
      WHERE ${filters.join(' AND ')} ORDER BY occurred_at DESC, id DESC`;
    const rows = semanticOnly ? [] : terms.length ? this.db.prepare(sql).iterate(...params)
      : options.recent ? this.db.prepare(sql + ' LIMIT ?').iterate(...params, limit) : [];

    const best: { score: number; scene: WatchedScene }[] = [];
    for (const row of rows) {
      const { title, body } = evidence(String(row.summary));
      const heading = title.toLowerCase(), content = body.toLowerCase();
      let score = 0, excerptAt = -1;
      for (const term of terms) {
        const match = content.indexOf(term);
        if (match >= 0) {
          score += term.length;
          if (excerptAt < 0 || match < excerptAt) excerptAt = match;
        }
        if (heading.includes(term)) score += term.length * 3;
      }
      if ((terms.length && score === 0) || (best.length === limit && score <= best[limit - 1]!.score)) continue;
      const prefix = title ? `《${clip(title, 100)}》模型总结：` : '';
      const start = excerptAt > 380 - prefix.length ? Math.max(0, excerptAt - 60) : 0;
      const summary = clip(prefix + (start ? '…' : '') + body.slice(start), 480);
      const scene: WatchedScene = {
        id: String(row.id), sourceId: String(row.source_id), occurredAt: String(row.occurred_at),
        platform: row.kind === 'bilibili.watched' ? 'bilibili' : 'douyin', summary,
      };
      best.push({ score, scene });
      best.sort((a, b) => b.score - a.score);
      if (best.length > limit) best.pop();
    }
    const lexical = best.map(item => item.scene);
    if (!semanticIds.length || (!terms.length && options.recent)) return lexical;
    const byId = new Map(lexical.map(scene => [scene.id,scene]));
    const get = this.db.prepare(`SELECT id,source_id,kind,occurred_at,summary FROM activity_records
      WHERE id=? AND kind IN (${kinds.map(()=>'?').join(',')})`);
    for (const id of semanticIds) {
      if (byId.has(id)) continue;
      const row = get.get(id,...kinds);
      if (!row || options.excludeSourceId === row.source_id) continue;
      byId.set(id,{id,sourceId:String(row.source_id),occurredAt:String(row.occurred_at),
        platform:row.kind==='bilibili.watched'?'bilibili':'douyin',summary:clip(watchText(String(row.summary)),480)});
    }
    return fuseRanks(lexical.map(s=>s.id),semanticIds).flatMap(id=>byId.get(id) ?? []).slice(0,limit);
  }
}
