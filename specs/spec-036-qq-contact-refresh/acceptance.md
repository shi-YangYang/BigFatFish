# Acceptance

## Result

FAIL

验收 Agent：`/root/accept_qq_contact_refresh`。基线 `dev@ccb4623`，独立审阅当前未提交实现；未修改业务代码。

## Spec Coverage

- 通过：在线托管 QQ 的回复设置标题栏新增 beUI 刷新按钮，中文 tooltip/aria-label、40×40 尺寸及 18px 图标符合既有控件。380px 窄屏截图中标题、自动回复与图标保持同行，无横向溢出。
- 通过：POST 刷新实际调用 OneBot，GET 继续读取缓存；首次登录与手动刷新共用 ManagedQQ 内部读取职责，成功原子替换好友/群列表，包括空列表。
- 通过：刷新不保存配置、修改 revision 或自动授权新联系人。前端只替换列表，不写表单、手填值或编辑标记；轮询通过联系人序号拒绝旧缓存覆盖，回复设置保留已有选择。
- 通过：同账号/generation 并发请求共享读取；读前与读后检查实际账号和在线状态，停止、换号与新 generation/序号使迟到结果失效。普通读取失败保留同账号旧列表，并复用临时中文错误通知及重试入口。
- 通过：外部 NapCat 手填路径、管理认证、授权范围和 schema 保持原行为；按钮默认 `type="button"`，不会隐式提交表单。停用/登录丢失清理旧列表，联系人响应携带账号用于页面归属校验。
- 未通过：Tauri 新路由客户端超时已精确改为 30 秒，但 Runtime 同一请求仍受 5 秒 socket 超时限制，未覆盖最多三轮、每轮 4.5 秒的读取时间。见 R1。

## Validation

- Risk Level: S2。
- Evidence Reviewed / Checks Performed：独立审阅 Spec/Plan、实施报告、全部直接 diff、ManagedQQ 生命周期与 OneBot 客户端、QQConnection 状态和轮询、beUI Button 适配器、Runtime 管理认证/超时及既有长请求路由边界。
- 复用已通过证据，未重复执行：apps 范围 TypeScript 检查；`managed-qq.test.ts` 的 `one-action connection` 定向用例（1 passed / 3 skipped，1.48 秒）；实施阶段 `git diff --check`。
- 用例 diff 覆盖缓存与主动刷新差别、并发共享、配置及 revision 不变、失败保留、空列表、换号和停机迟到结果。现有夹具请求快速完成，不能证明超过 5 秒的 HTTP 请求能完成。
- 已查看协调 Agent 的 `build/qq-contact-refresh/02-narrow-error.png`、`03-narrow-draft.png` 和 `ui-evidence.json`：临时失败提示、新项未选中、原选项保留、手填草稿保留，4 次刷新、0 次配置写入。`01-button.png` 未包含刷新图标，不作为位置或尺寸证据。
- 验收前 S0 修正已核对：仅 `lists.error && lists.groups.length===0` 显示手填群号提示，避免保留非空列表时误导。此持久 error 分支按代码审阅确认，隔离 UI 夹具未覆盖该缓存标记。
- 本轮验收没有运行测试、build、lint、真实 QQ/模型调用或重启 Desktop/Runtime；没有暂存、commit、push 或切分支。

## Issues

### R1 — Runtime 的 5 秒连接超时会截断较慢的刷新请求

`apps/runtime/src/server.ts:9` 配置 `connectionTimeout: 5000`。新路由 `apps/runtime/src/channels/managed/service.ts:178` 直接返回 `managed.refreshContacts()`，没有调整当前 socket 的超时；`readContacts()` 则顺序执行「账号/在线核验 → 联系人读取 → 账号/在线核验」三轮网络请求，各轮通过 `onebotRead()` 最多等待 4500ms。

因此正常但总耗时超过 5 秒的读取会在 Runtime 端先被断开，前端报失败，Tauri 客户端的 30 秒设置不能修复服务端断连。后台读取还可能继续并更新缓存，使页面稍后轮询突然出现新列表而前次点击被报失败。现有 `channels/routes.ts` 的发送接口已采用局部 `preHandler` 设置 socket timeout、`onSend` 恢复原值的模式，此新路由遗漏了同一边界。

## Regression Risks

真实新增好友/群联动、Windows 原生窗口及慢真实 NapCat 未实测；当前旧 Runtime 尚未加载新增路由，需用户下次正常重新运行 `npm run desktop:dev`。这些限制不作为额外返工范围，但不能把隔离证据称为真实账号已验证。

## Required Rework

- R1：仅为新联系人刷新路由设置覆盖完整有界读取时间的 Runtime socket timeout，并在响应时恢复已有默认值；保持其他路由的超时策略和接口行为。
- 增补或调整最小定向证据，确认总耗时超过 5 秒且每轮未超 OneBot 时限的刷新仍可完成，以及该局部覆盖不会遗留到其他请求。无需重跑此前无关通过项或完整测试/build。
- 按 AGENTS.md 由新的实施 Agent 返工，之后新的独立验收 Agent 重新给出 PASS/FAIL。
