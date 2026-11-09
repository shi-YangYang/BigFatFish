import {useCallback,useEffect,useRef,useState} from 'react';
import {api} from '../../../api/client';
import {Alert,Card,Loading} from '../../../components/Surfaces';
import {ActionRow,Button,Checkbox,Field,Select} from '../../../components/Controls';
import type {SelfOptions} from '../../../../../runtime/src/channels/action-state';
import {connectionErrorCode,connectionReadMessage} from '../connection-errors';
export function QQSelfActivity(){
 const [value,setValue]=useState<SelfOptions>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false),[unconfigured,setUnconfigured]=useState(false),[loading,setLoading]=useState(true);
 const alive=useRef(true),pending=useRef(false);
 const load=useCallback(async()=>{if(pending.current)return;pending.current=true;setLoading(true);setError('');setUnconfigured(false);try{const v=await api<SelfOptions>('/v1/channels/qq/self-options');if(alive.current)setValue(v);}catch(error){if(alive.current){if(connectionErrorCode(error)==='CHANNEL_NOT_CONFIGURED')setUnconfigured(true);else setError(connectionReadMessage(error,'暂时无法读取设置，请重试。'));}}finally{pending.current=false;if(alive.current)setLoading(false);}},[]);
 useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;};},[load]);
 const save=async()=>{if(!value||pending.current)return;pending.current=true;setBusy(true);setError('');setSaved(false);try{const next=await api<SelfOptions>('/v1/channels/qq/self-options','PUT',value);if(alive.current){setValue(next);setSaved(true);}}catch(error){if(alive.current)setError(connectionReadMessage(error,'设置未保存，请重试。'));}finally{pending.current=false;if(alive.current)setBusy(false);}};
 return <Card><h3>自主活动</h3>{error&&<Alert>{error}{!value&&<Button size="compact" busy={loading} onClick={()=>void load()}>重试</Button>}</Alert>}{unconfigured&&<p className="muted">连接并设置 QQ 后可使用自主活动</p>}{loading&&!value&&<Loading/>}{value&&<form onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={busy||loading}>
 <Field className="check"><Checkbox checked={value.profile} onCheckedChange={profile=>{setSaved(false);setValue({...value,profile});}}/>自己更新头像和资料</Field>
 <Field className="check"><Checkbox checked={value.posts} onCheckedChange={posts=>{setSaved(false);setValue({...value,posts});}}/>自己发说说</Field>
 <Field>说说可见范围<Select value={value.visibility} onValueChange={visibility=>{setSaved(false);setValue({...value,visibility:visibility as SelfOptions['visibility']});}}><option value="friends">好友可见</option><option value="self">仅自己可见</option><option value="public">所有人可见</option></Select></Field>
 <ActionRow><Button type="submit" variant="primary" busy={busy}>{busy?'正在保存…':'保存设置'}</Button>{saved&&<span role="status">已保存</span>}</ActionRow>
 </fieldset></form>}</Card>;
}
