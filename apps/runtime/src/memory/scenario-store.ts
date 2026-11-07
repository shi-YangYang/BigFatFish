import { createHash } from 'node:crypto';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { InputError, object, string } from '../ai/types.js';
import { memoryAccess } from './attribution.js';
import { recallTerms } from './recall-terms.js';
import { attributionRoles, type MemoryAudience, type MemoryScene, type SceneFact } from './types.js';

type Fact = SceneFact & { kind: string; updatedAt: string };
type Term = { scope: string; topic: string };

// Prefer a whole named activity over incidentals such as a date, meeting point or equipment.
// For other topics, an explicit L1 subject can match that noun in another statement.
const activity = /(?:项目|计划|课题|工程|展览|画展|书展|摄影展|读书会|分享会|音乐节|运动会|夏令营|冬令营|训练营|工作坊|志愿活动|露营|旅行|徒步|马拉松|联赛|演出|比赛|大会|婚礼)/gu;
const boundaries = /[\s\d，,。.!！?？：:()（）;；、]+|(?:主人|对方)?(?:不再喜欢|不喜欢|喜欢|讨厌|习惯)|(?:这|那|本|上|下)(?:一次|次|场|个)|[上下本这]?(?:星期|周)[一二三四五六天日末]|(?:今天|明天|昨天|周末|当天|今年|平时|最近|准备|参加|参与|负责|确定了?|约好了?|订好了?|订了|预订了?|安排了?|买好了?|选定了?|打算|关于|因为|这回|说起|为了|周边|一起|筹备|已经|正在|我们|咱们|主人|对方|我的|的|和|与|去|给|为|在|我|把|对|会去)/u;
const ignoreTopic = /^(?:主人|对方|他人|本人|名字|称呼|性别|年龄|喜好|日期|时间|地点|安排|计划|事情|活动|项目|信息|喜欢|开始|资料|记录|周末|今天|明天|下周|集合|出发|目的地|预算|负责人|物资|主题|是的|已经|准备|确定|约好|订好|每次|目前|需要|负责|上午|下午|晚上|最近|一起|使用|习惯|现在|就是|我们|自己|以后|这次|这场|需要|今年)$/u;
const segmenter = new Intl.Segmenter('zh',{granularity:'word'});
const normalize = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/gu,' ').trim();

function names(content: string) {
  const found = new Map<string, number>();
  for (const piece of normalize(content).split(boundaries)) {
    for (const match of piece.matchAll(activity)) {
      const term = piece.slice(0, match.index + match[0].length);
      if (term.length > match[0].length && term.length <= 28 && /^[\p{L}\p{N}·-]+$/u.test(term)) {
        found.set(term,3);
        break; // 海岛露营旅行 and 海岛露营 share the more specific named outing.
      }
    }
  }
  return found;
}

function topics(db: DatabaseSync,fact: Fact) {
  const text = normalize(fact.content).replace(/（[^）]*的留言）|\([^)]*的留言\)/gu,'');
  const named = names(text);
  if (named.size) return named;
  // An in-place rescheduling still concerns the original outing. Only reuse a named
  // activity from this fact's verified history, never a retired value in the summary.
  if (fact.kind==='experience' && /改到|改为|改期|改成|推迟|取消|提前到/u.test(text) &&
      !db.prepare("SELECT 1 FROM memory_links WHERE memory_id=? AND source_type='user'").get(fact.id)) {
    const proofs = db.prepare("SELECT quote FROM memory_links WHERE memory_id=? AND source_type='message' ORDER BY rowid DESC LIMIT 12").all(fact.id);
    for (const {quote} of proofs) for (const [label,strength] of names(String(quote))) named.set(label,strength);
    if (named.size===1) return named;
  }
  if (/^(?:这次|那次|这趟|那趟|此次|本次|这场|这个项目|这项活动)(?:的|我|已经|需要|还|改|要)/u.test(text)) {
    const topic = resolveReference(db,fact);
    if (topic) return new Map([[topic,4]]);
  }
  const terms = new Map<string, number>();
  const subject = normalize(fact.subject.replace(/^(主人|对方)对(.+)的喜好$/u,'$2'));
  if (/^(主人|对方)的(?:名字|称呼|年龄|性别)$/u.test(subject)) return terms;
  function add(topic: string, strength: number) {
    if (topic.length >= 2 && topic.length <= 28 && !ignoreTopic.test(topic) && !/^\d+$/u.test(topic)
      && /^[\p{L}\p{N}· -]+$/u.test(topic)) terms.set(topic,Math.max(terms.get(topic)??0,strength));
  }
  add(subject,2);
  for (const part of segmenter.segment(text)) {
    if (part.isWordLike) add(part.segment,1);
    if (terms.size >= 12) break;
  }
  return terms;
}

