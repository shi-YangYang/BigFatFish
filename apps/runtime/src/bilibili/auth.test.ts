import { it, expect } from 'vitest';
import { loadBilibili } from './upstream.js';
it('uses original QrAuth for scanned/success/expiry and verifies actual isLogin/mid before save',async()=>{
 const {QrAuth,verifyAccount}=await loadBilibili();let now=10000,logged=true,phase=86090,saved=false;
 const credentials={sessdata:'test-session-123456789012',bili_jct:'a'.repeat(32),buvid3:''};
 const fetcher=async(input:string)=>{const u=new URL(input);const headers=new Headers({'content-type':'application/json'});headers.append('set-cookie',`SESSDATA=${credentials.sessdata}; Path=/`);headers.append('set-cookie',`bili_jct=${credentials.bili_jct}; Path=/`);return new Response(JSON.stringify({code:0,data:u.pathname.endsWith('/generate')?{url:'https://passport.bilibili.com/login',qrcode_key:'test'}:u.pathname.endsWith('/poll')?{code:phase}:{isLogin:logged,mid:42,uname:'账号'}}),{headers});};
 const qr=new QrAuth({fetch:fetcher,now:()=>now,save:async(c:unknown)=>{const a=await verifyAccount(c,{fetch:fetcher});saved=true;return a;}});
 const start=await qr.start();expect(start.image).toMatch(/^data:image\/png;base64,/);now+=2001;expect((await qr.poll(start.id)).status).toBe('scanned');phase=0;now+=2001;expect((await qr.poll(start.id)).status).toBe('success');expect(saved).toBe(true);logged=false;await expect(verifyAccount(credentials,{fetch:fetcher})).rejects.toThrow();
 now+=2001;const next=await qr.start();now+=180001;expect((await qr.poll(next.id)).status).toBe('expired');qr.dispose();await expect(qr.start()).rejects.toThrow();
});
