# Rework

当前状态：四轮具体返工已闭环，最终新独立accept_p5_worker_ws给本地代码范围PASS，无待返工项；完整结论见Acceptance。下文保留历史范围，不能把旧“P5不提交”误当当前指令。未完成平台协议和外部证据仍在Spec/实现状态中保留。

## Fourth Rework — Current Scope

新accept_p5_worker确认普通Worker生命周期/HTTP修复有效，但Dedicated/Shared未知WebSocket绕过既有拒绝门。完整FAIL已入Acceptance；新实施者处理这一直接协议边界，P5不提交。

/tmp/bff-accept-worker-ws.mjs生产BrowserManager+Chrome+loopback接收器，read无gate：Page消息0、denied=true；两类Worker各真实发1条UNAPPROVED-WORKER-PAYLOAD并收到ack、denied/submitted均false。固定PW1.58 context.routeWebSocket不覆盖这些Worker，HTTP Fetch不能替代WS保护。须在实际外发前阻止未知WS，覆盖Dedicated/Shared/直接嵌套，不能仅改denied/终态或关闭整个Worker来牺牲正常读取。不要恢复通用WS放行或假称尚未实现私信协议使该路径无关。

S3窄验证：本地真实WS接收器未授权消息0，页面既有拒绝、Worker正常HTTP与生命周期/原授权门保持，目标创建/关闭/取消直接边界；必要type/lint/build。无真实账号/外发/凭据；不重复未改Python/评论/ASR/原生UI/其他平台。现有同根因网络守卫可局部调整，不重写业务/改目录/换栈。完整报告后新独立验收；root治理，实施者不Git/index/子Agent。

## Third Rework — Current Scope

新accept_p5_second_rework确认原三项缺陷修复与已有证据一致，但普通Web Worker使页面关闭，完整报告已入Acceptance。新的实施者只处理target能力/网络归属及直接回归；P5仍未提交。

redirects.ts对所有attached target一律Fetch.enable，worker不支持，返回CDP -32601，catch关闭整个主页面。/tmp/bff-accept-worker.mjs生产BrowserManager+真实Chrome+loopback页面仅创建postMessage Worker，实际ready后pageClosed=true/denied=true，无写请求。正常Worker必须保留，不能仅吞错误而令worker重定向绕过门。核实dedicated/shared worker及父页面网络实际归属，serviceWorkers仍保持block；按实际同根因范围处理，不扩成其他功能。

S3窄范围：正常Worker运行页面不关闭/不误报denied，Worker直接受限请求和重定向受限目标的接收器零未授权请求，原页面/递归OOPIF门及取消/清理保持。必要类型/lint/build；原三项评论/隐藏ID及无关ASR/平台/原生UI矩阵不重复。只读官方/固定源码与隔离夹具，真实平台仍未授权。业务/测试/必要使用文档归实施者，root治理；不Git/index/子Agent。完成完整报告后新独立验收。

## Second Rework — Current Scope

accept_p5_rework完整FAIL已读取，3项具体缺陷，见acceptance.md最新报告。由新的实施者处理，再新的独立验收；P5不提交。前轮ASR/身份/原生Mac结果有效，不重复无关矩阵。

