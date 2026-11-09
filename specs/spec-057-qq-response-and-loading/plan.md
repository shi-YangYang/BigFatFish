# 回复耗时与连接反馈修复计划

## 已知根因与实施顺序
1. 旧后台404造成新卡片报错，修客户端准确错误/部分列表/重试；连接生命周期各页补现有Loader反馈。
2. 从已固定DSH源码研究工具回合完成，避免send_message后空收尾再请求模型；以实际本地HTTP模型请求次数和延迟门控验证，保留发送最终复核、图片与取消约束。
3. 对网络表情缓存获取/下载失败补有界退避、明确本地回退，验证首次失败、重复调用、取消和恢复。
4. 定向实际Runtime/DSH/OneBot及浏览器夹具。完整报告写本Plan，新独立Agent验收。真实运行实例由根协调单独处理，不让代码测试混入用户库。

## 诊断来源
当前实例的认证只读GET、SQLite readOnly聚合、DSH session.v4.jsonl 的time/type/tool名称/usage统计；未把正文、工具参数、凭据输出。11–12秒纯文字中send_message约第5–7秒，剩余4–6秒为模型收尾；表情搜索10秒超时是已证实额外等待。模型为已有聊天配置，未改参数或发起新模型请求。

## Implementation Report

### Summary

实施 Agent：`/root/implement_qq_response_feedback`。基线 `dev / 6d6652c`，未切分支，未暂存、提交或推送。业务实现已完成并冻结，等待新的独立验收；真实实例是否更新由根协调处理。

根因和修复职责分开处理：旧后台缺路由是界面/后台版本不同步，客户端准确提示重启，不能靠吞掉错误修复；原模型回合在发送工具暂存之后仍多走一次 LLM，使用固定 DSH 自带的成功终止语义；网络图库反复超时由 Runtime 的共享表情网络实例做有界退避。三平台的耗时反馈留在原连接卡和实际操作按钮，不额外引入页面或全屏遮罩。

### Files Changed

- `apps/runtime/src/ai/{engine.ts,dsh.ts,dsh-bridge.mjs}`：可信工具元数据 `concludesTurn`，本地桥接原生 `exec.concludeTurn()`；最后工具批次失败检查。
- `apps/runtime/src/channels/{reply-turn.ts,sticker-network.ts,sticker-turn.ts}`：QQ 最后提交契约；网络预算、退避、缓存与本地候选回退。
- `apps/desktop/src/components/Controls.tsx`：复用 beUI Loader 的 `Button busy`；保留原尺寸与无障碍名称。
- `apps/desktop/src/features/connections/ConnectionStatus.tsx`、`connection-errors.ts`、`ConnectionReadError.tsx`、`Connections.tsx`、`Bilibili.tsx`、`Douyin.tsx`、`qq/{QQConnection,QQMessages,QQSelfActivity}.tsx`：状态进度、按钮忙碌、旧后台提示、重试和独立记录读取。
- 新增 `tests/integration/{qq-terminal-reply,sticker-network-recovery,connection-loading}.test.ts`；更新 `tests/fixtures/{model.mjs,desktop-clarity.tsx}` 和表情集成用例，使测试模型按最后同批提交的真实契约运行，继续断言实际文字和图片。
- `docs/qq.md` 同步用户恢复操作、缓存和回复机制；本 Plan 保存实施证据。Spec/Decision/交接/索引由根协调准备，不混为本 Agent 的业务实现。

### Important Decisions

