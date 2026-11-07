import {useEffect,useState} from 'react';
import {api} from '../../../api/client';
import {Alert,Card,Loading} from '../../../components/Surfaces';
import {ActionRow,Button,Checkbox,Field,Select} from '../../../components/Controls';
import type {SelfOptions} from '../../../../../runtime/src/channels/action-state';
export function QQSelfActivity(){
 const [value,setValue]=useState<SelfOptions>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false),[unconfigured,setUnconfigured]=useState(false);
 useEffect(()=>{let active=true;api<SelfOptions>('/v1/channels/qq/self-options').then(v=>{if(active)setValue(v);}).catch(error=>{if(active){if(error instanceof Error&&error.message==='CHANNEL_NOT_CONFIGURED')setUnconfigured(true);else setError('暂时无法读取设置，请重新打开后重试。');}});return()=>{active=false;};},[]);
 const save=async()=>{if(!value)return;setBusy(true);setError('');setSaved(false);try{setValue(await api<SelfOptions>('/v1/channels/qq/self-options','PUT',value));setSaved(true);}catch{setError('设置未保存，请重新打开后重试。');}finally{setBusy(false);}};
 return <Card><h3>自主活动</h3>{error&&<Alert>{error}</Alert>}{unconfigured&&<p className="muted">连接并设置 QQ 后可使用自主活动</p>}{!value&&!error&&!unconfigured&&<Loading/>}{value&&<form onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={busy}>
 <Field className="check"><Checkbox checked={value.profile} onCheckedChange={profile=>{setSaved(false);setValue({...value,profile});}}/>自己更新头像和资料</Field>
 <Field className="check"><Checkbox checked={value.posts} onCheckedChange={posts=>{setSaved(false);setValue({...value,posts});}}/>自己发说说</Field>
 <Field>说说可见范围<Select value={value.visibility} onValueChange={visibility=>{setSaved(false);setValue({...value,visibility:visibility as SelfOptions['visibility']});}}><option value="friends">好友可见</option><option value="self">仅自己可见</option><option value="public">所有人可见</option></Select></Field>
 <ActionRow><Button type="submit" variant="primary">{busy?'正在保存…':'保存设置'}</Button>{saved&&<span role="status">已保存</span>}</ActionRow>
 </fieldset></form>}</Card>;
}