1. **重定向外发门**：实际BrowserManager/Chrome获准POST被307带到未授权来源/端点，接收器已收到请求。修复必须阻止额外外发，不只是终态unknown；读/登录入口重定向至写操作同根因也覆盖。核对固定Playwright1.58真实接口/行为，保留取消/浏览器lease/账号撤销/单次提交。若使用route.fetch(maxRedirects:0)等前置处理，不能把3xx再原样fulfill给浏览器跟随；隔离夹具不得因改传输路径而悄悄访问真实平台，也不得靠测试专用跳过门造成假通过。官方[Route文档](https://playwright.dev/docs/api/class-route#route-fetch)说明maxRedirects和maxRetries；当前在线文档中的signal自1.62才有，本项目1.58不能假设支持。也可选有实际证据的其他实现，不预设方案。
2. **评论收据关联**：统一reply_id/reply_to_reply_id等固定上游已识别父目标语义，顶层/回复、矛盾别名、缺失必要关联均明确验证。实际响应为另一个父评论仍completed是已确认缺陷；Runtime不能因gate.receipt覆盖更严格判断而假成功。
3. **隐藏旧消息**：提交前基线必须包括已有但不可见的稳定ID，不能复用仅展示可见消息的快照。私信/分享直接影响路径同时修；不能证明新增则unknown，保留本人/稳定会话/精确正文或视频/sent/两次一致约束。

复现脚本：/tmp/bff-accept-redirect.mjs、/tmp/bff-accept-receipt.mjs、/tmp/bff-accept-old-message.py。都使用隔离页面/接收器，已清理进程/数据。S3：转为可复现定向回归，验证重定向目标零请求、正常获批动作一次且准确完成、错父关联/隐藏旧消息不verified、取消/撤销直接边界；必要type/lint/build。Python patch/NOTICE随改动复核。不重做已过ASR、全观看/记忆/QQ/B站、原生UI全流程。

DM/分享/上传发布wire仍未可靠核实，当前拒绝；不可用状态不是本轮绕过权限的借口，也不代表这些产品要求已完成。继续准确记录。不要为此使用真实账号/其他应用凭据或实际平台写操作。

## Context / Scope

首次accept_p5独立FAIL，4项已用隔离真实Runtime/Chrome/Python/ASR复现，完整证据见acceptance.md。dev基线7ceb617，P5未提交；用户每阶段本地commit授权持续，无push。新实施Agent只处理同根因直接影响与必要回归，随后新的独立验收。

## Required Changes

1. Runtime权限职责层必须把单次批准绑定到**实际**HTTP请求或WS消息的操作/端点、稳定目标、正文/动作参数/附件内容，最终异步等待后再次检查撤销/账号/revision/有效期。不是只重查数据库中批准的旧payload。一次提交不能放行额外点赞、评论、私信、分享或其他写；读/登录必要请求独立明确分类。拒绝不可识别的外发并准确报告能力/未知状态，不用统一放行所有POST/WS回避协议问题。
2. 审批的收件人稳定身份须在目标定位与真正发送时验证。明确给了peer_id但页面无ID，应拒绝，不能回退昵称；分享也需绑定稳定对象并处理同名/身份缺失。API/CLI/UI必要字段同步，所有变更属于未提交P5的已授权审批语义。
3. 清除把编辑器/body文本、既存消息、无关卡片/计数当成功的后备规则。消息/评论/分享/发布等每种开放写能力根据实际关联目标/内容的新增平台收据判断完成；无法确认则unknown/failed且不盲重试。保留固定上游成熟自动化，不从零重写平台，必要guard/收据修改可复核patch。不能仅禁用全部写工具使负例通过。
4. ASR按字节预算累计后统一UTF-8解码，或正确增量解码；覆盖汉字跨1/2字节边界、正常响应和超预算，保持统一模型配置与取消/超时边界。

已读可复用来源：固定LockyBee研究副本的receipt-baseline.mjs与contact-authorization.mjs有评论/分享的点击前knownIds、稳定本人/会话、精确正文/videoId、真实新增消息ID、sent/非pending/failed及两次一致快照匹配。可参考或在依赖/许可可控时复用，不加载独立大脑/台账。kdcadmin/lib/dm-messages.mjs仅规范化/哈希，不提供真实收据或网络协议解码。研究/tmp路径不能成为产品运行依赖。

## Validation

S3：实际社交权限门与收据。用真实Runtime/专用Chrome/Python MCP及隔离页面/网络证明每类开放写能力的匹配正向收据与错目标、错内容、重复请求、缺身份、未提交等负例，观察实际外发计数/内容与最终状态，不仅检查批准状态。保留已有导航等待撤销、Python放行后网络延迟撤销、账号/附件变化、unknown不重试、插件作用域与QQ隐私回归。针对变动模块做必要type/lint/build和最小相关测试，不机械重跑无变化的观看/ASR/记忆/整个前序矩阵。

用户已明确Mac解锁，可重新用/tmp/bff-p5-ui.mjs或仓库夹具在新临时数据实际操作本阶段原生UI。先读取新鲜CUA状态，不能从用户一句话虚报已验证；若仍锁定如实报告，不绕过。用户暂无Windows环境，该项保持外部未验证且继续其他工作。

## Output / Ownership

报告根因、修复职责层、直接影响、每类执行/收据实际证据、必要检查与末次修改顺序、许可证/patch更新、剩余外部门槛及清理。只修改业务/测试和必要使用文档，root维护Spec/Decision/全局记录；禁止动index/Git/分支，禁止创建子Agent。新独立验收后由root提交。
