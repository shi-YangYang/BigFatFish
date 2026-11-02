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
 const connect=useCallback(async()=>{try{await invoke('runtime_status');await reload();setConnected(true);setError('');}catch(e){setConnected(false);fail(e);}},[reload,fail]);
 useEffect(()=>{void connect();},[connect]);
 return <div className="app"><header><h1>BigFatFish</h1><span>{connected?'已连接':'未连接'}</span><button onClick={()=>void connect()}>刷新连接</button></header><nav>{['主页','聊天','生活','记忆','人格','模型','渠道','B站','权限'].map(item=><button className={page===item?'active':''} key={item} onClick={()=>{setPage(item);setError('');}}>{item}</button>)}</nav>{error&&<div className="error" role="alert">{error}<button onClick={()=>setError('')}>关闭</button></div>}<main>{connected?(page==='B站'?<Bilibili fail={fail}/>:page==='渠道'?<Channels fail={fail}/>:page==='权限'?<Permissions fail={fail}/>:page==='主页'?<Home/>:page==='生活'?<Life fail={fail}/>:page==='记忆'?<Memories fail={fail}/>:page==='聊天'?<Chat models={models} fail={fail}/>:page==='模型'?<Models models={models} reload={reload} fail={fail}/>:<Personality fail={fail}/>):<p>启动服务后，点击「刷新连接」。</p>}</main></div>;
}
