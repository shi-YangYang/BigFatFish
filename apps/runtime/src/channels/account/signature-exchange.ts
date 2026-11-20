// A second turn may resolve the target of a signature request, never supply an
// old value. No transcript lookup or persisted grant: each inbound turn consumes
// the preceding slot, including turns that queue while a reply is in flight.
export interface Exchange {request:string;reply:string}
export interface SignatureTurn {
  previous:()=>Exchange|undefined;
  delivered:(request:string,reply:string)=>void;
}
interface Slot {binding:string;pair?:Exchange;expires:number;timer?:NodeJS.Timeout}
export class SignatureExchanges {
  private rooms=new Map<string,Slot>();
  constructor(private now:()=>number=Date.now){}
  clear(room?:string){
    if(room===undefined){for(const slot of this.rooms.values())clearTimeout(slot.timer);this.rooms.clear();}
    else{clearTimeout(this.rooms.get(room)?.timer);this.rooms.delete(room);}
  }
  begin(room:string,binding:string):SignatureTurn {
    const before=this.rooms.get(room);
    clearTimeout(before?.timer);
    const slot:Slot={binding,expires:0};
    this.rooms.set(room,slot);
    return {
      previous:()=>this.rooms.get(room)===slot&&before?.binding===binding&&this.now()<before.expires?before.pair:undefined,
      delivered:(request,reply)=>{
        if(this.rooms.get(room)!==slot||!request.trim()||request.length>750||!reply.trim()||reply.length>400)return;
        slot.pair={request,reply};slot.expires=this.now()+120_000;
        slot.timer=setTimeout(()=>{if(this.rooms.get(room)===slot)this.clear(room);},120_000).unref();
      }
    };
  }
}
const phrases=new Map([
  ['平静','慢慢游，今天的水温刚刚好。'],['开心','开心得冒泡，尾巴都摆快啦！'],
  ['期待','探出脑袋，等一件好事发生。'],['温暖','心里暖洋洋的，分你一个小气泡。'],
  ['委屈','先吐个小泡泡，慢慢就好啦。'],['低落','今天游慢一点，也没关系。'],
  ['疲惫','收起小鱼鳍，歇一会儿。']
]);
// Neither a model-supplied phrase nor the reason/evidence for a mood can leak.
export function publicMoodSignature(label:string){return phrases.get(label);}
