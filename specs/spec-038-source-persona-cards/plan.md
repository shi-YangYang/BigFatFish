# Plan — 完整人设卡

## 证据与边界
- 来源：https://aigengtu.com/persona ，2026-11-05 抓取 HTML，`pre` 整卡提取在忽略目录 `build/persona-cards/`。网页明确提供免费复制导入，页脚注明原作者版权；不得标为本项目原创/MIT 内容。
- 女儿卡正文 5006 字符（原文统一末尾换行），SHA256 `531c50771109e1ac0e80c43b5ca04515de3416dd74cc27d778806e1e8ae7c9f6`。
- 群友卡正文 6149 字符，SHA256 `6e231a9d2a041f8bf1c448290107c1ae5710ced192a9e99d1e48104b03d0632a`。
- 当前 dev/f321344，Spec037 未暂存改动保留；本任务无 Git 写操作授权。

## 顺序
1. 完整读取原卡与工具映射，确认调用/权限/输出边界。
2. 同一个实施 Agent 串行实现完整提示词、两卡和设置页，再补渠道/记忆/联网工具，避免交付接口并行冲突。
3. 做原卡完整性、版本/续聊、真实 DSH→工具桥→模拟 OneBot 的定向检查；测试不外发到真实联系人，不用付费模型，不修改真实数据。
4. 新独立验收 Agent 审阅 diff 和证据，按问题返工；不重复已通过的无改动检查。
5. 协调 Agent 经版本 API 应用当前女儿版，按需要正常重启本项目受管开发会话；源代码检查不等于真实云模型口吻验证。无需新增全量 UI 审计。

## 技术计划
完整提示词采用 JSON 可选字段，其本身不需要 schema 迁移。人格原卡与平台适配分离，后台任务依旧排除角色长文。工具按回合注入，不开放通用插件管理能力；发送动作由 Runtime 最终权限核验。自动笔记按会话范围独立于主人确认记忆，若需新增表则仅做 additive migration，并接入 memories 归档与校验；禁止塞入 settings 而遗漏备份。网页读取不得成为本机或内网代理。

## 工具调研（/root/investigate_persona_tools）
现有仅四项表情工具，缺少原卡消息/拍一拍/入图/记忆/网页等工具；现有最终回复是强制非空文本与图片合一气泡。
- `QQReplyTurn` 暂存消息、图片、拍一拍，完成后限当前入站目标按顺序投递，每项前重验 scope/revision；失败/unknown 停止，无重复 final，无重试。
- 显式 `skip_reply` 或已有排队动作才可空 final，不全局放开空模型响应。
- 原图工具绑定当前已验证附件，用现有 DSH image receipt 证明模型真实看见，收藏和备注须有该资格。
- `send_poke` 只当前私聊对象或群当前发言人；机器人被拍的 notice 才触发，避免自拍回环。
- 轻量笔记按账号+私聊/群目标，不能直接映射 MemoryStore 的管理 create/delete；query 仅范围笔记及受众可见确认记忆。
- 原卡 QQ 收藏库描述需明确适配现有大肥鱼本地表情库，description 作为备注，不假报 QQ 收藏/标签/使用次数。
- 原卡群友称呼所需 sender 昵称/ID 和指向信息来自 Runtime 已验证事件；不增加远程管理工具。

## 验证计划
S3：仅相关人格/QQ/工具/记忆边界与必要类型检查，隔离临时数据和网络 fixture。新增测试只覆盖用户可见行为或关键权限/交付边界，不镜像实现。无全项目测试/发行构建/平台真实外发。

## Implementation Report

### Summary
实施 Agent `/root/investigate_persona_tools` 完成；等待新的独立验收。未操作真实用户数据、账号或Git。

完整女儿/群友原卡以纯数据保存在 `apps/runtime/src/ai/persona-cards.ts`，含作者/sourceId/URL/抓取日期/正文SHA256；两个原文hash与上方证据一致。`cardPrompt`（最多32000字符）、`cardId`为可选JSON字段，保存保持版本冲突/历史；旧记录无字段不自动改写。完整卡只进入闲聊，后台任务排除。新安装女儿默认，只有女儿版/傲娇版预设，全文编辑按需展开，旧自定义仍可编辑。

