export interface QQConfig { url:string; accountId:string; ownerId:string; groups:string[]; enabled:boolean; replyEnabled:boolean; proactiveEnabled:boolean }
export interface Segment {type:'text'|'image'|'record'|'file'|'at'|'reply';data:Record<string,string>}
export interface Target {kind:'private'|'group';id:string}
export interface PluginHealth {state:string;error?:string}
export interface Plugin {media?(kind:string,file:string,guard:()=>void):Promise<string>;initialize(host:{event:(value:unknown)=>void;status:(state:PluginHealth)=>void}):void;start(config:QQConfig&{token:string}):void;stop():void;dispose():void;health():PluginHealth;send(kind:string,id:string,message:Segment[],guard:()=>void):Promise<{messageId:string}>}
export interface ChannelStatus {config:QQConfig|null;hasToken:boolean;revision:string;health:PluginHealth;manifest:Record<string,unknown>}
export interface Approval {id:string;payload:{target:Target;segments:Segment[]};digest:string;expiresAt:number;status:string}