1. **使用成功完成，不使用取消模拟成功。** 固定 `@deepseek-ai/dsh-tools 0.2.2-alpha.2` 的 `lib/types/contracts.d.ts:239` 声明 `ToolRunContext.concludeTurn()` 只标记成功结果；`lib/pipeline.js:28–60` 继续完成整批调用，累积 concluded；`dsh-agent-loop/lib/index.js:958–974` 在整批返回后转为 completed。没有修改 node_modules 或上游代码。
2. 仅 QQ `send_message/send_sticker/send_poke/skip_reply` 由可信 Runtime 标记终止。搜索、查看图片、记忆、个人资料等不终止。先读取和实际看图，再最后同批提交所需消息/图片/拍一拍。网站完整人设未改；没有删除记忆、工具能力或修改模型/推理参数，证据不足以把上下文长度或新工具数量认作本次主因。
3. DSH 原生可能在同批某个提交成功、另一个失败时仍 completed，因此 Adapter 根据**最后 step**的 `tool/result.message.isError` 拒绝本轮暂存回复。不能用全回合 sticky failure 拦住先失败后恢复。其他既有工具的即时成功操作不承诺回滚；回复仍在原最终权限、身份、记忆范围、图片资格检查后逐条发送，queued 仍不等于送达。
4. 图库请求预算 2.5 秒、图片网络下载 4 秒；目录失败退避 60 秒，图片按 URL 退避 60 秒（最多 32 项）。已验证目录缓存 15 分钟，临时刷新失败可使用已验证旧目录；已解码图片最多缓存 4 张、15 分钟。用户 abort 不记录网络失败。搜索失败直接返回已有本地候选，图片失败让模型改用本地表情或文字。保持原域名、公共 IPv4、禁止重定向、体积/像素/格式验证，不开放任意 URL。
5. 原生 invoke 的字符串 `Not Found`/`CHANNEL_NOT_CONFIGURED` 与 Error 统一识别。两种记录接口采用 allSettled，一项失败时保留另一项与上次内容；不显示虚假的成功空列表。手动重试即使与已有轮询重合也显示忙碌，不重复请求；轮询本身不闪动。
6. beUI Loader 用于初读、安装、连接、恢复、手机确认、验证和停止状态及实际点击的异步操作；等待扫码保持静态二维码、正常状态和可用操作。按钮显示 aria-busy 并禁止重复提交，完成/失败后结束。

### Validation

Risk Level：核心共享 AI/发送边界为 **S3**；连接页面与共享按钮为 **S2**。只执行相关子系统验证，没有运行全仓测试、全量 lint、发布构建或真实账号测试。

- `npm run build:node`：通过。生产 Runtime 及 CLI 编译并复制当前桥接资源。
- `npx tsc -p tsconfig.json`：未通过，暴露既有测试声明债：`model.d.mts` 缺失早已使用的 sticker/replyTools/emotionResponse、旧 `ChannelStatus.manifest`、若干历史测试类型断言等。未扩大修改这些无关测试，不声称全仓类型检查通过。
- `npx tsc -p build/qq-response-feedback/tsconfig.production.json`：通过。临时配置继承原选项，仅检查 `apps` 生产源码、排除 `.test.ts`；最后一次在最终共享 UI 修改后通过。
- `npx vitest run tests/integration/qq-terminal-reply.test.ts tests/integration/sticker-network-recovery.test.ts tests/integration/qq-reply-history.test.ts tests/integration/qq-stickers.test.ts apps/runtime/src/channels/sticker-network.test.ts`：首次运行 18 通过、1 个新用例因图片 data URL 断言过于严格失败；改为检查实际图像 data URL 后新用例通过。最终 **19 个相关用例通过**，通过的其余 18 项未重复运行。
- 新的真实 DSH / 本地 HTTP 模型 / OneBot 用例验证：文字分两条气泡只需 **1 次**模型请求；先实际看图再同批文字+图片+拍一拍共 **2 次**请求，三个动作都按序投递；图片单发、静默、同批失败无投递、前一工具失败后成功文字回退、最终健康检查挂起期间停用图片（blocked）、真实取消（interrupted）均通过。测试模型把任何计划外收尾请求判错，最终 unexpected=0。已有回复历史、图片呈现失败、最终权限竞态与 SSRF 用例仍通过。
- 网络恢复用例：首次故障返回本地候选，紧接的另一回合没有再次请求；60 秒后恢复；取消不污染失败缓存；真实 2.5 秒 deadline 后下一次快速失败；坏图 URL 暂停并从搜索过滤、到期恢复、成功图片缓存均通过。
- `npx vitest run tests/integration/connection-loading.test.ts tests/integration/qq-self-ui.test.ts tests/integration/connection-login-feedback.test.ts`：**4 个浏览器用例通过**。原生风格字符串 reject 的两个404、部分来源成功、重试/保存 Loading、未配置正常状态、QQ连接/安装/扫码/手机确认/联系人刷新、B站与抖音连接 Loading，以及既有错误位置、弹窗保存恢复均通过。
- 目视第一轮发现 Loader 与标签间距不足，改用 Badge 原生 icon slot；隔离 fixture 统一内容宽度并等待布局稳定。针对相关改动重跑 `qq-terminal-reply.test.ts`（补真实最后权限门控）和 `connection-loading.test.ts`：2 通过，17.04 秒。之后 B站退出登录忙碌标记改到对应按钮，仅运行 `connection-login-feedback.test.ts -t 'keeps connection settings'`：1 通过，另1因名称过滤跳过，5.79 秒。
- `git diff --check`：通过。无暂存或提交。

