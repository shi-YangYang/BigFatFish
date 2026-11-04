import {useEffect,useRef,useState} from 'react';
import {api} from '../api';
import {Card,Disclosure,Loading} from './Surfaces';
import {ActionRow,Button,Checkbox,Field,FormGrid,Input} from './Controls';
import type {StickerInfo} from '../../../runtime/src/channels/stickers';
const endpoint='/v1/channels/qq/stickers';
type Options={networkEnabled:boolean;revision:string};
export function QQStickers({fail}:{fail:(e:unknown)=>void}){
 const [open,setOpen]=useState(false);
 return <Card className="qq-stickers"><Disclosure title="表情" open={open} onOpenChange={setOpen}>{open&&<StickerManager fail={fail}/>}</Disclosure></Card>;
}
function StickerManager({fail}:{fail:(e:unknown)=>void}){
 const [items,setItems]=useState<StickerInfo[]>(),[options,setOptions]=useState<Options>(),[adding,setAdding]=useState(false),[name,setName]=useState(''),[description,setDescription]=useState(''),[file,setFile]=useState<File>(),[busy,setBusy]=useState(false);
 const pending=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;void Promise.all([api<StickerInfo[]>(endpoint),api<Options>('/v1/channels/qq/sticker-options')]).then(([list,opts])=>{if(alive.current){setItems(list);setOptions(opts);}}).catch(fail);return()=>{alive.current=false;};},[fail]);
 const act=async(action:()=>Promise<unknown>)=>{if(pending.current)return;pending.current=true;setBusy(true);try{await action();const [list,opts]=await Promise.all([api<StickerInfo[]>(endpoint),api<Options>('/v1/channels/qq/sticker-options')]);if(alive.current){setItems(list);setOptions(opts);}}catch(e){fail(e);}finally{pending.current=false;if(alive.current)setBusy(false);}};
 const upload=async()=>{if(!file)throw new Error('STICKER_FILE_REQUIRED');if(file.size>2_000_000)throw new Error('STICKER_FILE_TOO_LARGE');const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('INVALID_STICKER_IMAGE'));reader.onload=()=>resolve(String(reader.result).split(',')[1]??'');reader.readAsDataURL(file);});await api(endpoint,'POST',{name,description,data});if(alive.current){setAdding(false);setName('');setDescription('');setFile(undefined);}};
 return <div className="sticker-manager">
  <div className="sticker-toolbar"><Field className="check"><Checkbox checked={options?.networkEnabled??false} disabled={busy||!options} onCheckedChange={networkEnabled=>void act(()=>api('/v1/channels/qq/sticker-options','PUT',{...options,networkEnabled}))}/>网络表情</Field><a href="https://aigengtu.com/" target="_blank" rel="noreferrer">梗鲸</a><Button disabled={busy} onClick={()=>setAdding(!adding)}>{adding?'取消添加':'添加图片'}</Button></div>
  {adding&&<form className="sticker-add" onSubmit={e=>{e.preventDefault();void act(upload);}}><fieldset disabled={busy}>
   <Field>图片<Input type="file" accept="image/png,image/jpeg" onChange={e=>setFile(e.target.files?.[0])}/></Field>
   <FormGrid><Field>名称<Input required maxLength={40} value={name} onChange={e=>setName(e.target.value)}/></Field><Field>适用场景<Input maxLength={200} placeholder="例如：开心、求夸夸" value={description} onChange={e=>setDescription(e.target.value)}/></Field></FormGrid>
   <ActionRow><span className="muted">PNG、JPG，最大 2 MB</span><Button type="submit" variant="primary" disabled={!file}>添加</Button></ActionRow>
  </fieldset></form>}
  {!items?<Loading/>:items.length?<div className="sticker-grid">{items.map(item=><div className="sticker-item" key={item.id}>
   <StickerPreview item={item}/><div className="sticker-caption"><strong>{item.name}</strong><span className="muted">{item.description||'自定义表情'}</span></div>
   <div className="sticker-item-actions"><Field className="check"><Checkbox checked={item.enabled} disabled={busy} onCheckedChange={enabled=>void act(()=>api(endpoint+'/'+encodeURIComponent(item.id),'PUT',{revision:item.revision,enabled}))}/>启用</Field>{!item.builtin&&<Button size="compact" variant="ghost" disabled={busy} aria-label={'删除'+item.name} onClick={()=>void act(()=>api(endpoint+'/'+encodeURIComponent(item.id),'DELETE'))}>删除</Button>}</div>
  </div>)}</div>:<p className="muted">还没有本地表情</p>}
 </div>;
}
function StickerPreview({item}:{item:StickerInfo}){
 const [src,setSrc]=useState(''),[failed,setFailed]=useState(false);
 useEffect(()=>{let alive=true;void api<{data:string;mimeType:string}>(endpoint+'/'+encodeURIComponent(item.id)+'/image').then(image=>{if(alive)setSrc('data:'+image.mimeType+';base64,'+image.data);}).catch(()=>{if(alive)setFailed(true);});return()=>{alive=false;};},[item.id]);
 return <div className="sticker-preview">{src?<img src={src} alt={item.name}/>:<span className="muted">{failed?'图片未加载':'加载中…'}</span>}</div>;
}
