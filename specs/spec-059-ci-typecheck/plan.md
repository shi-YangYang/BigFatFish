# CI 类型检查修复计划

先核对报错文件对应真实契约，优先同步共享模型夹具声明并让使用处正确处理可选字段；再处理 HTTPS mock、QQ 状态/记录、进程句柄与 Fastify 超时断言。保留所有运行行为和断言目标。

验证以用户失败的 npm run typecheck 完整命令为主；若改动了测试的运行语句或生产类型边界，仅检查这些直接受影响的场景，不运行全仓 npm test/build/lint。通过后停止；完整实施报告追加本 Plan，新独立验收以 diff 与已有证据为主。

## Implementation Report

### Summary

已修复用户日志中的全部 TypeScript 错误。共享模型夹具声明与实际请求形态同步，相关使用处处理可选值；测试继续验证原有行为，生产侧只明确 QQ 记录查询的返回类型。完整 `npm run typecheck` 已通过，实施代码冻结待独立验收。

### Files Changed

- `tests/fixtures/model.d.mts`：补齐已有的 `emotionResponse`、`sticker`、`replyTools` 控制项，声明消息、OpenAI/Anthropic 工具及可选请求体。转写请求没有 `body`，模型列表请求没有 `messages`，未将两者虚构为必有字段。
- `tests/integration/{ai,background-memory,backup,bilibili,emotional-life,model-defaults,model-reasoning,persona,qq-self-tools,qq-stickers}.test.ts`：同步上述可选契约；需要读取具体模型请求、工具列表时保留明确的存在性和结构断言。
- `tests/integration/connection-login-feedback.test.ts`：QQ 状态夹具使用当前 `builtin: true` 契约，移除已不存在的 `manifest`。
- `tests/integration/desktop-dev.test.ts`：准备回调使用具名且已赋值的进程句柄，回调后断言句柄存在，再保留进程退出和可重试断言。
- `tests/integration/{managed-qq-http,model-connection-http}.test.ts`：读取实际公开的 `app.server.requestTimeout`，继续断言 5000 ms；原有 socket 与连接超时检查保留。
- `apps/runtime/src/{ai/web-tools,channels/sticker-network}.test.ts`：将仅模拟当前 URL/options/callback 重载的局部 HTTPS 替身，通过 `unknown` 显式跨越重载类型边界并说明原因；替身行为和安全检查不变。
- `apps/runtime/src/channels/{types,service}.ts`：新增与既有 SELECT 投影一致的 `QQDelivery` 返回类型，保留 SQL、记录顺序、条数上限及 `proactive` 布尔转换。

### Decisions

根因是共享夹具声明、历史测试和当前实现契约不同步，而不是 CI 范围需要缩小。未修改依赖、tsconfig、工作流或模型夹具运行逻辑，未增加 `any`、忽略诊断或取消断言。Fastify 当前安装源码在创建 HTTP 服务时将 `options.requestTimeout` 设置到 `server.requestTimeout`，因此直接验证公开服务对象，避免断言不存在于 `initialConfig` 类型中的属性。QQ 查询仅在 SQLite 结果边界补充确定的列类型，没有修改业务运行行为。

### Validation

风险级别 S2，验证范围保持在本次类型契约和变动的测试断言：

1. `npm run typecheck` 完整通过，包含 `tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.json`。首次修复轮仍发现准备回调中的进程变量可能未定义，已用具名局部句柄修正；最终联合工具类型修正后再次通过。最终日志：`/tmp/bff-spec059-typecheck.log`。
2. `npx vitest run tests/integration/managed-qq-http.test.ts tests/integration/model-connection-http.test.ts tests/integration/desktop-dev.test.ts tests/integration/connection-login-feedback.test.ts tests/integration/qq-self-tools.test.ts tests/integration/emotional-life.test.ts -t 'keeps contact refresh sockets|keeps real diagnostic sockets|abort while preparing|shows the current login step|runs real DSH autonomous tools|uses a persisted emotional appraisal'`：6 个文件、6 个选中场景通过，其余 15 个按名称过滤跳过。日志：`/tmp/bff-spec059-targeted.log`。
3. 最终检查补全 Anthropic 工具形态，并给 QQ 两个工具检查增加 OpenAI 结构收窄后，仅重跑直接受影响场景：`npx vitest run tests/integration/qq-self-tools.test.ts -t 'runs real DSH autonomous tools|registers global tools'`，2 个场景通过，2 个按名称过滤跳过。日志：`/tmp/bff-spec059-qq-tools.log`。未重复执行其它已通过场景。
4. 最终 diff 人工核对；类型错误均在对应契约或收窄位置处理，断言目标未削弱。未运行全仓测试、build 或 lint。

测试使用本地夹具、临时数据和隔离浏览器，没有读取真实聊天、调用收费模型或向真实平台发消息。

### Known Limitations

未推送或重新运行云端 CI，因此结论仅覆盖本地完整类型检查和上述定向场景，不代表其它 CI 阶段已验证。此次实现未 stage、commit 或 push；用户此前的本地提交请求已由主 Agent 用于保存 Spec058。

### Remaining Questions

无实施阻塞；待新的独立 Agent 验收。