隔离截图在 `build/qq-response-feedback/`：`old-runtime-partial.png`、`qq-installing.png`、`bili-loading-{900,380}.png`、`douyin-loading-{900,380}.png`。实施者实际打开并目视旧后台部分记录、QQ安装、B站380与抖音900截图；布局稳定，无横向溢出。测试日志 `runtime-tests.log` 保留首次断言失败历史，`terminal-test.log`、`final-targeted.log` 为后续通过证据；`ui-tests.log`、`bili-final.log` 为UI通过记录。

### Known Limitations

- 以上为真实 SDK/本机 HTTP/OneBot 协议/浏览器 UI 的隔离验证，不是云端百炼或真实 QQ 外发。单次本地请求数量减少不能承诺所有真实模型固定加速比。
- 模型需遵守“先读/看图，最后同批提交”的工具契约。未修改网站原卡；终止后不再容许下一批追加消息。错误批次不投递暂存回复，后续新的用户回合仍可正常恢复。
- 真实 Runtime 尚由根协调控制，本 Agent 未启动/停止真实 Desktop/后台，未读取或修改真实用户库、账号、会话、受限备份，也未访问付费模型。旧后台404需更新运行实例后才真正消失；前端提示只负责准确恢复指引。
- 没有做 Windows 原生、真实B站/抖音账号或打包验证；无 commit/push 授权操作。

### Remaining Questions

实现范围无未解决的代码问题。等待独立验收；真实实例升级/启用及相应用户确认与记录留给根协调，不属于本 Agent 的隔离实施权限。

## 根协调：真实实例启用准备

用户于 2026-11-08 明确答复「现在重启并启用（推荐）」，授权重启开发版及本地 schema 12 → 14 升级。授权不包含测试外发、收费模型验证或 Git 提交；按下述方案执行并在完成后记录实际结果。

2026-11-08 只读诊断发现真实库仍为 schema 12，当前源码启动会升级到 14，并执行已完成的 QQ 内置能力兼容。真实服务仍运行旧代码，本次尚未重启或改写原库。

已通过 SQLite 在线备份创建 `build/qq-response-feedback/before-schema12-20261108.sqlite`（受限目录 0700、文件 0600），完整性检查为 ok。只在另一个备份副本上运行当前数据库升级及 QQ 归属兼容：12 → 14 成功；消息和记忆数量、QQ 配置与加密凭据摘要、启用状态均保持，完整性为 ok。结果保存于被忽略的 `build/qq-response-feedback/upgrade-preview.json`，副本不用于模型测试或提供给子 Agent。

这证明升级演练通过，不等于真实实例已启用，也不证明真实云模型加速比。独立验收后按项目规范第 24 节确认真实 Migration；若获准，先优雅退出当前开发会话、再创建停止状态的新备份，然后启动新版并只读验证接口与连接状态。不主动发送测试消息或调用收费模型。

## R1 Implementation Report

### Summary

新实施 Agent：`/root/implement_qq_loading_r1`。已完整读取首次验收 FAIL 和 R1 范围。仅修复 QQ 联系人刷新错误点亮上次保存按钮的问题，代码已冻结，等待新的独立验收。没有修改本轮已验收的 Runtime、网络恢复或其它平台行为。

### Files Changed

