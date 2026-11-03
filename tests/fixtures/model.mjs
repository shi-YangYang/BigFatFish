import {Buffer} from 'node:buffer';
import { createServer } from 'node:http';
export async function fixtureModel() {
  const requests = [], controls = { memoryResponse: undefined, slowMemory: false, tool: false };
  const server = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    if(req.url==='/v1/audio/transcriptions'){requests.push({url:req.url,raw});res.setHeader('content-type','application/json');res.end(JSON.stringify({text:'隔离音轨转写：海洋里的鱼'}));return;}
    if(req.url==='/v1/audio/speech'){const bytes=Buffer.alloc(80044);bytes.write('RIFF');bytes.writeUInt32LE(80036,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(8000,24);bytes.writeUInt32LE(16000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(80000,40);for(let i=0;i<40000;i++)bytes.writeInt16LE(Math.round(8000*Math.sin(i*2*Math.PI*440/8000)),44+i*2);res.setHeader('content-type','audio/wav');res.end(bytes);return;}
    const body = JSON.parse(raw || '{}'); requests.push({ url: req.url, authorization: req.headers.authorization, body });
    if (req.url === '/models') { res.setHeader('content-type','application/json'); res.end(JSON.stringify({object:'list',data:[{id:'deepseek-v4-flash',object:'model'}]})); return; }
    if (req.url === '/anthropic/v1/messages' || req.url === '/anthropic/messages') {
      res.writeHead(200, {'content-type':'text/event-stream'});
      const event=(type,data)=>res.write(`event: ${type}\ndata: ${JSON.stringify({type,...data})}\n\n`);
      event('message_start',{message:{id:'fixture-deepseek',type:'message',role:'assistant',model:body.model,content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:10,output_tokens:0}}});
      event('content_block_start',{index:0,content_block:{type:'text',text:''}});
      for(const text of ['Messages','测试','回复']){event('content_block_delta',{index:0,delta:{type:'text_delta',text}});await new Promise(resolve=>setTimeout(resolve,40));}
      event('content_block_stop',{index:0});event('message_delta',{delta:{stop_reason:'end_turn',stop_sequence:null},usage:{output_tokens:10}});event('message_stop',{});res.end();return;
    }
    if (req.url !== '/v1/chat/completions') { res.writeHead(404).end('{}'); return; }
    const prompt = JSON.stringify(body.messages);
    if (prompt.includes('FAIL_NOW')) { res.writeHead(401).end(JSON.stringify({ error: { message: 'fixture unauthorized' } })); return; }
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    const emit = (delta, finish_reason = null) => res.write(`data: ${JSON.stringify({ id: 'fixture-1', object: 'chat.completion.chunk', created: 1, model: body.model, choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
    emit({ role: 'assistant' });
    if(controls.tool && body.tools?.length && !body.messages.some(m=>m.role==='tool')){emit({tool_calls:[{index:0,id:'call-fixture',type:'function',function:{name:body.tools.find(t=>t.function.name.includes('greet'))?.function.name??body.tools[0].function.name,arguments:JSON.stringify({name:'实际DSH'})}}]});emit({},'tool_calls');res.end('data: [DONE]\n\n');return;}
    if(controls.tool&&body.messages.some(m=>m.role==='tool')){emit({content:'已消费真实工具结果：'+body.messages.filter(m=>m.role==='tool').map(m=>m.content).join('')});emit({},'stop');res.end('data: [DONE]\n\n');return;}
    let parts = prompt.includes('SLOW_NOW') ? Array(100).fill('慢') : ['测试', '模型', '回复'];
    const last = body.messages?.find(m=>m.role==='user' && (JSON.stringify(m.content).includes('BFF_MEMORY_EXTRACT') || JSON.stringify(m.content).includes('BFF_DAILY_DIARY')))?.content;
    const input = typeof last === 'string' ? last : JSON.stringify(last);
    if (input?.includes('BFF_MEMORY_EXTRACT') || input?.includes('BFF_DAILY_DIARY')) {
      const sourceText = input.split('来源：')[1]?.split('\n参考记忆：')[0];
      let sources; try { sources = JSON.parse(sourceText); } catch { sources = []; }
      if (input.includes('BFF_MEMORY_EXTRACT')) parts = [JSON.stringify({ memories: sources.filter(s=>s.quote.includes('茉莉花茶')).map(s=>({kind:'preference',subject:'主人饮品偏好',content:'主人喜欢茉莉花茶',importance:4,sources:[s]})) })];
      else parts = [JSON.stringify({content:'今天完成了对话，聊到了用户的饮品偏好。',sourceIds:sources.map(s=>s.id)})];
    }
    if(prompt.includes('BFF_ACTIVITY_CHOOSE'))parts=[JSON.stringify({index:prompt.includes('候选：[]')?-1:0,reason:'已确认兴趣与允许的视频相符'})];
    if(prompt.includes('BFF_VIDEO_UNDERSTAND'))parts=[JSON.stringify({summary:'本次依据官方字幕和采样画面了解蓝色海洋中的鱼。',interests:['海洋生物']})];
    if (input?.includes('BFF_MEMORY_EXTRACT') && controls.memoryResponse !== undefined) parts = [controls.memoryResponse];
    if (input?.includes('BFF_MEMORY_EXTRACT') && controls.slowMemory) parts = Array(100).fill('慢');
    for (const content of parts) { if (res.destroyed) return; emit({ content }); await new Promise(resolve => setTimeout(resolve, 50)); }
    emit({}, 'stop'); res.end('data: [DONE]\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}/v1`, requests, controls, close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}
