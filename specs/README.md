# Spec 管理

规格目录统一为 `spec-XXX-short-name/`。先从 [_template](_template) 创建草稿，明确目标、非目标、关键决策及可逐项验收标准；关键不确定性解决后才能实施。

- `spec.md`：定义实现什么及完成标准。
- `plan.md`：记录模块、顺序、接口、验证范围和风险，不扩张 Spec。
- `acceptance.md`：实施结束后记录独立验收，仅使用 `PASS` 或 `FAIL`，标注风险级别和实际证据。

生命周期：Draft → Ready → Implementation → Acceptance → Done。FAIL 进入 Rework：新的实施 Agent 返工，新的验收 Agent 重验；按需添加 `rework.md`，不得把旧验收结论复用为新结果。实施报告优先纳入已有 Plan，避免另建重复过程文档。

| Spec | 范围 | 结果入口 |
| --- | --- | --- |
| [001 仓库初始化](spec-001-repository-initialization/spec.md) | 目录、Git、忽略规则和基础文档；不代表完整 P0 | [验收](spec-001-repository-initialization/acceptance.md) |
| [002 P0 工程基础](spec-002-p0-foundation/spec.md) | Runtime/CLI/SQLite/API、桌面壳、CI及实际运行 | 实施报告与独立验收持续更新 |
| [003 P1 AI 鱼核心](spec-003-p1-ai-core/spec.md) | 真实DSH、模型、人格、会话与流式聊天 | [代码验收及外部缺口](spec-003-p1-ai-core/acceptance.md) |
| [004 P2 记忆养成](spec-004-p2-memory-life/spec.md) | 有来源的长期记忆、日记、兴趣、经历、关系、心情与主页 | [返工复验PASS](spec-004-p2-memory-life/acceptance.md)，外部缺口单列 |
