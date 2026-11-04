# Acceptance

## Result
PASS — R1 新独立验收，2026-11-04，验收 Agent `/root/accept_managed_dev_r1`。首轮唯一 R1 已关闭；首轮 FAIL 原始记录保留于下方。

## Spec Coverage
- 单条开发命令：`desktop:dev` 指向 supervisor，准备当前 Node 源码后认证 Runtime 身份和就绪，再启动 Vite/Tauri；环境覆盖、桌面设置和原生 CLI 使用同一数据目录。既有原生启动及当前数据接管证据支持该项。
- 旧后台接管与保护：精确仓库入口、认证 PID/instance、开发目录锁及 expected-instance 停机检查保留；已有 10 项集成用例覆盖真实旧 daemon、外部实例、重复会话和身份不符拒停。
- 生命周期：启动失败、初始化期间中断、受管桌面正常退出和 Runtime 异常有定向进程证据；协调者隔离原生开发收到 supervisor SIGINT 后四个 PID、连接文件和前端端口均清理。R1 未修改 supervisor 异常回收或 worker 行为。
- 开发/正式边界：`managed()` 同时要求 debug 构建与显式环境标识；原生托管 setup 不运行 detached start/desktop-finish，窗口和菜单退出交还 supervisor；非托管路径保留原行为。原生源码热重载不另起后台，后端更新通过重跑开发命令生效。
- R1 维护边界：`development.rs` 统一操作策略；`desktop_maintenance` 对 export/restore 的拒绝位于 `spawn_blocking` 前，公共 `desktop::cli` 在命令构造和子进程启动前再次执行同一策略。在线/离线 update 的 install=true 在配置、文件及网络访问前拒绝；restart 在 ALLOW_EXIT 和 `app.restart()` 前拒绝。拒绝分支不会到达停服、写入、安装或重启调用，因此不再触发首轮已证实的维护中断链。
- 允许行为与错误反馈：backup inspect、update install=false 继续原有检查/签名验证链；非托管策略直接放行，独立 CLI 维护源码未改。备份及更新已有 catch(fail)，restart 补齐 catch(fail)，统一经过 notifyError/errorText 展示退出开发、独立 CLI/安装版操作或重新运行开发命令的中文说明。
- 用户原始断连问题：协调者证据记录旧 PID10046 退出，新 worker PID85905 继续使用原数据，已有会话保留，流式接口为 200 且收到 snapshot-end；本轮仅审阅记录，没有再次读取用户内容或重启会话。README、开发指南、技术栈、Spec 和 Decision013 已说明开发维护限制。

## Validation
- Risk Level: S3，限定开发进程生命周期与原生持久化维护交界。
- Evidence Reviewed / Checks Performed:
  - 读取 AGENTS、mission、tech-stack、全部 `.ai/rules`、Spec/Plan、两轮实施报告、首轮 FAIL、Decision013、当前交接、相关 diff 及开发 supervisor/worker/进程工具和定向测试源码。
  - 独立核对 `development.rs` 策略矩阵、`desktop.rs` 两个入口、`updater.rs` 在线/离线/restart 调用顺序，以及 Setup → fail → notifyError → errorText 的反馈链；禁止操作均在副作用前返回 Err，只读和非托管操作保留。
  - 审阅 `build/managed-dev-r1-rust.log`：Rust 编译完成，development::tests 3/3 通过；测试覆盖托管拒绝矩阵、只读允许和非托管放行。审阅 apps 范围类型配置与 R1 报告：`npx tsc -p build/chat-experience/tsconfig.json` exit 0，日志 `build/managed-dev-r1-types.log` 无输出。不是全项目类型检查。
  - 审阅已有 Node 构建、Rust check、10/10 supervisor 测试日志，以及 `build/managed-dev-native-evidence.json`、`build/managed-dev-current-evidence.json`；与 Plan 的真实启动、SIGINT 清理、接管及流式恢复记录相符。
  - 本轮未运行新的自动化检查，未重复已通过的测试、构建或原生 smoke。R1 的 Runtime 不受拒绝影响由纯策略测试与前置返回的调用顺序提供证据，不冒充实际 UI 点击或运行时存活测试。

## Issues
无本次范围内未解决问题。首轮 R1 通过原生开发职责层的前置限制关闭，未通过忽略 Runtime 退出、伪报维护成功或改动独立 CLI 来掩盖问题。

## Regression Risks
- Windows Job Object、Windows 原生运行仍无实机证据；已有实现与首轮代码审查不等于 Windows 实测。
- 原生关闭按钮未实际点击；已有原生分支/编译、受控正常退出、协调者 SIGINT 清理及固定 Tauri CLI 正常退出处理的源码核对记录，不声称覆盖真实关闭按钮或完整终端前台进程组信号。
- 未执行实际备份、恢复、安装更新或重启，也未更改当前用户 Runtime/Tauri、真实数据、更新源或归档。正式维护兼容性依据非托管无条件放行与原流程未改，并非本轮重新执行全套发行维护验证。
- 托管开发窗口有意拒绝上述维护，须退出开发后使用独立 CLI 或正常安装版；不新增跨进程维护协议，之后若支持在线开发维护需另行设计所有权交接。

