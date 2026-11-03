import { Setup, Backup, Updates } from './components/Setup';
import { Douyin, Activities, DouyinApprovals } from './components/Douyin';
import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { api, errorText } from './api';
import { Home, Life } from './components/Life';
import { Memories } from './components/Memories';
import { Channels, Permissions } from './components/Channels';
import { Bilibili } from './components/Bilibili';
import { Chat } from './components/Chat';
import { Models } from './components/Models';
import { Personality } from './components/Personality';
import type { ModelConfig } from '../../runtime/src/ai/types';
export default function App(){
 const [page,setPage]=useState('主页'),[error,setError]=useState(''),[connected,setConnected]=useState(false),[models,setModels]=useState<(ModelConfig&{hasKey:boolean})[]>([]);
 const fail=useCallback((e:unknown)=>setError(errorText(e)),[]);
 const reload=useCallback(async()=>{setModels(await api('/v1/models'));},[]);
 const connect=useCallback(async()=>{try{await invoke('runtime_status');await reload();setConnected(true);setError('');return true;}catch(e){setConnected(false);fail(e);return false;}},[reload,fail]);
 useEffect(()=>{let cancelled=false;let timer:ReturnType<typeof setTimeout>|undefined;const attempt=async(count:number)=>{const ready=await connect();if(!cancelled&&!ready&&count<20)timer=setTimeout(()=>void attempt(count+1),500);};void invoke<{complete:boolean}>('desktop_settings').then(settings=>{if(settings.complete)void attempt(0);else void connect();}).catch(fail);return()=>{cancelled=true;if(timer)clearTimeout(timer);};},[connect,fail]);
 return <div className="app"><header><h1>BigFatFish</h1><span>{connected?'已连接':'未连接'}</span><button onClick={()=>void connect()}>刷新连接</button></header><nav>{['主页','聊天','生活','记忆','人格','模型','渠道','B站','抖音','任务','权限','设置','备份','更新'].map(item=><button className={page===item?'active':''} key={item} onClick={()=>{setPage(item);setError('');}}>{item}</button>)}</nav>{error&&<div className="error" role="alert">{error}<button onClick={()=>setError('')}>关闭</button></div>}<main>{page==='更新'?<Updates fail={fail}/>:page==='设置'?<Setup fail={fail} done={()=>{void connect();}}/>:page==='备份'?<Backup fail={fail}/>:connected?(page==='抖音'?<Douyin fail={fail}/>:page==='任务'?<Activities fail={fail}/>:page==='B站'?<Bilibili fail={fail}/>:page==='渠道'?<Channels fail={fail}/>:page==='权限'?<><Permissions fail={fail}/><DouyinApprovals fail={fail}/></>:page==='主页'?<Home navigate={setPage}/>:page==='生活'?<Life fail={fail}/>:page==='记忆'?<Memories fail={fail}/>:page==='聊天'?<Chat models={models} fail={fail}/>:page==='模型'?<Models models={models} reload={reload} fail={fail}/>:<Personality fail={fail}/>):<Setup fail={fail} done={()=>{setPage('模型');void connect();}}/>}</main></div>;
}
