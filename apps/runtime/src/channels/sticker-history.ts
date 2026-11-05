import type {Target} from './types.js';

const maxTargets=64,maxRecent=8;

// Recency is a reply preference, not a delivery receipt or long-term memory.
export class StickerHistory {
 private targets=new Map<string,string[]>();
 private key(accountId:string,target:Target){return JSON.stringify([accountId,target.kind,target.id]);}
 recent(accountId:string,target:Target):readonly string[]{return [...(this.targets.get(this.key(accountId,target))??[])];}
 record(accountId:string,target:Target,id:string|undefined,status:string){
  if(!id||!['sent','unknown'].includes(status))return;
  const key=this.key(accountId,target),recent=this.targets.get(key)??[];
  this.targets.delete(key);
  this.targets.set(key,[id,...recent.filter(value=>value!==id)].slice(0,maxRecent));
  if(this.targets.size>maxTargets)this.targets.delete(this.targets.keys().next().value!);
 }
}

// Unused candidates first, then the least recently used; callers keep relevance primary.
export function stickerRecency(id:string,recent:readonly string[]){const index=recent.indexOf(id);return index<0?0:recent.length-index;}
