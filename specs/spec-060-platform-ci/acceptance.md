# Spec060 独立验收

## Result

**PASS**。验收 Agent：`/root/accept_platform_ci`。无待返工项。

## Spec Coverage

- `checks` 仍仅由 main push / PR 触发；Runtime 矩阵保留 Linux、macOS、Windows，Desktop 矩阵保留 macOS、Windows，Linux 容器仍编译 Runtime/Web 并执行真实 CLI 生命周期 smoke。与既有产品平台范围一致。
- 工作流不再调用全仓 typecheck/lint/npm test、发行准备、安装器、归档或上传。`test:platform` 明确选择 7 组已有系统相关测试，包含进程启动/停止/接管、内核锁、CLI 输入、权限和维护边界；原全量本地命令及断言保留。
- 桌面先编译实际前端，再执行 `cargo build/test --locked --features tauri/custom-protocol`。独立核对已安装的 Tauri 依赖源码：`TAURI_CONFIG` 通过 JSON merge 替换 resources map 为数组，空数组不会复制便携目录；`custom-protocol` 使 generate_context 进入真实 frontendDist 嵌入分支。正式 tauri.conf.json 和本地 desktop:build 未改，不依赖残留 build/portable。
- Cargo 缓存路径与 `CARGO_TARGET_DIR` 同为 src-tauri/target/ci；并发组按 workflow/ref 隔离，显式取消旧运行；job/关键 step 有限时，矩阵 fail-fast=false 保留各系统诊断。命令未包含 Windows 不支持的 shell 环境赋值。
- updater 的 sha2 导入只在 macOS 编译，非 macOS 参数显式消费，原更新行为保持。desktop-dev 本轮仅将路径期望改成宿主 resolve，与被测函数一致；Spec059 的类型修复完整保留。
- 贡献、安装和技术边界文档准确说明 CI 仅编译/运行、手动打包及未覆盖安装器/release 优化/图形启动的边界。

## Validation

- Risk Level：**S3**（构建与 CI），检查限于本次工作流及直接相关模块。
- 已完整阅读当前 Spec、Plan 中实施报告、Decision029、当前交接和适用规则，审阅实际 diff、所选平台测试与 Rust 单测、Tauri 配置合并/资源复制/前端嵌入源码及构建输出。
- 核对 `/tmp/bff-spec060-platform.log`：Node 编译完成，6 测试文件通过、Windows ACL 文件按平台跳过；29 passed、3 skipped，36.02 秒。条件跳过与源码中的 Windows DACL / Windows 专属更新场景一致。
- 核对 `/tmp/bff-spec060-desktop-frontend.log`、`/tmp/bff-spec060-native-build.log`、`/tmp/bff-spec060-native-test.log`：前端构建通过，Mac 独立 target/ci 原生编译完成，Rust 8 项全部通过。检查实际 build-script 输出未引用 portable 资源，与仅 CI 的覆盖一致。
- 实施者已完成 YAML/矩阵/缓存/超时/本地打包命令静态校验及 diff 检查；本验收独立审阅工作流语义与证据，没有机械重跑已通过测试、build、lint 或 typecheck。仅新增本验收文档，未修改业务代码、暂存、提交或推送。

## Issues / Required Rework

无。实现、diff 和必要证据满足规格，停止追加验证。

## Regression Risks

尚未执行新版 Windows/Linux 云端 CI；本机 Mac 通过不能代表这些系统通过。Linux Dockerfile/smoke 未改，本轮未重新运行。原生日常检查不生成安装器、不启动图形窗口、不验证 release 优化或签名；这些由用户手动打包负责。WiX candle 停留的具体原因未得到证明，本轮按用户决定从 CI 移除该打包阶段，并非声称修复 WiX。
