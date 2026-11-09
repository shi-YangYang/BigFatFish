# Plan

1. 基于现有工作流建立平台运行测试集合；审查实际子进程/路径/ACL 行为，不重跑无关业务全套。
2. 将桌面 job 改为真实前端与 Rust 编译/单元测试，隔离仅 CI 的资源配置；不准备安装包。
3. 加入 Cargo 缓存、超时、并发取消；清理 updater 平台 unused 警告。
4. 同步贡献、安装指南和技术边界；实施报告写在本文件，随后新的独立验收者审阅证据与 diff。

预计文件：.github/workflows/ci.yml、package.json、最小 CI 构建配置/脚本（按需要）、apps/desktop/src-tauri/src/updater.rs、必要的平台测试路径断言、.github/CONTRIBUTING.md、docs/install-and-migrate.md、constitution/tech-stack.md。

## 验证计划

S3，但仅限本次 CI 子系统。一次 YAML/命令静态校验；实际执行新平台测试集合和 Mac 原生编译/测试入口；必要前端构建。已通过检查不重复，不执行完整业务套件或生成安装包。新云端 Windows/Linux 运行需要后续推送，不将本地结果当云端成功。

## 风险与迁移

无数据迁移。macOS/Windows 编译资源覆盖必须避免依赖既有 build/portable；本地正常打包仍使用原配置。减少全量 CI 意味着业务回归需开发者按风险本地验证；安装包格式/签名问题只在手动打包时发现。

## Implementation Report

实施者：`/root/implement_platform_ci`。已完成实施，待新的独立验收。

### Summary / 根因与职责

原工作流把源码验证与发行准备混在一起：三系统重复全量通用检查和便携归档，桌面 job 又使用包含 release:prepare 与安装器的 desktop:build。用户日志中 Rust 已成功，随后进入 WiX；本轮按用户选择在工作流层拆出运行/编译职责，不声称确定或修复 candle 本身的阻塞原因。unused 警告来自 updater 的 macOS 专属实现，按 cfg 限定导入及非 macOS 参数使用，更新行为保持。

### Files Changed

- `.github/workflows/ci.yml`：保留 main push / PR 触发；三系统 Runtime 平台检查、Mac/Windows 原生编译和测试、Linux 容器运行。移除所有 release:prepare、安装器、归档、上传与通用全量检查。增加 workflow/ref 并发取消、显式任务名、20/40/15 分钟 job 超时与关键 step 超时；矩阵 fail-fast=false，某系统失败不取消其他系统的诊断。
- `package.json`：新增 `test:platform`，先 build:node 再执行 7 组已有测试，覆盖 lifecycle、Windows ACL、CLI 输入、停止完成、开发进程接管、维护 CLI 和平台更新边界。保留原 test/typecheck/lint/desktop:build/release:prepare。
- `apps/desktop/src-tauri/src/updater.rs`：仅 macOS 导入 Sha256/Digest；非 macOS 明确消费 preflight 未使用参数，无逻辑改动。
- `tests/integration/desktop-dev.test.ts`：本轮仅一行预期值改用宿主 `resolve('/tmp/data one')`。原函数使用宿主 path.resolve，Windows 绝对路径包含盘符，硬编码 POSIX 预期无效。原有 Spec059 类型修改完整保留。
- `.github/CONTRIBUTING.md`、`docs/install-and-migrate.md`、`constitution/tech-stack.md`：说明 CI/本地职责、手动打包及 debug 原生编译的验证边界。

### Important Decisions

桌面 job 使用 `TAURI_CONFIG={"bundle":{"active":false,"resources":[]}}`，仅在该 job 覆盖原资源映射；已核对本机 tauri-build 的官方依赖源码使用 JSON merge 并从最终 resources 列表复制，空数组替换原 map，无需假造或准备便携资源。正常 tauri.conf.json 和打包命令未改。`cargo build/test --locked --features tauri/custom-protocol` 以 debug 编译，但启用 custom-protocol，真实嵌入新编译的前端而非使用 devUrl 空资源分支。`CARGO_TARGET_DIR` 与 Swatinem/rust-cache workspace 均指向 src-tauri/target/ci，避免覆盖运行中的 target/debug 开发程序。

Linux 原有 Dockerfile 已编译 Runtime 和 Web，因此保留其 job 而不额外重复 Web 构建。CI 不运行原生图形窗口；原生运行检查为 Rust 单测，Runtime 则真实执行隔离进程启动、重启、退出和权限行为。

### Validation

Risk Level：S3（CI/构建），仅检查实际改动子系统，未执行完整业务测试、全仓 lint/typecheck、安装器或发布命令。

- YAML 静态校验通过：使用 js-yaml 解析、assert 精确核对 main/PR 触发、并发取消、三系统/双原生矩阵、TAURI_CONFIG、缓存与 target 目录、超时、7 组测试文件存在、无发行/上传/全仓检查，原本地打包命令与正式资源配置未变。
- `npm run test:platform`：通过，6 文件通过、Windows ACL 文件按系统跳过；29 测试通过、3 项按 Windows 条件跳过，36.02 秒。包含本次 Node 构建。日志 `/tmp/bff-spec060-platform.log`。
- `npm run build:desktop`：通过，249ms；现有上游 Motion 的 use client 提示保留，不属于失败。日志 `/tmp/bff-spec060-desktop-frontend.log`。
- 本机以与 CI 相同的 TAURI_CONFIG/CARGO_TARGET_DIR 执行 `cargo build --manifest-path apps/desktop/src-tauri/Cargo.toml --locked --features tauri/custom-protocol`：通过，33.28 秒，首次创建独立 target/ci；编译输出未包含 portable/runtime 资源的复制依赖。日志 `/tmp/bff-spec060-native-build.log`。
- 在 src-tauri 执行同环境 `cargo test --locked --features tauri/custom-protocol`：8 项通过，编译 5.97 秒，测试 0.05 秒；覆盖管理客户端、更新限制、开发态操作和真实 HTTP 分块至 IPC/取消。日志 `/tmp/bff-spec060-native-test.log`。
- diff 与 `git diff --check` 通过。检查通过后停止，没有重复验证。

### Known Limitations / Remaining Questions

无待实施问题。新 Windows/Linux 云端工作流尚未运行；本轮没有推送/触发 CI。本机 Mac 结果不代表这些系统已通过。未重新运行未改动的 Dockerfile/smoke，保留该 CI 路径；未生成安装器或验证 release 优化/签名/图形启动。未操作真实账号、数据、运行实例，未 stage/commit/push，完整保留 Spec059 待提交改动。
