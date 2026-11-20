// Only the fixed gallery is searched. Conversation text is never sent as a web request.
const segmenter=new Intl.Segmenter('zh',{granularity:'word'});
const filler=new Set('我 你 它 她 他 想 一个 一下 一张 有点 有点儿 这种 那种 有些 给 找 来 发 要 帮 很 又 太 特别 现在 表情 表情包 反应 图片 适合 那个 这个 大肥鱼'.split(' '));
const moods=[
 ['开心','高兴','快乐','喜悦','乐开花','笑嘻嘻','笑容','笑脸','大笑','笑死','笑出声','笑得','哈哈','嘿嘿'],
 ['委屈','难过','伤心','哭泣','泪目','眼泪','呜呜'],['无语','沉默','语塞','愣住','呆住','卡壳'],
 ['害羞','脸红','羞涩','不好意思'],['撒娇','卖萌','贴贴','蹭蹭'],['生气','气鼓鼓','炸毛','恼火'],
 ['惊讶','震惊','惊呆','目瞪口呆'],['疑惑','困惑','问号','不解'],['庆祝','欢呼','撒花','庆贺'],
 ['得意','骄傲','自豪','嘚瑟'],['困倦','犯困','打哈欠','好困','睡觉','晚安'],
];
export function searchTerms(query:string):string[][]{
 const text=query.normalize('NFKC').toLowerCase().replaceAll('不开心','难过').replaceAll('不高兴','难过');
 const groups=moods.filter(words=>words.some(w=>text.includes(w)));
 const words=Array.from(segmenter.segment(text)).filter(p=>p.isWordLike).map(p=>p.segment);
 const terms=[...new Set(words.filter(w=>w.length>=2&&!filler.has(w)&&!groups.some(g=>g.some(a=>a.includes(w)||w.includes(a)))))].slice(0,12);
 if(!groups.length&&!terms.length&&text.trim().length===1)terms.push(text.trim());
 return [...groups,...terms.map(t=>[t])];
}

// Covering more ideas beats merely repeating one of them in a label. The same
// scale is used for local names/notes and gallery titles/captions.
export function stickerMatch(terms:readonly string[][],title:string,body:string){
 let covered=0,weight=0;
 for(const group of terms){const hit=group.some(w=>title.includes(w))?3:group.some(w=>body.includes(w))?1:0;if(hit){covered++;weight+=hit;}}
 return covered*100+weight;
}
