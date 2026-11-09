import {useEffect,useRef,useState} from 'react';
import {api} from '../../api/client';
import {errorText} from '../../api/errors';
import {ActionRow,Button,Checkbox,Field,FormGrid,Input,Select} from '../../components/Controls';
import {Disclosure} from '../../components/Surfaces';
import type {DiaryOptions} from '../../../../runtime/src/memory/diary-auto';

type Status=DiaryOptions & {last:{day:string;status:string;error:string|null}|null};
export function DiarySettings({fail}:{fail:(error:unknown)=>void}){
 const [data,setData]=useState<Status>(),[loadError,setLoadError]=useState(''),[unavailable,setUnavailable]=useState(false),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
 const [hour,setHour]=useState(23),[zone,setZone]=useState('');const dirty=useRef(false),saving=useRef(false);
 useEffect(()=>{let active=true,timer:ReturnType<typeof setTimeout>;const load=async()=>{try{const value=await api<Status>('/v1/diary-options');if(active&&!saving.current){setData(value);setLoadError('');setUnavailable(false);if(!dirty.current){setHour(value.hour);setZone(value.timezone);}}}catch(error){if(active){const code=error instanceof Error?error.message:String(error);setUnavailable(/404|NOT_FOUND|Route .*not found/i.test(code));setLoadError(errorText(error));}}finally{if(active)timer=setTimeout(()=>void load(),30_000);}};void load();return()=>{active=false;clearTimeout(timer);};},[retry]);
 const save=async(enabled:boolean,useDraft=true)=>{if(!data||saving.current)return;saving.current=true;setBusy(true);try{const value=await api<Status>('/v1/diary-options','PUT',{enabled,hour:useDraft?hour:data.hour,timezone:useDraft?zone:data.timezone,revision:data.revision});setData(value);if(useDraft){dirty.current=false;setHour(value.hour);setZone(value.timezone);}}catch(error){fail(error);}finally{saving.current=false;setBusy(false);}};
 if(loadError&&!data)return <ActionRow><span className="muted">{unavailable?'自动日记需要重启新版后台后使用。':loadError}</span><Button size="compact" variant="ghost" onClick={()=>setRetry(value=>value+1)}>重试</Button></ActionRow>;
 if(!data)return null;
 return <div className="form-stack"><div className="diary-auto-toolbar"><Field className="check"><Checkbox checked={data.enabled} disabled={busy} onCheckedChange={enabled=>void save(enabled,false)}/>自动写日记</Field><span className="muted">{data.enabled?`每天 ${String(data.hour).padStart(2,'0')}:00`:'已暂停'}</span></div>
 <Disclosure title="日记设置" className="secondary-options"><FormGrid><Field>写日记的时间<Select value={String(hour)} onValueChange={value=>{dirty.current=true;setHour(Number(value));}}>{Array.from({length:24},(_,hour)=><option key={hour} value={hour}>{String(hour).padStart(2,'0')}:00</option>)}</Select></Field><Field>时区<Input value={zone} onChange={e=>{dirty.current=true;setZone(e.target.value);}}/></Field></FormGrid><ActionRow><Button disabled={busy} onClick={()=>void save(data.enabled)}>保存</Button></ActionRow><p className="muted">使用聊天模型整理当天经历，会消耗少量额度。</p></Disclosure>
 {loadError&&<p className="muted">{loadError}</p>}
 {data.last&&['failed','retry'].includes(data.last.status)&&<p className="muted">{data.last.day} 的日记暂未写成，{data.last.status==='retry'?'稍后重试。':'可以手动补写。'}</p>}
 </div>;
}
