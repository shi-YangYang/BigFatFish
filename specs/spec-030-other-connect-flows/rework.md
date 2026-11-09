# Rework R1

## 验收发现
首轮独立验收 FAIL（见 acceptance.md）。抖音 connect 先返回连接任务已接受，配置验证/保存却在异步任务中；前端把响应当作保存成功并解除草稿保护，无效 Python/浏览器路径或账号 ID 报错后，轮询覆盖用户输入。

## 返工目标
- 在原配置职责层明确保存成功边界，统一覆盖全部字段校验，不复制校验、不以字段特判掩盖响应语义问题。
- 保存失败保留全部草稿和可编辑状态，显示可理解错误；修正后仍一次保存并连接。
- 保持取消/配置替换/停服对迟到写入的保护，不恢复页面串联登录步骤，不动其它平台或审批行为。

## 验证范围
局部跨前后端边界 S2；只执行本失败路径及受直接影响生命周期的定向检查。此前已通过未受改动影响的构建/全体连接/UI检查不重跑。原首轮 acceptance.md 保留，返工报告追加本文，新独立验收写 acceptance-r1.md。

## 状态
R1、R2均完成并经新的独立验收关闭，最终 acceptance-r2.md 为 PASS。root 已读取处理全部实施/验收报告，无额外产品决策待定。持续每阶段本地 commit 授权有效，由 root 执行；不 push。下方为各轮历史报告。

## Implementation Report

### Summary
原 connect 将配置验证/保存与浏览器登录放在同一个后台任务中，立即返回成功；前端收到成功后解除编辑保护，导致保存失败仍被旧值覆盖。修复位于 Runtime 的连接编排职责层：保留同一配置方法和连接意图，把 configure 的 Promise 作为请求响应边界，只有配置保存成功才返回成功；登录继续由 Runtime 后台管理。失败先结束该连接意图再拒绝请求，用户可直接修正并重试，不会被残留 busy 状态阻挡。

### Files Changed
- `apps/runtime/src/douyin/service.ts`：分离配置完成与登录完成的 Promise，返回配置保存确认；连接控制器在配置开始前注册，取消/关闭仍能中止未保存配置。未复制字段校验或改动账号/审批规则。
- `apps/desktop/src/api.ts`：补浏览器路径、Python 路径和账号 ID 校验的中文错误提示。
- `tests/integration/platform-connections.test.ts`：增加一个实际 Fastify 路由/持久化边界用例及 disconnect/close 两个配置等待期间取消用例。

### Important Decisions
不修改前端表单和布局：原保存回调只在 `await api(...)` 成功后解除 `editing`；请求明确失败后原 catch 路径显示错误，轮询保留全部草稿。复用原配置校验覆盖所有字段，维护一个配置职责层。配置成功仅代表设置已保存，真实登录成功仍取决于连接状态。

### Validation
- Risk Level: S2，局部前后端响应边界；未改 schema、权限或依赖。
- `npx vitest run tests/integration/platform-connections.test.ts -t 'configuration acknowledgement'`：3/3 PASS，415ms（其余6项按筛选未执行）。
- 使用临时 SQLite、实际服务/路由和 Fastify inject：三类无效输入均返回400及对应错误，原配置/revision保持，数据库无写入、浏览器未启动；连续修正重试可用。有效请求200前已落库并返回相同revision/config，MCP登录保持挂起，证明没有等待登录结束才响应。
- 使用真实配置方法、挂起队列清理，验证保存过程中 disconnect/close 均拒绝连接确认且不写入账号、不启用、不启动浏览器。
- `git diff --check` 通过。前端 await/错误捕获/编辑保护链路经源码复核；没有重新操作 UI，也未把源码推导记为实际交互验证。
- 未运行全量测试、build、lint、typecheck；原6项连接/UI证据未改动范围不重复。

### Known Limitations
没有真实账号、浏览器登录、外部请求、Windows或打包验证。此前实际UI布局/页签证据沿用；R1无布局变更。

### Remaining Questions
无。待 root 组织新的独立验收；未 commit/push，未修改首轮 acceptance.md。

## Rework R2：原生连接请求等待预算

R1 独立复验已关闭草稿覆盖问题，但新增接口在 Tauri runtime_request 使用默认5秒，未沿用原抖音配置/关闭接口的30秒。保存确认现在正确等待旧浏览器关闭，而其合法退出流程可超过5秒，导致原生端先报失败、后台后保存新版本或断开。

返工仅将新增抖音 connect/disconnect 的原生等待预算与现有配置/关闭一致，不全局放宽超时、不退回提前成功响应、不改其它平台逻辑。S1：局部路由超时选择，只需diff与最小分支核对，不重跑Runtime/界面或打包。新实施 Agent 返工，随后新独立验收写 acceptance-r2.md，原两份验收保留。

### Implementation Report（R2）

#### Summary
根因是新增连接路由遗漏原生客户端已有的长配置请求分支。已在 `runtime_request` 的超时选择处将 `/v1/douyin/connect`、`/v1/douyin/disconnect` 两个精确路径加入原有30秒分支，使它们与其复用的配置/关闭操作等待预算一致；避免合法旧浏览器清理尚未完成时因默认5秒提前报失败。保存确认、后台登录和取消语义保持。

#### Files Changed
- `apps/desktop/src-tauri/src/main.rs`：仅上述两个精确路由条件。
- 本文：追加R2实施报告。

#### Important Decisions
使用现有客户端请求策略，不新增抽象、不全局扩大超时；其它抖音读取接口仍默认5秒，B站前缀仍190秒。未调整Runtime或账号/审批规则。

#### Validation
- Risk Level: S1，局部路由选择。
- 执行 `git diff -- apps/desktop/src-tauri/src/main.rs` 并核对分支：只增加两个路由等值条件，均进入现有30秒分支；前置规则不匹配它们，其它预算和默认分支未变。差异符合目标。
- 按本轮范围未运行测试、build、lint、typecheck、UI或打包；未重复此前已通过检查。

#### Known Limitations
未启动原生窗口或真实浏览器复现慢关闭，不声称实机验证；本轮证据为精确代码差异与超时分支审阅。

#### Remaining Questions
无。实施 Agent `/root/rework_platform_native_timeout` 已完成，等待新的独立验收。当前dev，未commit/push、未改变分支或其它业务代码。
