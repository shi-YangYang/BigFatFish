# Plan

## 实施
1. ManagedQQ 抽取现有联系人读取为有职责的内部方法，供初次登录和明确刷新复用；提供 POST /v1/channels/qq/component/contacts/refresh（或等价明确入口）。绑定账号、generation、请求序号；失败不清空同账号已有列表，停止/换号清理旧账号缓存。
2. QQConnection 标题栏一个 beUI icon 按钮，复用现有在途保护和临时通知；独立刷新联系人并避免轮询旧结果回写，不动表单草稿或选中项。处理空列表和失败。沿用既有布局，不新加解释文字。
3. 原生 main.rs 精确将新路由纳入合理超时分支；不放大全部默认请求超时。直接相关 docs/qq.md 简短同步。

## 验证
S2，局部托管联系人读取与前端交互，既有认证/权限/schema不变。一次 apps 范围类型检查、managed-qq 定向回归（最新列表、失败保留、并发/停机或换号迟到、配置未变），不默认全量/build/lint。Rust仅字符串路由分支按差异核对，不为此全构建。隔离 UI 用当前真实组件核对 icon 点击、列表更新与未保存草稿，不使用真实 QQ/付费模型、不重启当前用户实例。已有检查通过即停止，独立验收不重复。

## 协作与 Git
root负责规格/交接、隔离UI复查；一位实施 Agent 修改业务和必要定向测试，随后新独立验收。报告追加本Plan，验收写acceptance.md。dev基线ccb4623，已有handoff撤销commit授权必须保留；无commit/push/暂存授权。

## Implementation Report

### Summary
已在托管 QQ 的回复设置标题栏加入 beUI 刷新 icon，一次更新主人选择、好友及群列表。刷新共用请求在途保护，保留表单草稿和选中项，不触发设置保存或授权新增联系人。

Runtime 增加 `POST /v1/channels/qq/component/contacts/refresh`，从 OneBot 重新读取好友/群，缓存查询继续走原 GET。初次登录与手动刷新共用内部读取方法；对同账号/同 generation 的并发刷新合并，普通失败保留旧列表并标记错误，成功（包括空列表）原子替换。读前/读后核验实际账号与在线状态；generation/序号防止停机、换号或较新读取后的迟到结果写回。

### Files Changed
- `apps/runtime/src/channels/managed/service.ts`：内部列表读取、主动刷新路由、缓存账号标识和注销/停止/换号清理。
- `apps/desktop/src/components/QQConnection.tsx`：刷新图标、独立联系人序号、账号匹配与共享在途保护。
- `apps/desktop/src/style.css`：标题栏动作 flex 对齐，沿用原间距与尺寸。
- `apps/desktop/src/api.ts`：刷新失败中文临时提示映射。
- `apps/desktop/src-tauri/src/main.rs`：新路由精确进入 30 秒分支，其余默认超时保持。
- `tests/integration/managed-qq.test.ts`：在既有真实 Runtime/OneBot 用例中扩充联系人刷新回归。
- `docs/qq.md`：刷新入口与保留选择的说明。

### Important Decisions
根因是 Runtime 只在账号首次配置时读联系人，页面轮询无法使缓存变新；因此修复位于组件管理层并提供明确读取动作，不用断开、重连或重新保存设置实现刷新。GET/POST 联系人响应增加可选 accountId，UI 将其与同时读取的组件账号核对，防止并行状态响应串账号；刷新期间的缓存轮询以及刷新开始前发出的迟到缓存结果由联系人序号拒绝覆盖。

独立 NapCat 手填路径、原授权范围、插件、登录操作与存储 schema 没有变化。失败提示复用现有通知，不新增常驻解释。原生超时覆盖最多三轮并行 OneBot 请求（每轮既有 4.5 秒上限），未将所有请求统一放宽。

### Validation
- Risk Level: S2。
- `npx tsc -p build/fish-persona/tsconfig.apps.json --noEmit`：一次通过，无输出、无类型错误；仅 apps 源码范围。
- `npx vitest run tests/integration/managed-qq.test.ts -t 'one-action connection'`：一次通过，1 passed / 3 skipped，1.48 秒。新增断言覆盖缓存不会自行变化、真实刷新读到新好友/群、并发只执行一次列表读取、保存配置与revision不变、失败保留旧缓存、空列表成功、换号及停止期间迟到结果拒绝。
- `git diff --check`：一次通过；已审阅相关 diff 和精确原生超时路由。
- 没有执行完整测试、build、lint、Rust构建或重复检查。隔离 UI 由协调 Agent 接续，不在本报告中声称已通过。

### Known Limitations
未启动或重启真实 Desktop/Runtime，没有修改用户真实 QQ 配置或发送消息。后端需在下次正常重启开发环境后加载新路由；本轮未操作该真实会话。Windows 实机和真实新增好友/群联动未实测。

### Remaining Questions
无实施阻塞，等待独立验收。未暂存、commit、push 或切分支；保留协调 Agent 维护的 Git 授权撤销记录。

