export const kinds = ['fact', 'preference', 'relationship', 'experience', 'interest', 'persona'] as const;
export type MemoryKind = typeof kinds[number];
export type MemoryStatus = 'candidate' | 'confirmed' | 'rejected';
export interface Source { type: 'message' | 'activity' | 'user'; id: string; quote: string; author?: string }
export interface Memory { visibility: 'private' | 'shared'; id: string; kind: MemoryKind; subject: string; content: string; importance: number; status: MemoryStatus; version: number; createdAt: string; updatedAt: string; sources: Source[]; conflicts: string[] }
export interface Activity { id: string; kind: string; sourceId: string; summary: string; occurredAt: string }
export interface MemoryTask { id: string; kind: 'extract' | 'diary'; status: string; modelId: string; result: unknown; error: string | null; createdAt: string }
export interface Diary { id: string; day: string; timezone: string; content: string; sources: Source[]; version: number; modelId: string; updatedAt: string; copyStatus: string }
export interface LifeOverview { persona: import('../ai/types.js').Persona; mood: { mood: string; reason: string } | null; activity: MemoryTask[]; recent: Activity[]; diaries: Diary[]; interests: Memory[]; relationships: Memory[]; chattingCount: number; confirmedCount: number }
