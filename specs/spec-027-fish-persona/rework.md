# Rework R1：活动选择排除重复人设

## 验收问题
首轮独立验收 FAIL，唯一 P2：`ChatService.chooseActivity()` 在后台 user prompt 中直接序列化 `life.overview()`，其中包含完整 persona，口吻示例绕过 system 中的过滤重新进入后台任务。

## 目标与范围
只修复活动选择的状态投影，排除重复的 persona，保留原有兴趣、心情、活动等决策所需状态。界面 overview API 保持，不在源状态对象上删除属性，不变更选择结果/权限/格式。不得为此全局改 LifeOverview 或重写任务系统。

## 验证
S1 局部函数行为修复，新增一个定向检查，验证活动选择最终 engine input 或真实 DSH wire 中不含当前人格的 role/traits/style/口吻示例，且仍保留候选、兴趣和其他需要的状态。只运行该最小用例，不重跑已经通过的七个检查或 build/typecheck/UI。

## 实施报告

### Summary
R1 实施完成。根因是活动选择复用了面向概览页面的完整状态，persona 经 user prompt 再次注入，绕过统一 system 提示的任务过滤。修复在 `chooseActivity()` 的输入组装处非破坏性解构 overview：persona 单独交既有统一提示，其余 state 保持原字段序列化。没有改动共享 overview、人格存储、权限或前端。

### Files Changed
- `apps/runtime/src/ai/chat.ts`：仅 R1 所属活动选择函数的状态投影。
- `tests/integration/persona.test.ts`：新增一个活动选择真实 DSH / 本地模型 fixture 回归。

### Important Decisions
保留其余决策状态，不为一个调用点新增抽象或修改公共 API。原会话的人设处理及已通过的 UI 代码保持。测试检查完整模型请求，而不只检查 system prompt，覆盖此次跨输入通道遗漏。

### Validation
- Risk Level：S1。
- 审阅 R1 差异，确认仅分离 persona，未修改原 overview 对象。
- `npx vitest run tests/integration/persona.test.ts -t 'keeps conversational persona out of activity-selection requests'`：最终 PASS，1 passed / 2 非目标用例 skipped。真实 DSH 请求不含 persona 的 role/traits/style 或「口吻示例」；候选、非空兴趣、心情、近期活动、确认数保持，合法 index/reason 正常返回，调用后 overview 内容不变。
- 首次定向执行因测试误取最后一条 user 消息而失败：DSH 会追加 runtime-context 消息。已将测试定位到带 `BFF_ACTIVITY_CHOOSE` 标识的实际任务输入，再运行同一用例通过；未放宽业务断言。
- 未重复原七项测试、build、typecheck、UI 或全量检查，未触碰真实用户数据、云模型、QQ；未执行 Git 写操作。

### Known Limitations
本地 fixture 证据仅覆盖实际请求传递与结果协议，不代表云模型主观人设效果。最终独立验收由新的验收 Agent 完成。

### Remaining Questions
无 R1 实施阻塞；源码已冻结。
