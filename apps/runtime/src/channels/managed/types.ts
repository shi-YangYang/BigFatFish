export type ComponentPhase = 'missing'|'installing'|'ready'|'starting'|'login'|'verifying'|'online'|'stopping'|'error';
export interface QQContact {id:string;name:string}
export interface ManagedQQStatus { phase:ComponentPhase; supported:boolean; engine:'docker'|'native'; version:string; error?:string; operationError?:string; account?:QQContact; qr?:string; loginPhase?:string; busy:boolean }
export interface ManagedState { id:string; webToken:string; botToken:string; webPort:number; botPort:number; installed:boolean }
