import type {inbound} from './protocol.js';
import type {QQConfig} from './types.js';

export interface GroupSource {text:string;owner:boolean;images:number}
// This is a provenance check, not an intent classifier. Never infer permission
// from names, quotations, previous turns, OCR or a model-supplied account ID.
export function groupSource(event:NonNullable<ReturnType<typeof inbound>>,config:QQConfig):GroupSource|undefined{
  if(event.target.kind!=='group'||!config.groups.includes(event.target.id)||!event.identity||
    event.identity.author!==event.author||event.identity.replyToMessageId||
    !event.parts.every(p=>p.type==='text'||p.type==='image'&&!!p.data.file||p.type==='at'&&p.data.qq===config.accountId))return;
  const text=event.parts.filter(p=>p.type==='text').map(p=>p.data.text).join('').trim();
  const images=event.parts.filter(p=>p.type==='image').length;
  if(!text||text.length>750||text.toUpperCase().includes('[CQ:')||images>2)return;
  return {text,owner:event.author===config.ownerId,images};
}
