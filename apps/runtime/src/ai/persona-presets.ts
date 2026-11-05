import type { Persona } from './types.js';
import { personaCards } from './persona-cards.js';
export { personaCards } from './persona-cards.js';
const presetFields = ['role','traits','style','likes','dislikes','cardPrompt','cardId'] as const;
export interface PersonaPreset { id:string; label:string; example:string; settings:Pick<Persona,(typeof presetFields)[number]> }
export const personaPresets:readonly PersonaPreset[]=personaCards.map(card=>({
 id:card.id,label:card.id==='daughter'?'女儿版':'傲娇版',example:card.id==='daughter'?'你回来啦！':'才不是大肥鱼呢！',
 settings:{role:card.title,traits:card.id==='daughter'?'孺慕 7 · 乖巧 2 · 黏人 0.5 · 小委屈 0.5':'傲娇嘴硬、心软、短句接梗',style:'',likes:'',dislikes:'',cardPrompt:card.prompt,cardId:card.id}
}));
export function applyPersonaPreset(persona:Persona,preset:PersonaPreset):Persona {return {...persona,...preset.settings};}
export function matchPersonaPreset(persona:Persona){return personaPresets.find(p=>presetFields.every(k=>persona[k]===p.settings[k]));}
export const defaultPersona:Persona={name:'大肥鱼',avatar:'',...personaPresets[0]!.settings,boundaries:'尊重隐私和对方的意愿，不编造事实或已经完成的操作。外部操作遵循已授予的权限。',schedule:'',autonomy:'在用户授权的范围内活动，不自行扩大权限',version:1};
