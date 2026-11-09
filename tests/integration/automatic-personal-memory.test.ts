import { expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { paths, preparePaths } from '../../apps/runtime/src/paths.js';
import { openDatabase } from '../../apps/runtime/src/storage/database.js';
import { ChatService } from '../../apps/runtime/src/ai/chat.js';
import { Channels } from '../../apps/runtime/src/channels/service.js';
import { DSHAdapter } from '../../apps/runtime/src/ai/dsh.js';
import { onebotFixture } from '../fixtures/onebot.js';

// Use the regular QQ and local entry points, including addressed group messages and final delivery.
it('remembers automatically for the right person and discloses only facts visible in the present room', async () => {
  const p = paths(mkdtempSync(join(tmpdir(),'bff-personal-scope-')));
  preparePaths(p);
  const db = openDatabase(p.database);
  const chat = new ChatService(db,p), channels = new Channels(db,chat), bot = await onebotFixture();
  const recalls: { context: string; tool: string }[] = [];
  const run = vi.spyOn(DSHAdapter.prototype,'run').mockImplementation(async input => {
    if (input.prompt.startsWith('BFF_MEMORY_TURN_ANALYSIS')) return '{"items":[]}';
    input.onSessionReady();
    if (input.prompt === '我喜欢白桃煎茶') {
      await input.tools!.find(t => t.name === 'skip_reply')!.execute({},input.signal);
      return '';
    }
    if (input.prompt === '记得谁喜欢什么茶吗？') {
      const tool = input.tools!.find(t => t.name === 'memory_query')!;
      const result = await tool.execute({query:'茶'},input.signal);
      recalls.push({context:input.context ?? '',tool:JSON.stringify(result)});
    }
    return '知道了';
  });
  let seq = 0;
  const wait = (check: () => void) => vi.waitFor(check,{interval:10,timeout:3000});
  const qq = async (person: string, group: string | null, content: string, expectedState = 'sent') => {
    const id = String(++seq), kind = group ? 'group' : 'private';
    const text = {type:'text',data:{text:content}};
    bot.event({post_type:'message',self_id:'10001',user_id:person,message_type:kind,group_id:group,
      message_id:id,sender:{nickname:'主人'},message:group ? [{type:'at',data:{qq:'10001'}},text] : [text]});
    await wait(() => expect(db.prepare('SELECT status FROM channel_deliveries WHERE id=?')
      .get(['10001',kind,group ?? person,id].join(':'))?.status).toBe(expectedState));
  };
  const local = async (content: string) => {
    const sent = chat.send(chat.create({}).id,{content,requestId:String(++seq)});
    await wait(() => expect(chat.message(sent.id).status).toBe('completed'));
  };
  function checkLast(include: string[], exclude: string[]) {
    for (const output of Object.values(recalls.at(-1)!)) {
      for (const term of include) expect(output).toContain(term);
      for (const term of exclude) expect(output).not.toContain(term);
    }
  }
  try {
    chat.config.saveModel({id:'fixture',provider:'openai',baseURL:'https://unused.invalid/v1',model:'fixture'});
    chat.config.saveRoutes({chat:'fixture'});
    await channels.initialize();
    channels.save({url:bot.url,accountId:'10001',ownerId:'20002',friendIds:['30003','30004'],groups:['41001','41002'],
      groupReplyMode:'mention',enabled:true,replyEnabled:true,proactiveEnabled:false,token:'fixture-token',revision:''});
    await wait(() => expect(channels.status().health.state).toBe('online'));
    await local('我喜欢桂花红茶');
    await qq('20002','41001','我喜欢白桃煎茶','skipped');
    expect(bot.requests.filter(r => r.action.startsWith('send_'))).toHaveLength(0);
    await qq('30003',null,'我喜欢茉莉绿茶');
    await qq('30004',null,'我喜欢茉莉绿茶');
    await qq('30003','41001','我喜欢荞麦茶');
    await qq('20002','41002','我今天点了杯奶茶');
    await wait(() => expect(chat.life.memories.list({status:'confirmed'})).toHaveLength(5));
    const facts = chat.life.memories.list({status:'confirmed'});
    expect(facts).toHaveLength(5);
    expect(facts.filter(m => m.content.includes('茉莉绿茶')).map(m=>m.personKey).sort())
      .toEqual(['qq:10001:30003','qq:10001:30004']);
    expect(facts.find(m => m.content.includes('白桃煎茶'))).toMatchObject({role:'owner',personKey:'owner',scopeKey:'qq:10001:group:41001'});
    const question = '记得谁喜欢什么茶吗？';
    await local(question);
    checkLast(['桂花红茶','白桃煎茶'],['茉莉绿茶','荞麦茶','奶茶']);
    await qq('30003','41001',question);
    checkLast(['白桃煎茶','荞麦茶'],['桂花红茶','茉莉绿茶','奶茶']);
    await qq('20002','41002',question);
    checkLast([],['桂花红茶','白桃煎茶','茉莉绿茶','荞麦茶','奶茶']);
    await qq('30004',null,question);
    checkLast(['茉莉绿茶'],['桂花红茶','白桃煎茶','荞麦茶','奶茶']);
    expect(run.mock.calls.filter(([input]) => !input.prompt.startsWith('BFF_MEMORY_TURN_ANALYSIS'))).toHaveLength(seq);
  } finally {
    run.mockRestore();
    await channels.close(); await chat.close(); db.close(); await bot.close();
    rmSync(p.root,{recursive:true,force:true});
  }
});