const columns = 'm.id,m.kind,m.subject,m.content,m.version,m.updated_at AS updatedAt,m.actor_role AS role,m.person_key AS personKey,m.scope_key AS scopeKey';
const sceneId = (scope: string, topic: string) => createHash('sha256').update(JSON.stringify([scope,topic])).digest('hex');

function resolveReference(db: DatabaseSync,fact: Fact): string | undefined {
  // Preserve previously verified continuity when a memories-only archive omits the messages.
  const existing = db.prepare(`SELECT c.topic FROM memory_scene_context c JOIN memories b ON b.id=c.basis_id
    WHERE c.memory_id=? AND b.scope_key=? AND b.person_key=? AND b.actor_role=? AND b.status='confirmed'`)
    .get(fact.id,fact.scopeKey,fact.personKey,fact.role);
  if (existing) return String(existing.topic);
  const source = db.prepare(`SELECT u.rowid AS seq,u.conversation_id,u.author FROM memory_links l
    JOIN messages u ON l.source_type='message' AND u.id=l.source_id
    WHERE l.memory_id=? AND u.role='user' AND u.status='completed' AND instr(u.content,l.quote)>0 ORDER BY u.rowid DESC LIMIT 1`).get(fact.id);
  if (!source) return;
  const preceding = db.prepare(`SELECT id,author,content FROM messages WHERE conversation_id=? AND role='user'
    AND rowid<? ORDER BY rowid DESC LIMIT 3`).all(source.conversation_id!,source.seq!);
  if (!preceding.length || preceding[0]!.author!==source.author) return;
  const recentNames=new Set(preceding.flatMap(m=>[...names(String(m.content)).keys()]));
  if (recentNames.size!==1) return;
  const [topic]=recentNames;
  const proofs=db.prepare(`SELECT m.id,l.quote FROM memory_links l JOIN memories m ON m.id=l.memory_id
    WHERE l.source_type='message' AND l.source_id=? AND m.status='confirmed' AND m.actor_role=? AND m.person_key=? AND m.scope_key=?
    AND m.id<>? ORDER BY m.id`).all(preceding[0]!.id!,fact.role,fact.personKey,fact.scopeKey,fact.id);
  const proof=proofs.find(row=>names(String(row.quote)).has(topic!));
  if (!proof) return;
  db.prepare('INSERT OR REPLACE INTO memory_scene_context(memory_id,basis_id,topic) VALUES(?,?,?)').run(fact.id,proof.id!,topic!);
  return topic;
}

// Combine complete current statements by facet; keep a negative/corrective tail with
// its assertion. Lengthy evidence remains accessible through the linked L1 entry.
function digest(topic: string, facts: Fact[], mixed: boolean) {
  const facets=new Map<string,Set<string>>();
  const peers=[...new Set(facts.filter(f=>f.role==='other').map(f=>f.personKey))].sort();
  let omitted=0;
  for (const f of [...facts].reverse()) {
    let line=f.content.trim().replace(/[\r\n]+/gu,' ').replace(/[。；;]+$/u,'');
    if (line.length>190) { omitted++; continue; }
    const facet = f.kind==='preference' ? '偏好' : /改期|改到|改为|推迟|提前|取消/u.test(line) ? '变更'
      : /地点|地址|营地|集合点|会场/u.test(line) ? '地点' : /时间|日期|周[一二三四五六天日]|星期|日程/u.test(line) ? '日程'
      : /准备|装备|预订|订好|负责|买好|带上|车票|物资/u.test(line) ? '准备' : '相关事项';
    if (line.startsWith(topic+'的')) line=line.slice(topic.length+1);
    if (mixed) line=(f.role==='owner'?'主人':'群友'+(peers.indexOf(f.personKey)+1))+'提到“'+line+'”';
    const values=facets.get(facet)??new Set<string>();
    values.add(line); facets.set(facet,values);
  }
  const lines=[...facets].map(([label,items])=>label+'：'+[...items].join('；'));
  if (omitted) lines.push('另有'+omitted+'条较长记录，详见来源');
  return lines.join('。')+'。';
}

