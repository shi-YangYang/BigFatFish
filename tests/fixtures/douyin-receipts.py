"""Isolated real Chromium/retained Python DOM receipt regression; no platform access."""
import asyncio, importlib.util, os, tempfile, json, sys
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    with tempfile.TemporaryDirectory(prefix='bff-receipts-') as home:
        os.environ['DSH_DOUYIN_HOME']=home
        spec=importlib.util.spec_from_file_location('douyin', Path(__file__).resolve().parents[2]/'services/douyin/mcp_server.py')
        m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
        async with async_playwright() as pw:
            browser=await pw.chromium.launch(executable_path=sys.argv[1], headless=True)
            context=await browser.new_context()
            await context.add_cookies([{'name':'uid_tt','value':'12345','domain':'.douyin.com','path':'/'},{'name':'sessionid','value':'fixture','domain':'.douyin.com','path':'/'}])
            await context.route('**/*',lambda r:r.fulfill(content_type='text/html',body='<p>isolated</p>'))
            page=await context.new_page(); await page.goto('https://www.douyin.com/')
            async def grant(): pass
            m._submitted=grant  # The Runtime gate itself is exercised by douyin-write.test.ts.
            results=[]
            try:
                for scenario in ([] if os.environ.get('BFF_RECEIPT_FINAL_ONLY') or os.environ.get('BFF_RECEIPT_SECOND_ONLY') else ['good','not-sent','wrong-text','wrong-peer','wrong-sender','pending','old-id','synthetic']):
                    peer='peer-a'; text='海洋'; msgtext='WRONG' if scenario=='wrong-text' else text
                    status='pending' if scenario=='pending' else 'sent'; sender='WRONG' if scenario=='wrong-sender' else '12345'
                    msgpeer='WRONG' if scenario=='wrong-peer' else peer
                    msgid='old' if scenario=='old-id' else 'new'
                    attrs='' if scenario=='synthetic' else f'data-message-id="{msgid}"'
                    html=f'<div data-peer-id="{peer}"><div contenteditable="true"></div><div data-message-id="old" data-status="sent" data-sender-id="12345">海洋</div></div>'
                    await page.set_content(html)
                    await page.evaluate('''({scenario,markup})=>{document.querySelector('[contenteditable]').addEventListener('keydown',e=>{if(e.key!=='Enter')return;e.preventDefault();if(scenario!=='not-sent')document.body.insertAdjacentHTML('beforeend',markup);});}''',{'scenario':scenario,'markup':f'<div data-peer-id="{msgpeer}"><div {attrs} data-status="{status}" data-sender-id="{sender}">{msgtext}</div></div>'})
                    editor=await page.query_selector('[contenteditable]')
                    result=await m._send_chat_part(page,editor,{'kind':'text','text':text},peer,context)
                    assert bool(result.get('verified')) == (scenario=='good'), (scenario,result)
                    results.append('chat:'+scenario)
                for scenario in ([] if os.environ.get('BFF_RECEIPT_FINAL_ONLY') or os.environ.get('BFF_RECEIPT_SECOND_ONLY') else ['good','wrong-video','wrong-peer','pending','old-id','no-id']):
                    msgpeer='WRONG' if scenario=='wrong-peer' else 'peer-a'; aid='999999' if scenario=='wrong-video' else '123456'
                    attrs='' if scenario=='no-id' else 'data-message-id="new"'; status='pending' if scenario=='pending' else 'sent'
                    await page.set_content(f'<div data-peer-id="{msgpeer}"><div {attrs} data-status="{status}" data-sender-id="12345"><a href="https://www.douyin.com/video/{aid}">视频</a></div></div>')
                    result=await m._new_message_receipt(page,context,'peer-a',{'new'} if scenario=='old-id' else set(),video_id='123456')
                    assert bool(result)==(scenario=='good'),(scenario,result)
                    results.append('share:'+scenario)
                # Submission baselines include hidden stable IDs, including the
                # alternate ID attribute, independently from the visible reader.
                for scenario in ['hidden-message-id','hidden-msg-id','new-id']:
                    attr='data-msg-id' if scenario=='hidden-msg-id' else 'data-message-id'
                    await page.set_content(f'<div data-peer-id="peer-a"><div contenteditable="true"></div><div id="old" style="display:none" {attr}="old" data-status="sent" data-sender-id="12345">海洋</div></div>')
                    await page.evaluate("""scenario=>document.querySelector('[contenteditable]').addEventListener('keydown',e=>{
                        if(e.key!=='Enter')return;e.preventDefault();
                        if(scenario==='new-id')document.getElementById('old').insertAdjacentHTML('afterend','<div data-message-id="new" data-status="sent" data-sender-id="12345">海洋</div>');
                        else document.getElementById('old').style.display='block';
                    })""",scenario)
                    result=await m._send_chat_part(page,await page.query_selector('[contenteditable]'),{'kind':'text','text':'海洋'},'peer-a',context)
                    assert bool(result.get('verified'))==(scenario=='new-id'),(scenario,result)
                    results.append('chat:'+scenario)
                original_open,original_goto,original_login=m._open_conversation,m._goto,m._login_state
                for scenario in ['hidden-old','new-id']:
                    opens=0
                    async def open_conversation(p,ctx,nickname,peer):
                        nonlocal opens
                        opens+=1
                        hidden='display:none' if opens==1 else ''
                        mid='new' if opens>1 and scenario=='new-id' else 'old'
                        await p.set_content(f'<div data-peer-id="peer-a"><div data-message-id="{mid}" style="{hidden}" data-status="sent" data-sender-id="12345"><a href="https://www.douyin.com/video/123456">视频</a></div></div>')
                        return None
                    async def share_page(p,url,settle=0):
                        await p.set_content('<button data-e2e="video-share-icon-container">转发</button><p>分享给朋友</p><div data-peer-id="peer-a"><span>测试人</span><button>分享</button></div>')
                    async def logged_in(p,ctx): return {'loggedIn':True}
                    m._open_conversation,m._goto,m._login_state=open_conversation,share_page,logged_in
                    result=await m._share_core(page,context,'123456','测试人','peer-a')
                    assert bool(result.get('verified'))==(scenario=='new-id'),(scenario,result)
                    results.append('share:'+scenario)
                m._open_conversation,m._goto,m._login_state=original_open,original_goto,original_login
                for parent,fields,expected in [('',{'reply_to_reply_id':'OTHER'},None),('',{'reply_id':'','reply_to_reply_id':'OTHER'},None),('',{},None),('parent',{'reply_to_reply_id':'parent'},'parent'),('parent',{},None),('',{'reply_id':0},'')]:
                    assert m._comment_parent(fields,parent)==expected,(parent,fields)
                results.append('comment:parent-aliases')
                await page.set_content('<div data-peer-id="peer-a"><div contenteditable="true"></div></div>')
                async def change_peer():
                    await page.evaluate("document.querySelector('[data-peer-id]').setAttribute('data-peer-id','WRONG')")
                m._submitted=change_peer
                try:
                    await m._send_chat_part(page,await page.query_selector('[contenteditable]'),{'kind':'text','text':'海洋'},'peer-a',context)
                    raise AssertionError('peer changed during authorization was accepted')
                except ValueError: results.append('chat:peer-changed-during-guard')
                # Real _open_conversation must refuse an exact, unique nickname without a stable ID.
                async def goto(p,url,settle=0):
                    await p.set_content('<img data-e2e="user-avatar"><button data-e2e="im-entry">消息</button><input placeholder="搜索"><div data-e2e="conversation-item">相同昵称</div><div contenteditable="true"></div>')
                m._goto=goto
                try:
                    await m._open_conversation(page,context,'相同昵称','peer-a')
                    raise AssertionError('missing identity was accepted')
                except ValueError: results.append('conversation:missing-stable-id')
                print(json.dumps({'passed':results},ensure_ascii=False))
            finally:
                await browser.close()

asyncio.run(main())
