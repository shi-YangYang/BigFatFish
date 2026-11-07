export interface QQConfig { mode?:'managed'|'external'; url:string; accountId:string; ownerId:string; friendIds?:string[]; groupReplyMode?:'all'|'mention'; groups:string[]; enabled:boolean; replyEnabled:boolean; proactiveEnabled:boolean }
export interface Segment {type:'text'|'image'|'record'|'file'|'at'|'reply';data:Record<string,string>}
export interface Target {kind:'private'|'group';id:string}
export interface ConnectionHealth {state:string;error?:string}
export interface QQHost {event:(value:unknown)=>void;status:(state:ConnectionHealth)=>void}
export interface QQConnection {action?(name:QQAction,params:Record<string,unknown>,guard:()=>void):Promise<unknown>;poke?(kind:string,id:string,userId:string,guard:()=>void):Promise<void>;media?(kind:string,file:string,guard:()=>void):Promise<string>;initialize(host:QQHost):void;start(config:QQConfig&{token:string}):void;stop():void;dispose():void;health():ConnectionHealth;send(kind:string,id:string,message:Segment[],guard:()=>void):Promise<{messageId:string}>}
export interface ChannelStatus {config:QQConfig|null;hasToken:boolean;revision:string;health:ConnectionHealth;builtin:true}
export interface SendResult {id:string;status:string}
export interface QQMessageIssue {
  id: number;
  kind: 'reply_failed' | 'send_failed' | 'partial' | 'partial_unknown' | 'unknown' | 'offline' | 'queue_full';
  target?: Target;
  at: string;
}

export type QQAction = 'history_private'|'history_group'|'message'|'recall'|'group_card'|'like'|'reaction'|'profile'|'profile_update'|'avatar'|'posts'|'post'|'space_profile'|'space_update';
