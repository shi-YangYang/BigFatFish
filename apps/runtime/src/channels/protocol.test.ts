import { expect,it } from 'vitest';
import { configuration,inbound,segments,stableId } from './protocol.js';
const config={url:'ws://127.0.0.1:3001',accountId:'1',ownerId:'2',groups:['3'],enabled:true,replyEnabled:true,proactiveEnabled:false};
it('validates origin/ids and keeps safe typed media without fetching URLs or treating CQ text as authority',()=>{
 expect(configuration(config)).toEqual({...config,friendIds:[],groupReplyMode:'all',url:'ws://127.0.0.1:3001/'});expect(()=>configuration({...config,url:'ws://example.com'})).toThrow('INVALID_CHANNEL_URL');expect(()=>configuration({...config,url:'wss://example.com?token=secret'})).toThrow('INVALID_CHANNEL_URL');expect(()=>stableId(Number.MAX_SAFE_INTEGER+1)).toThrow();
 const base={post_type:'message',message_type:'private',self_id:'1',user_id:'2',message_id:'-5',message:[{type:'image',data:{file:'abc.png',url:'http://127.0.0.1/private'}},{type:'record',data:{file:'x'}},{type:'file',data:{file:'/etc/passwd',name:'test'}}]};
 const parsed=inbound(base,config)!;expect(parsed.parts.map(p=>p.type)).toEqual(['image','record','file']);expect(JSON.stringify(parsed)).not.toContain('/etc/passwd');expect(JSON.stringify(parsed)).not.toContain('http:');expect(parsed.text).toContain('[图片]');expect(inbound({...base,user_id:'9',sender:{nickname:'主人'}},config)).toBeNull();expect(inbound({...base,message_type:'group',group_id:'3',message:'[CQ:at,qq=1]'},{...config,groupReplyMode:'mention'})).toBeNull();expect(()=>inbound({...base,message:[{type:'text',data:{text:'x'.repeat(4001)}}]},config)).toThrow();
});
it('outbound media only accepts bounded explicit base64 content, validates types and rejects URLs, paths, opaque references',()=>{
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=';
 expect(segments([{type:'image',data:{file:'base64://'+png}}],true)[0]!.data.file).toBe('base64://'+png);
 for(const file of ['https://example.com/x.png','file:///etc/passwd','/etc/passwd','abc.png','base64://%%%%','base64://'+Buffer.alloc(33000).toString('base64')])expect(()=>segments([{type:'image',data:{file}}],true)).toThrow();
 expect(()=>segments([{type:'record',data:{file:'base64://'+png}}],true)).toThrow('UNSUPPORTED_MEDIA_FORMAT');expect(()=>segments([{type:'image',data:{file:'base64://'+Buffer.from('fake image').toString('base64')}}],true)).toThrow('UNSUPPORTED_MEDIA_FORMAT');expect(()=>segments([{type:'file',data:{file:'abc'}}],true)).toThrow('UNSAFE_MEDIA_REFERENCE');
 const wav=Buffer.alloc(46);wav.write('RIFF');wav.writeUInt32LE(38,4);wav.write('WAVE',8);expect(segments([{type:'record',data:{file:'base64://'+wav.toString('base64')}}],true)[0]!.type).toBe('record');
});

it('separates a single owner from allowed friends and validates group trigger modes',()=>{
 const c=configuration({...config,friendIds:['2','4','4']});expect(c.friendIds).toEqual(['4']);
 for(const patch of [{ownerId:'1'},{friendIds:['1']},{friendIds:'4'},{groupReplyMode:'unknown'}])expect(()=>configuration({...config,...patch})).toThrow();
 const e={post_type:'message',message_type:'private',self_id:'1',user_id:'4',message_id:'9',message:[{type:'text',data:{text:'hello'}}]};
 expect(inbound(e,c)?.author).toBe('4');expect(inbound({...e,user_id:'5'},c)).toBeNull();expect(inbound({...e,user_id:'1'},c)).toBeNull();
 const g={...e,message_type:'group',group_id:'3'};expect(inbound(g,c)).not.toBeNull();expect(inbound(g,{...c,groupReplyMode:'mention'})).toBeNull();expect(inbound({...g,group_id:'6'},c)).toBeNull();expect(inbound({...g,message:[{type:'at',data:{qq:'1'}},...e.message]},{...c,groupReplyMode:'mention'})).not.toBeNull();
});
