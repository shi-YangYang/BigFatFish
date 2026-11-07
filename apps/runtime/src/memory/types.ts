export const kinds = ['fact', 'preference', 'relationship', 'experience', 'interest', 'persona'] as const;
export type MemoryKind = typeof kinds[number];
export type MemoryStatus = 'candidate' | 'confirmed' | 'rejected';
export interface Source { type: 'message' | 'activity' | 'user'; id: string; quote: string; author?: string }
export const attributionRoles = ['owner', 'other', 'general', 'unassigned'] as const;
export interface MemoryAttribution { role: typeof attributionRoles[number]; personKey: string; scopeKey: string }
export const canShareMemory = (actor: MemoryAttribution) =>
  actor.role === 'general' || (actor.role === 'owner' && actor.scopeKey === 'owner');
export type MemoryAudience = string | { scopeKey: string; personKey?: string };
export interface Memory extends MemoryAttribution { visibility: 'private' | 'shared'; id: string; kind: MemoryKind; subject: string; content: string; importance: number; status: MemoryStatus; version: number; createdAt: string; updatedAt: string; sources: Source[]; conflicts: string[] }
export interface Activity { id: string; kind: string; sourceId: string; summary: string; occurredAt: string }
export interface MemoryTask { id: string; kind: 'extract' | 'diary'; status: string; modelId: string; result: unknown; error: string | null; createdAt: string }
export interface Diary { id: string; day: string; timezone: string; content: string; sources: Source[]; version: number; modelId: string; updatedAt: string; copyStatus: string }
export interface LifeOverview { persona: import('../ai/types.js').Persona; mood: { mood: string; reason: string } | null; activity: MemoryTask[]; recent: Activity[]; diaries: Diary[]; interests: Memory[]; relationships: Memory[]; chattingCount: number; confirmedCount: number }

export interface ProfileEntry extends MemoryAttribution {
  key: string; label: string; value: string; asOf: string; memoryId: string; version: number;
  source: Pick<Source,'type'|'id'>;
}

export interface SceneFact extends MemoryAttribution {
  id: string; version: number; subject: string; content: string;
}
export interface MemoryScene extends MemoryAttribution {
  id: string; title: string; summary: string; updatedAt: string; members: SceneFact[];
}