## 隔离 UI 复查（协调 Agent）
- 使用实际 App/QQConnection/beUI，独立本机 fixture61202（假联系人），先修改未保存的好友/群勾选再点刷新：请求中按钮及表单禁用，成功显示新好友、新群和旧好友新昵称，原两位好友/两个群仍选中，新增项未勾选。后台 settings PUT=0、已保存配置保持原一位好友/一个群。
- 按钮40×40、图标18px，位于回复设置标题右侧；380×820窄屏与标题/自动回复同行，无横向溢出。刷新失败呈现「刷新好友和群聊失败，请稍后重试。」临时提示，原列表与勾选保留、按钮恢复。第一次提示已自行消失未截到，因此仅重做该失败场景捕捉通知，不重复其它通过项。
- 失败后切手填，输入未保存值 `20003, 20004, 20006` 再重试成功，原输入（含空格）、手填模式和群勾选均保留。总4次点击与4次请求相符，未发生隐式保存。
- 证据为忽略目录 build/qq-contact-refresh/02-narrow-error.png、03-narrow-draft.png、ui-evidence.json。检查期间未访问真实QQ、未发送消息或调用模型。临时tab6已关闭、viewport已reset，fixture34062已结束exit143；此前为同步fixture响应新增accountId而重启的72616也只属隔离服务，真实desktop会话未主动重启。
- 当前旧Runtime尚未加载新路由，用户下次重新运行 `npm run desktop:dev` 后完整生效；本次不为加载功能中断其真实QQ登录。

## R1：服务端长请求超时返工
首轮独立验收 FAIL，唯一阻断详见 acceptance.md：新接口读取最长约13.5秒，Tauri虽为30秒，Runtime createServer的connectionTimeout仍为5秒，慢读取被服务端提前断开。新实施Agent仅在该刷新路由按既有ai/routes.ts或channels/routes.ts约定，preHandler局部延长socket timeout（如20秒），onSend在成功和错误返回前恢复原connectionTimeout；不修改全局超时、认证、请求体读取或其它业务。

R1为S1局部接口修复：只做一个直接相关的真实HTTP定向检查，证明总处理时间超过5秒仍能完成，成功/失败恢复默认超时；使用隔离fixture无真实QQ。可以让各轮OneBot在4.5秒以内但总计超5秒，或测试路由handler的受控延迟；不得使用仅Fastify.inject来声称验证实际socket。原通过类型/列表/草稿/UI不重跑，不全量build。完成后新独立验收写acceptance-r1.md，不能由原实施/原验收自验。仍不commit/暂存/push。

## 验收前 S0 文案条件修正
协调 Agent 发现：刷新失败会保留非空群列表并设置 error，原提示「可填写群号」此时与实际没有手填框的界面不符。现仅在 error 且群列表为空、实际显示手填群号控件时保留该提示；保留非空列表时，刷新失败沿用已有临时通知。仅审阅该条件 diff，未重复运行类型检查或测试。当前隔离 UI 的失败夹具未模拟持久缓存 error 标记，此分支的依据是原 JSX 分支和后端错误保留行为的代码核对，不声称该状态已经 UI 实测。

## R1 Implementation Report

### Summary
实施 Agent：`/root/rework_qq_refresh_timeout`。根因是联系人最多三轮、每轮 4.5 秒的有界读取超过 Runtime 默认 5 秒 socket 超时；Tauri 的 30 秒客户端超时不能阻止服务端先断开。修复在路由传输层：认证和请求体读取完成后，仅刷新路由的 `preHandler` 将当前 socket 超时设为 20 秒，`onSend` 在成功或错误响应写出前恢复 `app.initialConfig.connectionTimeout`。沿用已有 QQ 发送/模型诊断路由模式，不引入共享配置变更或调用点特判。

### Files Changed
- `apps/runtime/src/channels/managed/service.ts`：仅为 contacts/refresh 路由补充局部超时与恢复钩子；既有联系人读取、缓存、状态和账号保护逻辑保持。
- `tests/integration/managed-qq-http.test.ts`：新增单个真实 HTTP 回归，生产 `createServer` 和 `registerManagedQQ` 注册路由，隔离的 managed fixture 延迟 5.2 秒返回或抛出 `QQ_CONTACTS_UNAVAILABLE`；不调用真实 QQ。
- 本 Plan：追加返工证据和限制。

### Validation
- Risk Level: S1。
- `git diff --check`：通过；审阅本轮路由与新增测试 diff，保留原任务已有改动。读取新增文件差异的 `git diff --no-index -- /dev/null tests/integration/managed-qq-http.test.ts` 返回 1 表示存在新增差异，不是检查失败。
- 唯一自动化命令：`npx vitest run tests/integration/managed-qq-http.test.ts`，一次通过，1 file / 1 test passed，10.64 秒。
- 实际使用 `node:http` 连接临时 loopback 端口，两个刷新处理均超过 5 秒，分别收到 200 与 409 及预期响应体；观察生产 onSend 之后、写出响应之前的 socket，成功和失败均恢复为 5000ms。两次后续 GET contacts 均确认复用真实 socket、超时为 5000ms、返回缓存；全局 requestTimeout 和 connectionTimeout 保持 5000ms。
- 未重复此前已通过的类型、联系人列表或 UI 检查，未执行全量测试、build、lint 或 Rust 构建。

### Known Limitations / Remaining Questions
真实 socket 的传输行为已验证；5.2 秒处理来自受控 fixture，不能声称慢真实 NapCat 或账号联动已实测。未启动/重启用户 Desktop/Runtime、未发送消息、未修改真实数据；临时服务已关闭、临时目录已清理。无需新依赖或迁移。

R1 实施与必要检查完成，等待新的独立验收 Agent；本 Agent 不给出最终验收结论。当前仍在 dev，未暂存、commit、push 或切分支；保留用户撤销自动 commit 的交接记录。远端与 PR 状态未核实，不属于本次返工范围。
