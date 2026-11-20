export function startWebSocketPolicy(onDenied:()=>void,onFailure:()=>void):Promise<{
 args:string[];
 close():Promise<void>;
}>;
