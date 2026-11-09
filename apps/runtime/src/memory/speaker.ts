import type { DatabaseSync } from 'node:sqlite';
import { allowsTarget, configuration } from '../channels/protocol.js';
import type { Target } from '../channels/types.js';

export interface MemorySpeaker {
  role: 'owner' | 'other';
  personKey: string;
  scopeKey: string;
}

interface ConversationIdentity { principal: string; audience: string }
export interface MemoryTurnSource { messageId: string; author: string; text: string }
interface TurnRecord extends ConversationIdentity { conversation: string; sequence: number; at: string }

function resolveSpeaker(db: DatabaseSync, conversation: string, identity: ConversationIdentity): MemorySpeaker | null {
  if (identity.principal === 'local-owner') {
    return identity.audience === 'owner' ? { role: 'owner', personKey: 'owner', scopeKey: 'owner' } : null;
  }
  // QQ creates one authenticated channel-session key per bot, configuration revision,
  // room and sender. Neither a claimed name in the message nor a nickname enters here.
  // The built-in connector may predate SDK-managed plugins. Once managed, disabled
  // or uninstalled SDKs cannot supply personal memories from pending deliveries.
  const sdk = db.prepare("SELECT config FROM plugin_config WHERE id='sdk:qq'").get();
  if (sdk) {
    try {
      const state = JSON.parse(String(sdk.config));
      if (state?.enabled !== true || state.installed !== true) return null;
    } catch { return null; }
  }
  const row = db.prepare(`SELECT p.config, p.revision, s.id FROM channel_sessions s
    JOIN plugin_config p ON p.id='qq' WHERE s.conversation_id=? LIMIT 2`).all(conversation);
  if (row.length !== 1) return null;
  const binding = row[0]!;
  let config;
  try { config = configuration(JSON.parse(String(binding.config))); } catch { return null; }
  if (!config.enabled || !config.replyEnabled) return null;
  const fields = String(binding.id).split(':');
  const [bot, revision, kind, room, sender] = fields;
  if (fields.length !== 5 || bot !== config.accountId || revision !== binding.revision ||
      (kind !== 'private' && kind !== 'group') || !room || !sender || !/^[1-9]\d{0,31}$/.test(sender) ||
      sender === bot || (kind === 'private' && sender !== room)) return null;
  const target: Target = { kind, id: room };
  if (!allowsTarget(config, target)) return null;

  const isOwner = sender === config.ownerId;
  const privateOwner = isOwner && kind === 'private';
  // QQ has historically stored both friend and public conversations with audience
  // "group", and uses a qq-user principal even for the owner speaking in a group.
  if (identity.audience !== (privateOwner ? 'owner' : 'group') ||
      identity.principal !== `qq-${privateOwner ? 'owner' : 'user'}:${sender}`) return null;
  return {
    role: isOwner ? 'owner' : 'other',
    personKey: isOwner ? 'owner' : `qq:${bot}:${sender}`,
    scopeKey: privateOwner ? 'owner' : `qq:${bot}:${kind}:${room}`,
  };
}

export function speakerForConversation(db: DatabaseSync, conversation: string): MemorySpeaker | null {
  const identity = db.prepare('SELECT principal, audience FROM conversations WHERE id=?')
    .get(conversation) as unknown as ConversationIdentity | undefined;
  return identity ? resolveSpeaker(db, conversation, identity) : null;
}

export function trustedSpeakerTurn(db: DatabaseSync, source: MemoryTurnSource) {
  const turn = db.prepare(`SELECT u.rowid AS sequence, u.created_at AS at, c.id AS conversation,
    c.principal, c.audience FROM messages u JOIN conversations c ON c.id=u.conversation_id
    WHERE u.id=? AND u.role='user' AND u.status='completed' AND u.author=c.principal
      AND u.author=? AND u.content=?
      AND EXISTS (SELECT 1 FROM messages a WHERE a.conversation_id=c.id AND a.request_id=u.request_id
        AND a.role='assistant' AND a.status='completed')`).get(source.messageId, source.author, source.text) as unknown as TurnRecord | undefined;
  if (!turn) return null;
  const speaker = resolveSpeaker(db, turn.conversation, turn);
  return speaker ? { ...speaker, sequence: turn.sequence, at: turn.at, conversation: turn.conversation } : null;
}
