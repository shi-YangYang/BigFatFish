# CI 触发去重计划

只将 `.github/workflows/ci.yml` 顶层 on 改为结构化事件：push.branches=[main]，pull_request 保留空配置。维持 jobs/permissions 与基线一致。实施者最多运行一次本地 YAML 解析/语义对比，加 diff 检查；不安装额外工具或运行真实 CI。完整简短实施报告追加本文件，新独立验收以 diff 和证据为主。

## Implementation Report

### Summary / Files Changed

实施 Agent `/root/implement_ci_trigger` 已完成并冻结。仅修改 `.github/workflows/ci.yml` 的事件配置：push 限定 main，pull_request 使用默认事件。本文件追加实施记录，其它已有治理文档改动属于根协调，均保留。

### Important Decisions

重复运行来自同一次开发分支更新同时命中 push 和 pull_request。直接在 workflow 触发层排除开发分支 push；PR 保留默认 opened/synchronize/reopened 行为及任意目标分支，main push 保留合并后检查。没有删减工作、矩阵、构建或产物，也没有引入额外 API 查询和调度状态。

### Validation

Risk Level：S1。只运行一次 Node + 已安装 js-yaml 的定向检查：解析基线与当前 YAML，断言当前 on 等于 `{push:{branches:['main']},pull_request:null}`，移除 on 后对整个 workflow 深度比较；结果为 `PASS: main-only push, default pull_request, and all non-trigger fields unchanged`。`git diff --check` 通过，已阅读实际 workflow diff。

未运行项目测试、build、lint 或 typecheck，未新增测试文件或安装依赖。必要检查通过后停止追加验证。

### Known Limitations / Remaining Questions

这是本地配置及语义核对，尚未提交或推送，未触发或取消云端 CI；当前既有运行不会因此自动消失。无实施范围内的遗留问题，等待新的独立验收。未切分支、暂存、commit、push 或创建子 Agent。