function refresh(db: DatabaseSync, {scope,topic}: Term) {
  const id = sceneId(scope,topic);
  const candidates = db.prepare(`SELECT ${columns},t.strength,c.basis_id AS basis FROM memory_scene_terms t JOIN memories m ON m.id=t.memory_id
    LEFT JOIN memory_scene_context c ON c.memory_id=m.id AND c.topic=t.topic
    WHERE t.scope_key=? AND t.topic=? ORDER BY t.observed_at DESC,t.memory_id LIMIT 8`).all(scope,topic) as unknown as (Fact & {strength:number;basis:string|null})[];
  // Every published assertion includes its basis in the same disclosure set. Deleting,
  // editing or revoking that source therefore also invalidates the contextual association.
  const facts=candidates.filter(f=>f.strength!==4 || candidates.some(b=>b.id===f.basis && b.strength===3
    && b.role===f.role && b.personKey===f.personKey));
  if (facts.length < 2 || !facts.some(f => f.strength >= 2) || new Set(facts.map(f=>f.content)).size < 2) {
    db.prepare('DELETE FROM memory_scenes WHERE id=?').run(id);
    return;
  }
  const evidence = JSON.stringify(facts.map(f=>f.id).sort());
  const samePerson = facts.every(f=>f.personKey===facts[0]!.personKey && f.role===facts[0]!.role);
  const summary = digest(topic,facts,!samePerson);
  const role = samePerson ? facts[0]!.role : 'general', personKey = samePerson ? facts[0]!.personKey : '';
  db.prepare(`INSERT INTO memory_scenes(id,scope_key,topic,summary,evidence,actor_role,person_key,updated_at) VALUES(?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET summary=excluded.summary,evidence=excluded.evidence,actor_role=excluded.actor_role,
    person_key=excluded.person_key,updated_at=excluded.updated_at`).run(id,scope,topic,summary,evidence,role,personKey,facts[0]!.updatedAt);
}

export function syncScenarioFact(db: DatabaseSync,id: string,remove=false) {
  const changed = db.prepare('DELETE FROM memory_scene_terms WHERE memory_id=? RETURNING scope_key AS scope,topic').all(id) as unknown as Term[];
  if (!remove) {
    const m = db.prepare(`SELECT ${columns} FROM memories m WHERE m.id=? AND m.status='confirmed'
      AND m.actor_role<>'unassigned' AND EXISTS(SELECT 1 FROM memory_links WHERE memory_id=m.id)`).get(id) as unknown as Fact | undefined;
    if (m) for (const topic of indexFact(db,m))
      if (!changed.some(t=>t.scope===m.scopeKey && t.topic===topic)) changed.push({scope:m.scopeKey,topic});
  }
  for (const term of changed) refresh(db,term);
}

function indexFact(db: DatabaseSync,m: Fact) {
  const insert=db.prepare('INSERT INTO memory_scene_terms(memory_id,scope_key,topic,strength,observed_at) VALUES(?,?,?,?,?)');
  const candidates=topics(db,m);
  for (const [topic,strength] of candidates) insert.run(m.id,m.scopeKey,topic,strength,m.updatedAt);
  return candidates.keys();
}

export function rebuildScenarios(db: DatabaseSync) {
  // Stream the index from authoritative facts once, then materialize each topic once.
  // Continuity checks for explicit references read at most three preceding turns.
  db.exec('DELETE FROM memory_scene_terms; DELETE FROM memory_scenes');
  const rows=db.prepare(`SELECT ${columns} FROM memories m WHERE m.status='confirmed' AND m.actor_role<>'unassigned'
    AND EXISTS(SELECT 1 FROM memory_links WHERE memory_id=m.id)`).iterate();
  for (const row of rows) indexFact(db,row as unknown as Fact);
  const groups=db.prepare('SELECT DISTINCT scope_key AS scope,topic FROM memory_scene_terms').iterate();
  for (const row of groups) refresh(db,row as unknown as Term);
}