### Files Changed
- 人格：`ai/persona-cards.ts`、`persona-presets.ts`、`persona-prompt.ts`、`types.ts`、`configuration.ts`；Desktop `Personality.tsx`。
- 工具/交付：`ai/web-tools.ts`、`chat.ts`、`engine.ts`、`dsh.ts`；`channels/reply-turn.ts`、`service.ts`、`protocol.ts`、`types.ts`、`sticker-turn.ts`、`stickers.ts`；`plugins/qq/index.mjs`；Desktop `qq-feedback.ts`。
- 记忆/存储：`memory/notes.ts`、`memory/store.ts`、`storage/database.ts`、`maintenance/archive.ts`。
- 文档：`docs/ai-core.md`、`docs/qq.md`；相关定向测试和fixture同步。Spec037已有修改保留。

### Adaptation Matrix / Important Decisions
| 原卡能力 | 实际实现与明确差异 |
|---|---|
| 完整性格、语气、示例 | 原文逐字保留，不以摘要替代；Runtime另附工具/身份/称呼适配，女儿版不保留旧原创顶嘴设定 |
| 身份和称呼 | DeepSeek为角色形象，不伪称实际模型品牌；亲情称呼仅主人明确选定，群友仍为朋友 |
| send_message | 当前目标内暂存字符串数组，最多3条/合计4000字，重复同文去重；最终工具文本不被final重复发送 |
| send_sticker | 最多1张、独立气泡，可只发表情；保留实际查看receipt、最终revision/开关guard和Spec037近期去重 |
| 静默 | 显式skip_reply，无网络发送，记为skipped；不把没有工具动作的空模型回复伪装成功 |
| send_poke | 当前发言人最多1次，真正执行NapCat send_poke；当前私聊或群范围不可由模型改写。入站仅机器人被拍事件触发，忽略自拍/其他对象 |
| get_message_images | 本条最多2张PNG/JPEG由主聊天模型实际查看，最多4次取得尝试；原链路也只接受PNG/JPEG，未扩GIF/WebP |
| sticker_note / collect_sticker | 本轮实际看过才更新本地描述/收藏入站图片；改备注同步本轮revision，不放开外部撤图检查；原QQ收藏夹语义适配为大肥鱼本地库 |
| memory_query/append/remove | 本地会话/QQ账号+私聊或群隔离的自动笔记；content和quote均须来自当前原话，不自由改写他处记忆，避免共享记忆撤销后派生泄露；不能操作主人确认记忆。此为原卡“自由印象”的明确收窄 |
| shared记忆 | 查询只返回当前可见确认记忆；查询结果版本+整体sharedRevision在生成/投递时复核，后续共享状态变化重建外部引擎上下文，避免从旧隐藏会话带出已撤销资料 |
| web_search / web_fetch | Bing公开RSS无需账号；公共HTTPS读取DNS审核并固定连接地址，拒绝本机/私网/凭据URL/非443端口，逐跳重定向重验，1MB响应/10秒/每轮5次/正文12000字符；外部文本不是指令 |
| 引用/无人时发言 | 遵循既有用户要求不引用；没有新消息不启动定时外发 |
| 无QQ的本地聊天 | 只有联网/范围记忆工具，不伪装QQ发送或拍一拍 |

根因及职责：原来预设是原创短文，QQ交付仅最终字符串+同气泡图片，缺少卡要求的分条/静默等动作语义。现在原卡数据独立、工具在Runtime回合内暂存、Channels负责最终授权和串行交付；每项失败或unknown停止后续，无自动重试。每泡独立交付记录，父记录汇总；已部分发送后再失败在操作记录明确提示。DSH固定pi-ai将正常stop且空文本编码为`EMPTY_RESPONSE`，仅Runtime已明确暂存动作/静默、无HTTP错误、无失败工具时接受该特定原因；其他错误与空回复保持拒绝，不关闭通用校验。

