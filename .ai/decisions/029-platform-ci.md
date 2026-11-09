# Decision：CI 专注跨平台运行和编译

## Context

每次 PR 的三系统通用全量测试与安装包准备成本高；Windows 在 Rust 成功后停留于 WiX。用户明确要求仅保留 CI 运行和编译，安装包由其手动生成。

## Decision

保留三系统 Runtime/CLI 的平台测试、macOS/Windows 原生宿主编译与测试、Linux 容器运行。去除日常 CI 的全量通用检查、发行目录准备和安装包/归档上传，本地原命令保留。使用缓存、任务超时、同 PR/分支旧运行取消。

## Reason / Alternatives

按用户选择，不采用每个 PR 自动打包或新增手动 CI 安装器任务。CI 覆盖本机不能代表的系统行为；普通业务检查本地按风险执行。

## Consequences

不再在每次 PR 发现安装器或正式打包问题；手动打包负责该边界。本地 Mac 通过不代表 Windows/Linux 新工作流已通过。未获授权不得为验证而自动提交、推送或取消云端旧作业。
