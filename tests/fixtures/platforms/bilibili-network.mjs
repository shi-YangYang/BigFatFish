// Used only via explicit test constructor injection, never loaded by production Runtime.
import { readFileSync } from 'node:fs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
const images={img_url:'https://i0.hdslb.com/bfs/wbi/0123456789abcdef0123456789abcdef.png',sub_url:'https://i0.hdslb.com/bfs/wbi/fedcba9876543210fedcba9876543210.png'};
globalThis.fetch=async(input)=>{
 const u=new URL(input),bvid=u.searchParams.get('bvid')??'BV1234567890';
 if(process.env.BFF_FIXTURE_MODE==='slow')await new Promise(r=>setTimeout(r,60000));
 if(u.pathname.includes('/nav'))return json({code:0,data:{wbi_img:images,isLogin:true,mid:123,uname:'测试账号'}});
 if(u.pathname.includes('/view')&&u.pathname.includes('web-interface'))return json({code:0,data:{title:'测试视频：鱼的海洋',bvid,cid:123,aid:456,duration:9,owner:{name:'测试UP'},stat:{},desc:'海洋知识',pubdate:1}});
 if(u.pathname.includes('search/type'))return json({code:0,data:{result:[{title:'鱼的海洋',bvid:'BV1234567890',author:'测试UP',play:10,duration:'0:09'}]}});
 if(u.pathname.includes('/player/')||u.pathname.includes('/subtitle/web/')){
  if(u.pathname.endsWith('playurl'))return json({code:0,data:{quality:64,durl:[{url:'https://fixture.bilivideo.com/video.mp4'}]}});
  return json({code:0,data:{subtitle:{subtitles:process.env.BFF_FIXTURE_MODE==='no-subs'?[]:[{lan:'ai-zh',subtitle_url:'https://i0.hdslb.com/subtitle.json'}]}}});
 }
 if(u.pathname==='/subtitle.json')return json({body:[{from:0,to:9,content:'海洋里有蓝色的鱼。'}]});
 if(u.pathname==='/video.mp4')return new Response(readFileSync(process.env.BFF_FIXTURE_VIDEO),{headers:{'content-type':'video/mp4'}});
 throw Error('UNEXPECTED_FIXTURE_URL '+u.pathname);
};