### Validation
- Risk Level: **S3**，人格持久化兼容、QQ外发权限、联网边界、自动笔记新增schema；验证仅直接子系统。
- 最终 `npx tsc -p tsconfig.node.json --noEmit` PASS；`npx tsc -p build/fish-persona/tsconfig.apps.json` PASS（仅apps）。首次Node先通过；后续poke入站联合类型导致file属性类型失败，统一返回Segment[]后两项通过。
- `npx vitest run tests/integration/source-persona-tools.test.ts tests/integration/persona.test.ts apps/runtime/src/ai/web-tools.test.ts apps/runtime/src/ai/persona.test.ts`：首次13 PASS/1 FAIL；失败发现上述真实DSH EMPTY_RESPONSE语义。窄修后只重跑相关项，全部14项现有通过证据。
- source-persona-tools包含原卡hash、旧配置、schema7→8迁移、schema8 notes备份恢复、schema7无notes包兼容、跨群/私有记忆/来源/共享撤回、实际看图后收藏、同轮备注更新再发图、分条去重、当前对象poke、显式静默。真实DSH→模型fixture→工具桥→OneBot fixture覆盖split/poke成功、静默、已暂存后工具失败不得外发、unknown停止余项。
- `npx vitest run tests/integration/qq-stickers.test.ts tests/integration/qq-sticker-expression.test.ts -t 'real DSH sees actual|blocks a selected|records only sent'`：3 PASS，7未选；图文分离真实DSH、最终健康请求间撤图、旧Spec037近期/取消/跨群记录回归。最终同步guard错误归类为SEND_NOT_STARTED后仅重跑撤图1项PASS。
- 最后收窄自动笔记为原话，仅重跑source-persona-tools的notes/归档项PASS；未重复无改动DSH检查。共17个不同定向用例有通过证据，未全套测试或发行构建。
- `git diff --check` PASS。
- 根协调实际App隔离UI1280×720：2个预设、旧自定义、来源、全文5006/6149首尾、展开关闭保存通过；`build/persona-cards/settings-preview.jpg`。临时tab9和fixture61204/session82172均已清理；未写真实配置。
- 免费公开联网实测：通过新webTools/readWeb真实DNS-pin路径搜索`DeepSeek official website`成功，返回5个标题/URL/摘要，包含deepseek.com官方页面；无模型/QQ调用。只验证入口可用，不将搜索结果当事实背书。

### Known Limitations / Application Steps
- 当前真实用户v4配置尚未切换，未启动真实Runtime/QQ；由根协调按项目规则处理schema8应用及经版本化API保存新女儿卡。
- 已安装QQ插件不会自动被内置源码覆盖。正常Node构建生成`dist/runtime/plugin-catalog/qq.bff-plugin`后，核对其为本项目原内置插件，用既有`POST /v1/plugins/update`更新；相同权限更新保留config/storage/granted/enabled，安装新目录，不覆盖旧/第三方文件。该流程会停止并重载QQ，实际登录状态需核实；新安装直接使用新包。
- NapCat依据官方 https://napneko.github.io/develop/api/doc ：send_poke采用user_id和可选group_id，成功无data；实际packetBackend/QQ版本可能拒绝，按真实协议失败呈现，未实际向联系人发送。
- 真实云模型口吻、主动配图选择概率、Windows原生和真实QQ拍一拍未实测。Web搜索依赖Bing可达性；失败明确返回，不切换成伪造资料。
- dev；全未暂存、未commit、未push，远端未刷新。本报告为实施证据，不代替独立验收。

## 当前数据应用准备（协调 Agent）
- 只读核实当前桌面目录 `/Users/yang/Library/Application Support/BigFatFish`，schema7、persona v4、没有 cardId。无本项目开发进程，不使用先前PID。
- 无 WAL/journal 时，以只读 immutable 源执行 SQLite backup，保存 `build/persona-cards/before-schema8.sqlite`（0600）。`application-before.json` 仅含版本/哈希和快照路径，不输出凭据。
- 待独立代码验收与更新包准备完成，按根 AGENTS §24「Migration … 须额外确认」一次确认：schema7→8新增自动笔记表/索引、通过既有API更新本项目QQ插件并切换女儿版，保留旧数据/原版本。确认之前不运行新Runtime读取真实DB，不写真实配置。
- 更新包已由 `node scripts/plugin-catalog.mjs` 生成，QQ权限仍仅 `channel.qq`，SHA256 `ae89e7724a532b07aa343722dc1b14ec2b36c39d1c52ce6b7d77618ded5aa2ec`。实际启用时正常 `npm run desktop:dev` 会编译新Runtime，无需为验证再做一次重复构建。
- `build/persona-cards/apply-current.mjs` 已准备（未执行）：仅在明确确认后运行，核对 schema、旧persona版本/哈希、原内置插件来源和权限，经API保存新女儿版、更新插件及恢复此前启用的QQ，最后读回正文；不直接写SQLite。

## Rework Implementation Report — R1 / R2

### Summary
新的实施 Agent `/root/rework_source_persona_cards` 根据首轮 FAIL 仅修复两项问题；等待新的独立验收。Spec037 与首轮 Spec038 改动保留，未操作真实数据、模型、QQ 账号或 Git。

