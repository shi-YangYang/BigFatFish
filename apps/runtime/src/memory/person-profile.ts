import { demographicBelongsToSpeaker } from './demographic-source.js';
import type { DatabaseSync } from 'node:sqlite';
import { demographicStatements, selectStatement } from './natural-learning.js';
import type { ProfileEntry } from './types.js';

type Field = Pick<ProfileEntry,'key'|'label'|'value'>;
type Person = { role: 'owner' | 'other'; scopeKey: string };
// Store the instant as UTC, then report the source's calendar day in the Runtime time zone.
export function profileDay(at: string) {
  if (/^\d{4}-\d{2}-\d{2}$/u.test(at)) return at;
  const date = new Date(at);
  return Number.isFinite(+date) ? date.toLocaleDateString('sv-SE') : '';
}
const who = (person: Person) => person.role === 'owner' ? '主人' : '对方';

function fields(kind: string, subject: string, content: string, person: Person): Field[] {
  const label = who(person);
  if (kind === 'fact') {
    const compact = content.replace(/^(?:主人|对方)的(年龄|性别)[：:]\s*/u,'');
    const facts = demographicStatements(compact,{...person,scopeKey:'private'});
    if (facts.length) return facts.map(fact => {
      const age = fact.subject === label+'的年龄';
      const value = fact.content.split('：')[1]!;
      return {key:age?'age':'gender',label:age?'年龄':'性别',value:age?value.replace('岁',' 岁'):value};
    });
  }
  const direct = selectStatement(content,person,'');
  if (kind === 'fact' && (subject === label+'的名字' || direct?.subject === label+'的名字')) {
    const value = (direct?.content ?? content).replace(/^(?:主人|对方)的名字是/u,'');
    if (/^[\p{L}· ]{1,30}$/u.test(value)) return [{key:'name',label:'姓名',value}];
  }
  if (kind !== 'preference') return [];
  if (subject === label+'的称呼' || direct?.subject === label+'的称呼') {
    const value = (direct?.content ?? content).replace(/^(?:主人|对方)希望被称为/u,'');
    if (/^[\p{L}· ]{1,30}$/u.test(value)) return [{key:'nickname',label:'称呼',value}];
  }
  if (direct?.kind === 'preference' || subject.startsWith(label+'对') && subject.endsWith('的喜好')) {
    const value = (direct?.content ?? content).replace(/^(主人|对方)(?=喜欢|不喜欢|讨厌)/u,'');
    return [{key:'preference:'+subject,label:'偏好',value}];
  }
  return [];
}

// The projection is rebuilt from the current confirmed fact and a source attesting
// its value. Keeping the fact ID makes correction, rejection and deletion atomic.
export function syncPersonProfile(db: DatabaseSync, id: string) {
  db.prepare('DELETE FROM memory_profile_fields WHERE memory_id=?').run(id);
  const m = db.prepare(`SELECT kind,subject,content,actor_role AS role,scope_key AS scopeKey FROM memories
    WHERE id=? AND status='confirmed' AND actor_role IN ('owner','other')`).get(id) as
    {kind:string;subject:string;content:string} & Person | undefined;
  if (!m) return;
  const expected = fields(m.kind,m.subject,m.content,m);
  if (!expected.length) return;
  const sources = db.prepare(`SELECT l.quote,l.source_type,l.source_id,l.speaker_verified,m.id AS original,coalesce(m.created_at,l.asserted_at,'') AS at
    FROM memory_links l LEFT JOIN messages m ON l.source_type='message' AND m.id=l.source_id
    WHERE l.memory_id=? AND l.source_type IN ('user','message')
    ORDER BY at DESC,l.rowid DESC`).iterate(id);
  const remaining = new Map(expected.map(f => [f.key,f]));
  const insert = db.prepare('INSERT INTO memory_profile_fields VALUES(?,?,?,?,?,?,?)');
  for (const source of sources) {
    const evidence = fields(m.kind,m.subject,String(source.quote),m);
    if (source.source_type === 'message' && evidence.some(f => f.key === 'age' || f.key === 'gender') &&
        !demographicBelongsToSpeaker(db,String(source.source_id),String(source.quote),source.speaker_verified === 1)) continue;
    for (const field of evidence) {
      if (remaining.get(field.key)?.value !== field.value) continue;
      insert.run(id,field.key,field.label,field.value,String(source.at),source.source_type!,source.source_id!);
      if (source.original && !source.speaker_verified && (field.key === 'age' || field.key === 'gender')) {
        db.prepare("UPDATE memory_links SET speaker_verified=1 WHERE memory_id=? AND source_type='message' AND source_id=?")
          .run(id,source.source_id!);
      }
      remaining.delete(field.key);
    }
    if (!remaining.size) break;
  }
}

export function rebuildPersonProfiles(db: DatabaseSync) {
  for (const row of db.prepare("SELECT id FROM memories WHERE status='confirmed' AND actor_role IN ('owner','other')").iterate())
    syncPersonProfile(db,String(row.id));
}
