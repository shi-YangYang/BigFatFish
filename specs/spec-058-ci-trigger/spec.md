# CI 触发去重

状态：Done，[独立验收 PASS](acceptance.md)。EXISTING，实施基线 dev / ea620dd，已按用户指令本地提交 1a837de、未推送。S1：单一 workflow 事件过滤；不改变构建内容、权限、产物或发布行为。

## 背景与当前行为

用户要求 PR 的两个 CI 合成一个。`.github/workflows/ci.yml` 仅有一个 checks 工作流，但同时监听所有 push 与 pull_request。GitHub PR #1（dev → main）的 ea620dd 同时存在 push 42544624587 与 pull_request 42545081788 两个运行实例。

## 目标与目标行为

PR 创建、更新或重新打开时，由 pull_request 事件运行一次 checks；仅 main 的 push 运行检查，dev 和其它分支 push 不另开重复运行。合入 main 后保留主分支检查。

## 非目标与技术约束

不合并或删减 node/desktop/linux-container 任务及矩阵，不修改权限、依赖、构建步骤、产物，不增加额外调度逻辑，不取消现有云端运行。当前无本轮 commit/push 授权。

## 功能需求、兼容性与边界

保留 pull_request 默认事件及任意目标分支，包含 fork PR；push 仅 branches: [main]。PR 所有原有检查任务名称保持稳定。

## 验收

- [x] push 仅 main，pull_request 保留默认事件。
- [x] 原工作流 jobs 与 permissions 未变。
- [x] diff 和一次最小 YAML/触发条件检查通过；不运行项目测试、build 或全量检查。
- [x] 新独立 Agent 验收，区分本地配置与尚未推送的实际云端触发。

## 待确认问题

无；去重方式由已核实事件及既有 dev → main 流程确定。
