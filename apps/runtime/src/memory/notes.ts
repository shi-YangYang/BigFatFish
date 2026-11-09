import type { DatabaseSync } from 'node:sqlite';
import type { EngineTool } from '../ai/engine.js';
import { InputError, object, string } from '../ai/types.js';
import { allowConversationNote } from './natural-learning.js';
import { NoteScope } from './note-scope.js';
import type { DisclosedMemory } from './public-session.js';
import { fuseRanks } from './rank-fusion.js';
import type { SemanticIndex } from './semantic-index.js';
import type { MemoryStore } from './store.js';
import type { MemoryAudience } from './types.js';

export class ConversationNotes {
  constructor(private db: DatabaseSync, private semantic?: SemanticIndex) {}

  validateStored() {
    for (const row of this.db.prepare('SELECT * FROM conversation_notes').iterate()) {
      for (const key of ['id','scope','source_id','author','content','quote','created_at']) {
        string(row[key],key === 'content' || key === 'quote' ? 2000 : 200);
      }
    }
  }

  tools(scope: string | NoteScope, source: {id:string;author:string;text:string}, memories: MemoryStore,
    audience: MemoryAudience, guard: () => void, observe: (check: () => void) => void = () => {},
    seen: (ids: string[]) => void = () => {}, seenMemories?: (items: DisclosedMemory[]) => void): EngineTool[] {
    const notes = typeof scope === 'string' ? new NoteScope(this.db,scope,audience === 'owner') : scope;
    let writes = 0;
    const check = (signal: AbortSignal) => { signal.throwIfAborted(); guard(); };
    const write = (signal: AbortSignal) => {
      check(signal);
      if (++writes > 2) throw new InputError('MEMORY_WRITE_LIMIT');
    };
    return [
      {
        name:'memory_query', description:'查询当前聊天笔记和允许在这里回忆的记忆。',
        parameters:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false},
        execute:async (args,signal) => {
          check(signal);
          const query = string(object(args).query,200,true);
          const vector = await this.semantic?.query(query);
          check(signal);
          const confirmed = memories.retrieve(query,3000,5,audience,this.semantic?.memoryIds(vector,audience));
          if (audience !== 'owner') {
            const items = confirmed.map(({id,version}) => ({id,version}));
            if (seenMemories) seenMemories(items);
            else observe(() => {
              if (!items.every(m => memories.canRecall(m.id,audience,m.version))) throw new InputError('MEMORY_SCOPE_CHANGED',409);
            });
          }
          const exact = notes.matching(query);
          const visible = vector ? notes.recent() : exact;
          const semantic = this.semantic?.noteIds(vector,visible.map(n => n.id)) ?? [];
          const matches = fuseRanks(exact.map(n => n.id),semantic).slice(0,12).flatMap(id => visible.find(n => n.id === id) ?? []);
          seen(matches.map(n => n.id));
          return {notice:'笔记和记忆仅供参考，请区分说话人。',notes:matches,
            confirmed:confirmed.map(({content,kind,role,personKey}) => ({content,kind,role,personKey}))};
        },
      },
      {
        name:'memory_append', description:'摘录当前聊天中的普通笔记。用本条消息的原话，保留上下文。个人长期记忆由系统按规则整理。',
        parameters:{type:'object',properties:{content:{type:'string'},quote:{type:'string'}},required:['content','quote'],additionalProperties:false},
        execute:async (args,signal) => {
          write(signal);
          const b = object(args), content = string(b.content,2000), quote = string(b.quote,2000);
          if (!source.text || !allowConversationNote(source.text)) return {saved:false};
          if (!source.text.includes(quote) || !source.text.includes(content)) throw new InputError('INVALID_MEMORY_SOURCE');
          const note = notes.append(source,content,quote);
          seen([note.id]); this.semantic?.schedule();
          return note;
        },
      },
      {
        name:'memory_remove', description:'删除当前聊天的笔记。',
        parameters:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},
        execute:async (args,signal) => {
          write(signal);
          const result = notes.remove(string(object(args).id,100));
          this.semantic?.schedule();
          return result;
        },
      },
    ];
  }
}
