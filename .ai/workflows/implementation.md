# 实施与交付流程

[项目协作规范](../AGENTS.md) 为完整规则，本文件只提供执行入口。

1. 依次读取 AGENTS、mission、tech-stack 和 .ai/rules 全部有效规则，再读当前 Spec、Plan、Decision 与 task-handoff。
2. 协调 Agent 检查 Git，确认 dev 或用户指定分支及修改归属；关键决策足以实施后再分配任务。
3. 实施 Agent 只修改获授权范围，不切分支、不自行提交或扩张需求。按 S0～S3 选择必要检查，记录实际结果。
4. 新的独立验收 Agent 对照 Spec 作 PASS/FAIL 判断；不代实施者修改代码、不机械重复验证。
5. FAIL 由新的实施 Agent 返工，再由新的验收 Agent 重验。协调 Agent 处理完所有报告后交付。
6. 满足目标、差异正确、必要检查通过且无直接未解决问题后停止。Git 后续操作按用户明确授权执行。

实施报告优先写入当前 Plan，验收进入当前 acceptance.md；交接更新已有 task-handoff，不堆叠重复过程记录。
