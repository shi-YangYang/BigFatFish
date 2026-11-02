import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { api, errorText } from './api';
import { Chat } from './components/Chat';
import { Models } from './components/Models';
import { Personality } from './components/Personality';
import type { ModelConfig } from '../../runtime/src/ai/types';
export default function App(){
 const [page,setPage]=useState('聊天'),[error,setError]=useState(''),[connected,setConnected]=useState(false),[models,setModels]=useState<(ModelConfig&{hasKey:boolean})[]>([]);
 const fail=useCallback((e:unknown)=>setError(errorText(e)),[]);
 const reload=useCallback(async()=>{setModels(await api('/v1/models'));},[]);
 const connect=useCallback(async()=>{try{await invoke('runtime_status');await reload();setConnected(true);setError('');}catch(e){setConnected(false);fail(e);}},[reload,fail]);
 useEffect(()=>{void connect();},[connect]);
 return <div className="app"><header><h1>BigFatFish</h1><span>{connected?'已连接':'未连接'}</span><button onClick={()=>void connect()}>刷新连接</button></header><nav>{['聊天','人格','模型'].map(item=><button className={page===item?'active':''} key={item} onClick={()=>{setPage(item);setError('');}}>{item}</button>)}</nav>{error&&<div className="error" role="alert">{error}<button onClick={()=>setError('')}>关闭</button></div>}<main>{connected?(page==='聊天'?<Chat models={models} fail={fail}/>:page==='模型'?<Models models={models} reload={reload} fail={fail}/>:<Personality fail={fail}/>):<p>启动服务后，点击「刷新连接」。</p>}</main></div>;
}
