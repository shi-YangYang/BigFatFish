import type { DatabaseSync } from 'node:sqlite';
import { unsafeMemoryTurn } from './natural-learning.js';

const other = /[他她它]|弟弟|妹妹|姐姐|哥哥|兄弟|姐妹|父母|爸妈|爸爸|妈妈|孩子|儿子|女儿|家人|亲戚|朋友|同学|同事|邻居|对象|老公|老婆|伴侣|宠物|猫|狗|鸟|兔|这(?:位|个)人|那(?:位|个)人/u;
const self = /(?:^|[,，、:：;；]\s*)(?:我(?:的|是|今年|现在|其实|刚满|已经|\s*\d)|自我介绍)|^(?:请)?(?:记住|更正一下|说错了)[，,：:\s]*我/u;

// A bare answer inherits the subject of the conversation. Read the previous exchange
// only to veto attribution, never as the source of a value or as input to the model.
export function demographicBelongsToSpeaker(db: DatabaseSync, sourceId: string, quote: string, previouslyVerified = false) {
  const source = db.prepare(`SELECT rowid AS seq,conversation_id,author,content FROM messages
    WHERE id=? AND role='user' AND status='completed'`).get(sourceId);
  // Memories-only archives can omit the original turn. A bare quote then needs a
  // previous verification of that exact evidence link by the runtime.
  if (!source) return previouslyVerified || self.test(quote);
  const raw = String(source.content);
  const start = raw.indexOf(quote);
  if (start < 0 || unsafeMemoryTurn(raw)) return false;
  const before = raw.slice(0,start).trimEnd(), after = raw.slice(start+quote.length).trimStart();
  // A substring such as “我是男生” in “同事说我是男生” is not a self-report.
  if (before && !/[，,。.!！；;？?\n]$/u.test(before) || after && !/[，,。.!！；;？?\n]$/u.test(quote) && !/^[，,。.!！；;？?\n]/u.test(after)) return false;
  if (self.test(quote)) return true;
  if (other.test(raw) || (before && !self.test(before))) return false;

  const previous = db.prepare(`SELECT u.content AS user,a.content AS assistant FROM messages u
    JOIN messages a ON a.conversation_id=u.conversation_id AND a.request_id=u.request_id
      AND a.role='assistant' AND a.status='completed'
    WHERE u.conversation_id=? AND u.author=? AND u.role='user' AND u.status='completed'
      AND u.rowid < ? AND a.rowid < ? ORDER BY u.rowid DESC LIMIT 1`)
    .get(source.conversation_id!,source.author!,source.seq!,source.seq!);
  if (!previous) return true;
  const prompt = String(previous.assistant).trim();
  if (other.test(prompt)) return false;
  if (/你(?:本人|自己)?(?:今年|现在|是男|是女|多大|几岁|的年龄|的性别)/u.test(prompt)) return true;
  if (/[?？]|几岁|多大|男的还是女的/u.test(prompt)) return false;
  return !other.test(String(previous.user));
}