export function readScenarios(db: DatabaseSync, input: unknown, audience?: MemoryAudience, semanticIds: string[] = []): MemoryScene[] {
  const b=object(input), query=normalize(string(b.query??'',200,true)), role=string(b.role??'',20,true);
  const id=string(b.id??'',100,true), memoryId=string(b.memoryId??'',100,true);
  const limit=b.limit??100, offset=b.offset??0;
  if (role && !attributionRoles.some(r=>r===role) || !Number.isSafeInteger(limit) || Number(limit)<1 || Number(limit)>100
    || !Number.isSafeInteger(offset) || Number(offset)<0) throw new InputError('INVALID_REQUEST');
  const where: string[] = [], args: SQLInputValue[] = [];
  if (id) { where.push('s.id=?'); args.push(id); }
  if (role) { where.push('s.actor_role=?'); args.push(role); }
  if (memoryId) { where.push('EXISTS(SELECT 1 FROM json_each(s.evidence) WHERE value=?)'); args.push(memoryId); }
  if (audience !== undefined) {
    const access=memoryAccess(audience);
    if (audience!=='owner') {
      if (typeof audience==='string') return [];
      where.push('s.scope_key=?'); args.push(audience.scopeKey);
    }
    // All or nothing. Even the title could disclose a fact suppressed in this audience.
    where.push(`NOT EXISTS(SELECT 1 FROM json_each(s.evidence) e WHERE NOT EXISTS(
      SELECT 1 FROM memories WHERE id=e.value AND status='confirmed' AND ${access.sql}
        AND EXISTS(SELECT 1 FROM memory_links l WHERE l.memory_id=memories.id AND
          (l.source_type='user' OR l.source_type='activity' AND EXISTS(SELECT 1 FROM activity_records WHERE id=l.source_id)
          OR l.source_type='message' AND EXISTS(SELECT 1 FROM messages u WHERE u.id=l.source_id AND u.role='user'
            AND u.status='completed' AND instr(u.content,l.quote)>0 AND EXISTS(SELECT 1 FROM messages a
              WHERE a.conversation_id=u.conversation_id AND a.request_id=u.request_id AND a.role='assistant' AND a.status='completed'))))))`);
    args.push(...access.params);
  }
  let rank='0';
  if (query) {
    // Questions often contain the scene name as a substring ("那场…有什么安排").
    // Narrow topical retrieval avoids injecting scenes merely because they share a date or a generic verb.
    const terms = recallTerms(query).filter(term=>term.length>=2 && !ignoreTopic.test(term));
    rank = `CASE WHEN instr(?,s.topic)>0 OR instr(s.topic,?)>0 THEN 100+length(s.topic) WHEN instr(s.summary,?)>0 THEN 20
      ELSE 0 END`;
    const scoreArgs: SQLInputValue[] = [query,query,query];
    if (terms.length) {
      rank += ` + (SELECT coalesce(max(length(value)),0) FROM json_each(?) WHERE instr(s.topic,value)>0)`;
      scoreArgs.push(JSON.stringify(terms));
    }
    if (audience !== undefined && semanticIds.length) {
      rank += ` + coalesce((SELECT max(20-hit.key) FROM json_each(?) hit JOIN json_each(s.evidence) member
        ON member.value=hit.value),0)`;
      scoreArgs.push(JSON.stringify(semanticIds.slice(0,16)));
    }
    args.unshift(...scoreArgs);
  }
  const rows = db.prepare(`WITH candidates AS (
    SELECT s.*,${rank} AS score FROM memory_scenes s ${where.length?'WHERE '+where.join(' AND '):''}
  ), ranked AS (SELECT *,row_number() OVER(PARTITION BY evidence ORDER BY score DESC,length(topic) DESC,topic) AS duplicate
    FROM candidates ${query?'WHERE score>0':''})
    SELECT id,topic AS title,summary,evidence,actor_role AS role,person_key AS personKey,scope_key AS scopeKey,
    updated_at AS updatedAt FROM ranked WHERE duplicate=1 ${query?"AND (score>=100 OR NOT EXISTS(SELECT 1 FROM candidates WHERE score>=100))":""} ORDER BY score DESC,updated_at DESC,title,id LIMIT ? OFFSET ?`)
    .all(...args,Number(limit),Number(offset));
  const members = db.prepare(`SELECT m.id,m.version,m.subject,m.content,m.actor_role AS role,m.person_key AS personKey,
    m.scope_key AS scopeKey FROM memories m JOIN json_each(?) e ON e.value=m.id ORDER BY m.updated_at,m.id DESC`);
  return rows.map(({evidence,...row})=>({...row,members:members.all(String(evidence))} as unknown as MemoryScene));
}
