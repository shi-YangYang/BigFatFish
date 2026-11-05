# Acceptance R1

## Result

PASS

验收 Agent：`/root/accept_qq_refresh_timeout`。独立于本轮实施 Agent，审阅 `dev` 工作区；首轮 `acceptance.md` 的 FAIL 保留为历史，唯一阻断 R1 已关闭。

## Spec Coverage

- R1 已满足：仅联系人刷新路由在 `preHandler` 把当前 socket 超时设为 20 秒，覆盖三轮并行 OneBot 读取（每轮上限 4.5 秒）。修复位于 Runtime 路由传输层，与 Tauri 已有的该路由 30 秒客户端预算一致。
- 成功及错误响应均在 `onSend` 恢复 `app.initialConfig.connectionTimeout`；全局连接超时、请求体读取时限、管理认证及普通路由没有变更。沿用既有 QQ 发送/模型诊断路由模式，没有把问题转移到前端或扩大所有请求预算。
- 原通过项保持：刷新直接读取最新好友和群、同步三处选择列表、保留未保存草稿与选择、新成员不自动授权；并发、失败旧列表、账号归属及迟到响应保护没有被 R1 改动。
- 已静态核对 S0 提示条件：只有读取失败且群列表为空时显示手填群号提示，与实际渲染手填控件的条件一致。

## Validation

- Risk Level: 整体 S2；本轮 R1 为 S1，提示条件为 S0。
- Evidence Reviewed / Checks Performed：Spec、Plan 两轮实施报告、首轮 FAIL、路由及真实 HTTP 测试源码、直接业务 diff、Runtime 默认超时与既有局部超时模式。
- 复用实施阶段一次通过的 `npx vitest run tests/integration/managed-qq-http.test.ts`：1 file / 1 test passed，10.64 秒。本验收没有重跑。测试使用生产 `createServer`、`registerManagedQQ` 和真实 `node:http` socket；受控刷新处理各延迟 5.2 秒，成功返回 200，失败返回 409。断言在生产 `onSend` 之后、响应写出前两次恢复 5000ms；后续 GET contacts 均复用该连接，普通请求的 socket 超时仍为 5000ms；全局两个超时配置保持 5000ms。
- 复用原已通过的 apps 范围类型检查、`managed-qq.test.ts` 的 `one-action connection` 定向回归和 diff 检查；审阅相关测试断言，未重复执行。
- 已目视 `build/qq-contact-refresh/02-narrow-error.png`、`03-narrow-draft.png`，并审阅 `ui-evidence.json` 与协调 Agent 的操作记录：40×40 图标按钮、380px 布局、临时失败通知、新好友未选中、原选择及手填草稿保留；4 次刷新、0 次配置写入。持久缓存 error 对提示条件的影响仅作静态确认，不称为 UI 实测。
- 本验收未执行自动化测试、build、lint、typecheck，未重新启动隔离服务或用户 Desktop/Runtime，未访问真实 QQ 或修改真实数据。

## Issues

无直接相关的未解决问题。

## Regression Risks

5.2 秒处理来自受控 fixture，证明真实 HTTP 传输行为，不能等同慢真实 NapCat 或真实新增好友/群联动已验证。Windows 原生窗口未实测；当前运行中的旧 Runtime 尚未加载新接口，需要用户下次正常重新运行 `npm run desktop:dev` 后生效。

当前在 `dev`，本次改动尚未提交；本验收没有暂存、commit、push 或切换分支。远端和 PR 状态未核实，Git 写操作仍需用户明确指示。

## Required Rework

无。必要证据充分，停止验证。
