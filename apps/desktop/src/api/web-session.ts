let csrf='',sessionGeneration=0;
let webSession={ready:false,error:''};
const sessionListeners=new Set<()=>void>();
export const getWebSession=()=>webSession;
export const subscribeWebSession=(listener:()=>void)=>{sessionListeners.add(listener);return()=>{sessionListeners.delete(listener);};};
function setWebSession(ready:boolean,error=''){
 sessionGeneration++;if(!ready)csrf='';webSession={ready,error};for(const listener of sessionListeners)listener();
}
export async function webRequest<T>(route:string,method='GET',body?:unknown):Promise<T>{
 // A new login supersedes requests belonging to the previous session, including startup probes.
 const generation=route==='/auth/login'?++sessionGeneration:sessionGeneration;
 const r=await fetch(route,{method,headers:{'content-type':'application/json','x-bff-csrf':csrf},credentials:'same-origin',...(!['GET','DELETE'].includes(method)?{body:JSON.stringify(body??{})}:{})});
 const data=await r.json();
 if(generation!==sessionGeneration)throw new Error('WEB_SESSION_CHANGED');
 if(!r.ok){if(r.status===401&&data.error==='WEB_LOGIN_REQUIRED')setWebSession(false,'WEB_LOGIN_REQUIRED');throw new Error(data.error??'UNAVAILABLE');}
 if(route==='/auth/logout')setWebSession(false);
 else if((route==='/auth/session'||route==='/auth/login')&&typeof data.csrf==='string'){csrf=data.csrf;setWebSession(true);}
 return data as T;
}