### Files Changed
- `apps/runtime/src/ai/web-tools.ts` 与其定向测试：响应回调入口监听流错误，重定向分支关闭响应；畸形 Location 明确拒绝为 `WEB_REDIRECT_INVALID`。
- `apps/runtime/src/ai/chat.ts`：Runtime 私有 `ChatTurn.responseContent` 接口，在生成成功、取消及 scope 校验通过后归一化主历史正文。
- `apps/runtime/src/channels/reply-turn.ts`、`channels/service.ts`：QQ 通过原有 `output` 决策同时得到主历史文本与后续分条动作；不重复 final，不制造静默/图片/拍一拍的文字。
- `tests/integration/qq-reply-history.test.ts`：临时 SQLite、ChatService、Channels 与 loopback OneBot 联合回归，不用真实 Runtime 目录或联系人。

### Root Cause / Decisions
R1 根因是异步 response 回调中的同步 URL 解析异常不受外层 Promise 构造器捕获；在该责任边界捕获并 reject，且提前注册 response error handler，保证提前返回分支的流异常也不会成为 uncaughtException。逐跳公共 HTTPS、固定已验证 DNS 地址、最多 3 跳、父取消/超时信号继续传递，未放宽访问边界。

R2 根因是 QQ 选定发送正文与引擎 final 是两种不同结果，ChatService 误将后者直接当主历史。增加仅由 Runtime 内部注入的正文归一化回调，QQ 重用当前输出选择，不在 ChatService 引入 QQ 专属规则。分条文字按顺序以换行保存，Channels 保留动作气泡、最终授权及逐项投递；生成 completed 不代表已送达，failed / unknown / interrupted 等交付状态仍独立保存。普通聊天无回调，继续保存原 final；图片和拍一拍不伪造占位文本，显式静默丢弃模型解释。生成失败/取消不执行成功正文归一化，不将暂存工具文字记为已完成。

### Validation
- Risk Level: **S2**，共享 ChatTurn 与 QQ 输出归属的相关模块交互，按本轮返工要求只做直接定向检查；未重复首轮无变更的 17 项检查或 UI。
- `npx vitest run apps/runtime/src/ai/web-tools.test.ts tests/integration/qq-reply-history.test.ts -t 'rejects malformed|stores selected|keeps silence|separates canonical'`：**5 PASS，4 未选**，947 ms。
- R1 回归实际异步调用 HTTPS response callback：畸形 Location 拒绝、流已销毁、迟到 response error 不抛出；同进程后续公共跳转成功，私网与超 3 跳仍拒绝。无全局异常捕获绕过失败，无真实联网。
- R2 两个分条用例分别覆盖空 final / 已流出的非空总结：主历史只保存两条选定文字，模拟 OneBot 精确收到两个气泡；迁移恢复路径读取选定历史，普通 final 回退正常。静默为 skipped，图片和拍一拍单独发送且正文为空，普通本地聊天保留原文。生成失败不发送；协议 unknown 后停止后续动作但保留生成正文；取消后不发送、历史 cancelled，交付 interrupted。
- `npx tsc -p tsconfig.node.json --noEmit`：**PASS**，仅执行一次；`git diff --check`：**PASS**。

### Known Limitations / Remaining Questions
本轮没有真实模型或外部 QQ 发送验证，未运行发行构建、全量测试或 apps/UI 检查。schema8 当前用户数据应用与新 QQ 包应用继续由协调 Agent 处理；本报告不替代独立验收。dev，未暂存、未 commit、未 push。

## 真实数据应用结果（2026-11-05，协调 Agent）
- 用户明确选择「现在启用（推荐）」。正常启动 `npm run desktop:dev`，受管会话 `69374` 已运行 Runtime、Vite 与原生窗口，保留供用户使用；不是重复验证构建。
- 确认应用前仍为已备份的 schema7/persona v4 后，执行 `build/persona-cards/apply-current.mjs --approved` 一次成功：schema8、女儿版 v5、完整正文 5006 字符，原内置 QQ 插件已通过既有 API 更新且保持 enabled。
- API 读回 v4 哈希与备份元信息一致，名字/头像/边界/作息/自主偏好均保留。证据为忽略目录中的 `application-result.json`、`application-status.json`；旧数据库快照继续保留。
- 插件更新会停止托管组件。随后通过现有 `/v1/channels/qq/start` 发起恢复原配置，组件正常进入 `login / waiting_qrcode`，二维码已生成，无组件错误。用户随后回复「已扫码并确认」；API 只读核实组件与渠道均 `online`、`enabled=true`、`replyEnabled=true`、无组件错误、登录账号与已保存配置一致。人设仍为 `daughter / v5`，应用闭环完成；未发送测试消息。
- 未发送真实测试消息或拍一拍，未调用付费模型，不据配置应用结果宣称实际口吻/主动配图频率已验收。不重复代码测试、类型检查或 UI 审计。dev，全未暂存，未 commit/push；远端未刷新。
