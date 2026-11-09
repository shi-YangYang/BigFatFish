# Plan — 移除设定页版本记录

## 实施
1. 同一实施 Agent 修改 Personality.tsx，移除仅历史区使用的状态、请求、渲染及导入，保留 save 与版本字段契约。
2. 确认 persona-history-text 无其他使用后删除对应样式；README/docs/ai-core 只去除关联的界面版本记录表述，不改其他产品能力。
3. S1：审查 diff，并最多运行一次单文件 ESLint。无需新增测试、build、全量 lint/typecheck、重启 Runtime 或修改真实配置。
4. 新的独立验收 Agent 只读核对 Spec、diff 及实施证据，不重复通过检查。根协调收尾，不提交。

## 边界与风险
纯前端删除不会影响既有数据库或后端 API；主要检查误删保存依赖、残留无用变量及版本字段是否仍随人格对象保存。Desktop/Web 共享此组件，同步生效。

## Implementation Report
- `/root/implement_remove_persona_history` 已删除版本记录折叠区、专属历史状态/ref、请求及保存后刷新逻辑，清理 ContentScroll 导入与独占 persona-history-text 样式。
- 修改 Personality.tsx、style.css、README.md、docs/ai-core.md；文档仅去除相关历史界面说明。
- 当前人格加载、保存防重、成功/失败反馈、两卡预设与完整编辑均保留；保存继续传递整个 Persona（含 version）。后端历史/API/数据未改。
- S1：diff 审阅及 `npx eslint apps/desktop/src/components/Personality.tsx` 通过。未新增测试、build、全量检查、写真实数据或重启服务；未暂存/commit/push。无已知阻碍，等待新的独立验收。
