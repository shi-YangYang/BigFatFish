import type { DatabaseSync } from 'node:sqlite';
import { canShareMemory } from './types.js';
import type { MemoryAttribution, MemoryAudience, Source } from './types.js';

const generalMemory: MemoryAttribution = {role:'general',personKey:'',scopeKey:''};
const unresolved: MemoryAttribution = {role:'unassigned',personKey:'',scopeKey:''};
const ownerPrivate: MemoryAttribution = {role:'owner',personKey:'owner',scopeKey:'owner'};

// Owners may state a new name or preference in a different room. Only their
// private, cross-room view resolves the current slot; each room keeps its own
// history. Use the dated source message, never a later edit or sharing toggle.
function latestMessageSequence(entry: 'memories' | 'related') {
  return `(SELECT MAX(msg.rowid) FROM memory_links proof JOIN messages msg ON msg.id=proof.source_id
    WHERE proof.memory_id=${entry}.id AND proof.source_type='message' AND msg.role='user' AND msg.status='completed')`;
}

// A private rescheduling and its public origin share verbatim evidence. If the
// owner reschedules again in that group, the private view follows the newer claim.
const currentOwnerFacts = `(actor_role IN ('owner','general') AND
  NOT (actor_role='owner' AND kind='experience' AND EXISTS (
    SELECT 1 FROM memory_links origin JOIN memory_links correction ON correction.source_id=origin.source_id
      AND correction.source_type='message' AND correction.quote=origin.quote
    JOIN memories related ON related.id=correction.memory_id
    WHERE origin.memory_id=memories.id AND origin.source_type='message'
      AND related.actor_role='owner' AND related.person_key=memories.person_key
      AND (related.scope_key='owner')<>(memories.scope_key='owner') AND related.kind=memories.kind
      AND related.subject=memories.subject AND related.status='confirmed'
      AND ${latestMessageSequence('related')} > ${latestMessageSequence('memories')}
  )) AND CASE WHEN actor_role='owner' AND (
    (kind='fact' AND subject IN ('主人的名字','主人的年龄','主人的性别')) OR
    (kind='preference' AND (subject='主人的称呼' OR subject GLOB '主人对*的喜好'))
  ) THEN scope_key=COALESCE((
    SELECT entry.scope_key FROM memories entry
    JOIN memory_links l ON l.memory_id=entry.id AND l.source_type='message'
    JOIN messages msg ON msg.id=l.source_id AND msg.role='user' AND msg.status='completed'
    WHERE entry.actor_role='owner' AND entry.person_key='owner'
      AND entry.kind=memories.kind AND entry.subject=memories.subject AND entry.status='confirmed'
      AND instr(msg.content,l.quote)>0 AND EXISTS (SELECT 1 FROM messages reply
        WHERE reply.conversation_id=msg.conversation_id AND reply.request_id=msg.request_id
          AND reply.role='assistant' AND reply.status='completed')
    ORDER BY msg.created_at DESC,msg.rowid DESC LIMIT 1
  ),scope_key) ELSE 1 END)`;

// Use the same predicate in both retrievers, in the delivery guard and in session invalidation.
export function memoryAccess(audience: MemoryAudience) {
  if (audience === 'owner') return {sql:currentOwnerFacts,params:[] as string[]};
  const shared = "(visibility='shared' AND (actor_role='general' OR (actor_role='owner' AND scope_key='owner')))";
  if (typeof audience === 'string') return {sql:shared,params:[]};
  if (/^qq:\d+:group:\d+$/u.test(audience.scopeKey)) {
    return {sql:`(${shared} OR (actor_role IN ('owner','other') AND scope_key=?))`,params:[audience.scopeKey]};
  }
  const peer = /^qq:(\d+):private:(\d+)$/u.exec(audience.scopeKey);
  if (peer && audience.personKey === `qq:${peer[1]}:${peer[2]}`) {
    return {sql:`(${shared} OR (actor_role='other' AND scope_key=? AND person_key=?))`,params:[audience.scopeKey,audience.personKey]};
  }
  return {sql:shared,params:[]};
}

export function validAttribution(actor: MemoryAttribution) {
  if (actor.role==='general' || actor.role==='unassigned') return actor.scopeKey==='' && actor.personKey==='';
  if (actor.role==='owner') return actor.personKey==='owner' && (actor.scopeKey==='owner' || /^qq:\d+:group:\d+$/u.test(actor.scopeKey));
  const scope = /^qq:(\d+):(group|private):(\d+)$/u.exec(actor.scopeKey);
  const person = /^qq:(\d+):(\d+)$/u.exec(actor.personKey);
  return actor.role==='other' && !!scope && !!person && scope[1]===person[1] && (scope[2]==='group'||scope[3]===person[2]);
}

// Older records do not have a stored product role. Reconstruct only what their original
// session proves, regardless of who happens to be configured as owner at migration time.
function historicalSpeaker(db: DatabaseSync, messageId: string): MemoryAttribution {
  const row = db.prepare(`SELECT m.author,c.audience,c.principal,s.id AS channel FROM messages m
    JOIN conversations c ON c.id=m.conversation_id LEFT JOIN channel_sessions s ON s.conversation_id=c.id
    WHERE m.id=? AND m.role='user' AND m.status='completed'`).get(messageId);
  if (!row || row.author !== row.principal) return unresolved;
  if (row.author === 'local-owner' && row.audience === 'owner' && row.channel === null) return ownerPrivate;
  const qq = /^(\d+):[^:]+:(private|group):(\d+):(\d+)$/u.exec(String(row.channel));
  if (!qq || (qq[2] === 'private' && qq[3] !== qq[4])) return unresolved;
  if (qq[2] === 'private' && row.audience === 'owner' && row.author === 'qq-owner:' + qq[4]) return ownerPrivate;
  if (row.audience !== 'group' || row.author !== 'qq-user:' + qq[4]) return unresolved;
  // Pre-role group messages do not distinguish the owner from other senders. Such
  // records remain tied to their historical QQ identity inside that group.
  return {role:'other',personKey:`qq:${qq[1]}:${qq[4]}`,scopeKey:`qq:${qq[1]}:${qq[2]}:${qq[3]}`};
}

export function inferAttribution(db: DatabaseSync, sources: Pick<Source,'id'|'type'>[], subject: string) {
  const messages = sources.filter(s => s.type === 'message');
  if (!messages.length) {
    return sources.length && !/^qq[-:]?user\d|^qq-user:/iu.test(subject) ? generalMemory : unresolved;
  }
  const first = historicalSpeaker(db,messages[0]!.id);
  for (const source of messages.slice(1)) {
    const other = historicalSpeaker(db,source.id);
    if (first.role!==other.role || first.personKey!==other.personKey || first.scopeKey!==other.scopeKey) return unresolved;
  }
  if (first.role==='owner' && /^qq[-:]?user\d|^qq-user:/iu.test(subject)) return unresolved;
  return first;
}

export function classifyLegacyMemories(db: DatabaseSync) {
  const links = db.prepare('SELECT source_type AS type,source_id AS id FROM memory_links WHERE memory_id=?');
  const write = db.prepare("UPDATE memories SET actor_role=?,person_key=?,scope_key=?,visibility=CASE WHEN ?=1 THEN visibility ELSE 'private' END WHERE id=?");
  for (const row of db.prepare('SELECT id,subject FROM memories').iterate()) {
    const sources = links.all(row.id!) as unknown as Pick<Source,'type'|'id'>[];
    const actor = inferAttribution(db,sources,String(row.subject));
    write.run(actor.role,actor.personKey,actor.scopeKey,Number(canShareMemory(actor)),row.id!);
  }
}