- `apps/desktop/src/features/connections/qq/QQConnection.tsx`：增加当前 `activeAction`，由 `act()` 开始设置、finally 清空；按钮 busy 由当前操作路径决定。`lastAction` 继续负责历史错误归位，共享 `busy/pending` 与联系人刷新状态保持原职责。
- `tests/integration/connection-loading.test.ts`：新增仅覆盖 R1 的浏览器场景，复用现有隔离页面入口。
- 本 Plan：追加返工证据。

### Important Decisions

根因是把“当前存在任意请求”和“上次操作路径”合并当成当前操作。直接清空 `lastAction` 会破坏保存错误在回复设置卡内的归属，因此在组件本地单独保存当前动作路径；联系人刷新没有 `activeAction`，不会把历史保存操作重新显示为正在执行。既有互斥仍可禁用保存按钮，但不显示保存 Loader；操作成功与失败都在 finally 清空当前动作。

### Validation

- Risk Level：**S1**，仅 QQ 组件局部状态逻辑。
- `npx vitest run tests/integration/connection-loading.test.ts -t 'keeps QQ contact refresh busy separate'`：**1 通过，1 因名称过滤跳过**，1.50 秒；日志 `build/qq-response-feedback/loading-r1.log`。
- 该单场景实际挂起保存，确认仅保存 busy；保存完成后挂起联系人刷新，确认仅刷新 busy、保存因互斥 disabled；释放刷新后两个按钮恢复；随后模拟保存版本冲突，确认错误仍出现在回复设置卡、账号卡没有错误，保存 busy 结束。
- 实际打开并目视 `build/qq-response-feedback/contacts-busy-r1.png`：联系人刷新图标显示 Loader，保存按钮禁用但无 Loader。
- `git diff --check`：通过；已阅读相关 diff。未重复其它 UI、Runtime、网络、build 或 typecheck 检查。通过后停止验证。

### Known Limitations

本轮仅使用隔离 Chromium/HTTP 页面，不属于原生 Desktop 或真实 QQ 账号验证。没有访问真实数据、运行实例或备份；未调用收费模型或发送平台消息。其余 Spec057 验证边界沿用前述报告。

### Remaining Questions

R1 实施范围无未解决问题；待新的独立 Agent 判断验收。仍在 `dev`，未切分支、暂存、commit 或 push。

## 根协调：真实启用结果（2026-11-08）

用户授权后核实旧 Runtime 及控制进程均属于本仓库，对开发控制器发送 SIGTERM，由其完成正常停止；确认两进程退出。停止状态下追加受限备份 `build/qq-response-feedback/before-activation-2026-11-07T17-05-11-964Z.sqlite`，完整性为 ok（文件名为 UTC 时间）。随后运行 `npm run desktop:dev`，schema 已由 12 升至 14；消息/记忆数量保留、QQ 配置与加密凭据摘要一致、主密钥一致，完整性为 ok，见被忽略的 `activation-before.json` / `activation-after.json`。

原生操作工具按名称选择应用时误启动了磁盘上的旧安装包；退出旧包时其退出命令同时停止了共享后台。已向用户说明，关闭误开的旧包并再次运行 `desktop:dev`，不修改用户数据或应用配置，不继续用应用名选取旧包。最终开发后台 PID 56061、schema14、身份校验一致，QQ `builtin=true`；`self-options` / `action-issues` 均 HTTP200。最新只读结果在 `activation-current.json`。此次启动所需 Node/Rust 构建正常；没有重复执行代码测试。

当前 QQ 为 login / waiting_qrcode，已有二维码，已请用户在新版开发窗口扫码并手机确认。代码及后台启用完成，真实 QQ 在线恢复待用户登录；不把接口恢复等同真实发送验收或云端提速实测。未主动调用收费模型、发送测试消息、提交或推送。

用户随后答复「已扫码并在手机确认」。一次认证只读检查确认同一 Runtime PID56061/schema14 正常；QQ health=online、builtin=true、enabled=true、replyEnabled=true，组件 phase=online、有账号、无二维码且 busy=false。真实登录恢复完成，更新后的状态见 `activation-current.json`。到此停止追加检查，真实消息耗时留待正常使用观察，不主动外发测试。