## Required Rework
无。开发验收通过；协调者按既有授权完成 Spec/交接收尾及本地 commit，不包含 push。验收接手时位于 dev，基线 82fb2f0，改动未提交；远端未刷新，本验收未执行 Git 写操作。

# 首轮独立验收（历史，R1 已由上述重验关闭）

## Result
FAIL — 首轮独立验收，2026-11-04，验收 Agent `/root/accept_managed_dev`。

## Spec Coverage
- 当前源码准备、同目录开发锁、认证 PID/instance 与精确仓库入口接管、受管 Runtime/Vite/Tauri、expected-instance 停机、开发/发行隔离均有对应实现与已有定向证据。
- 已阅读协调者的真实原生启动、旧后台接管、现有聊天流式接口恢复与隔离 SIGINT 清理证据；未操作当前用户会话。
- 存在一个直接相关的维护入口回归，尚不满足生命周期职责一致及现有数据操作兼容要求，不能通过。

## Validation
- Risk Level: S3，限本次开发生命周期、进程身份及原生适配。
- Evidence Reviewed / Checks Performed:
  - 阅读 AGENTS、mission、tech-stack、全部 `.ai/rules`、Spec/Plan/实施报告、Decision013、当前交接、相关 diff、启动/停止依赖链与 10 项定向测试源码。
  - 审阅 `build/managed-dev-{node,tests,rust,native,current}.log`、`build/managed-dev-native-evidence.json` 和 `build/managed-dev-current-evidence.json`。Node 构建、10/10 测试、Rust check 为已存在的通过证据，本验收未重复运行。
  - 仅针对新发现问题运行一次临时目录复现：使用真实受管 Runtime、受控桌面子进程及真实 `dist/cli/src/main.js backup export --data-dir <临时目录> --json`。CLI 导出退出 0、归档存在，但 supervisor 的 `finished` 以 `DEV_RUNTIME_EXITED` 拒绝，受控桌面已经终止。测试子进程和临时目录均清理。
  - Runtime 原有生命周期已安装 SIGINT/SIGTERM 处理器；未发现单独足以阻塞的确定信号清理缺陷。协调者发送的是 supervisor PID 的 SIGINT，并非终端前台进程组信号，不把它记作完整终端组验证。
  - Windows Job Object 的结构、悬挂创建/分配/恢复、退出清理和命令参数编码仅作代码审查，没有 Windows 实机。原生关闭按钮未实际点击；不将这些项目写成实测通过。

## Issues
### R1：托管开发仍允许维护入口自行停服，导致 supervisor 中止桌面及维护进程
`apps/desktop/src-tauri/src/desktop.rs:48-53` 的托管检查仅拒绝直接 `start/stop/restart`，`desktop_maintenance` 仍把 `backup export/restore` 交给 CLI。`apps/cli/src/maintenance.ts:28` 会先停止受管 Runtime；`scripts/desktop-dev-session.mjs:158-163` 把该正常退出作为异常并调用清理，清理首先终止整个 Tauri 进程组（同文件第 87 行）。隔离复现已确认导出会结束开发桌面。实际原生维护 CLI 是该进程树的一部分，因此大归档导出或恢复可能被中途终止；本轮没有执行恢复，也未声称观察到数据损坏。

同根因入口还包括：
- `updater::desktop_update(install=true)`：经 `update desktop-snapshot` 停服，然后执行预检/安装。
- `updater::desktop_update_file(install=true)`：同一快照/停服/安装链。
- `updater::desktop_restart`：直接 `app.restart()` 绕开 supervisor 的原生会话所有权；现有前端按钮也未捕获这个 invoke 的失败。

## Regression Risks
修复不能更改正式安装版及独立 CLI 的备份、恢复和更新语义；只读 `backup inspect`、在线更新检查与离线签名验证不需要停服，应继续可用。不要通过忽略所有 Runtime 退出事件来掩盖问题，否则会丢失真实后台异常的清理保证。

## Required Rework
1. 采用协调者确认的最小范围：托管开发模式在产生停服/安装/原生重启副作用之前明确拒绝这些操作，不扩展为新的维护控制协议。
2. 精确入口：`desktop_maintenance` 的 export/restore；`desktop_update` 和 `desktop_update_file` 的 install=true；`desktop_restart`。在共享原生开发/CLI 适配层统一表达拒绝策略，避免只保护一个按钮。若 CLI 层列举命令，则需覆盖同类 `update desktop-snapshot/rollback/desktop-rollback/install/install-file` 的停服动作；不要求改动独立 CLI 行为。
3. 保留 inspect、install=false 的检查/验证。给拒绝返回明确中文说明：先结束开发会话，再通过独立 CLI 维护数据；应用更新使用正常安装版流程；重启开发使用退出后重新运行 `npm run desktop:dev`。将重启按钮的拒绝送入已有错误提示，避免未处理 Promise。
4. 补对应开发模式边界的最小定向验证，证明拒绝发生于停服/安装/重启之前、Runtime 保持存活、允许的只读路径保持；同步 Spec/Decision/开发文档所需的开发模式限制，再由新的独立 Agent 验收。不重跑无关业务套件。
