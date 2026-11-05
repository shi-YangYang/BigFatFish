import {ContentScroll} from './Surfaces';
import {deliveryFeedback,deliveryTarget,type QQDelivery} from './qq-feedback';
export function QQDeliveryHistory({items,empty}:{items:QQDelivery[];empty:string}){
 return items.length?<ContentScroll label="消息记录" className="qq-history">{items.map(item=>{const feedback=deliveryFeedback(item);return <div key={item.id} className="qq-delivery-row"><div className="qq-delivery-body"><strong>{feedback.label}</strong><span className="muted">{deliveryTarget(item.target)}</span>{feedback.detail&&<p className="qq-delivery-reason">{feedback.detail}</p>}</div><time>{new Date(item.createdAt).toLocaleString()}</time></div>;})}</ContentScroll>:<p className="muted">{empty}</p>;
}
