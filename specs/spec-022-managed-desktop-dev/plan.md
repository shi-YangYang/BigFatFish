# Plan

最终状态：R1 已由新的独立验收 Agent `/root/accept_managed_dev_r1` 判定 PASS，首轮 FAIL 与返工证据保留；所有实施/验收报告已读取处理。按用户持续阶段授权本地 commit，不 push；准确提交见 Git log。

## 根因和职责
Tauri dev 只负责 UI/原生构建，桌面复用 CLI detached 服务；没有开发会话统一管理后台与当前代码的关系。开发启动器负责构建、所有权、就绪和退出，原生托管适配避免重复启动/停止并保持数据目录一致。现有认证与实例锁不绕过。

## 实施顺序
1. 核实 Tauri 子进程清理、桌面配置位置和 Windows/Unix 进程身份；选择最小可靠的普通模块实现并记录关键取舍。
2. 开发启动器管理 Runtime 与 Vite/Tauri；保留已有 CLI daemon 语义，优先重用就绪/停机能力。
3. 原生显式开发适配使用开发 CLI/数据目录，关闭和退出交还 supervisor，打包行为不变。
4. 定向进程验证及原生检查，必要的真实桌面 smoke 由协调者在隔离目录执行；再刷新已获授权的用户开发会话。
5. 更新使用文档、独立验收；按持续授权本地 commit，不 push。

## 风险与验证
S3，仅开发构建入口和进程生命周期，验证限定在 supervisor、Runtime 归属/就绪/停机、原生托管分支。测试使用临时数据和真实子进程/受控失败；不调用真实云模型，不跑全项目完整测试。需要证明启动失败不遗留实例、重复/未知实例保护、Ctrl+C/关键退出清理及新流式路由就绪。已有检查通过后不重复，正式行为通过相关分支审查及原生编译覆盖；Windows 无主机时记录未实测。

## Implementation Report（2026-11-04）

### Summary / Root Cause
实施 Agent：`/root/implement_managed_dev`。旧开发链只管理 Tauri/Vite，原生 setup 经发行 CLI 启动 detached daemon，之后不断复用旧服务。修复位于开发会话 supervisor 和原生开发适配层：每次编译当前 Node 源码，持有数据目录开发锁，核实并优雅接管同仓库旧实例，启动独立 IPC Runtime，认证就绪后启动 Vite/Tauri；退出统一回收本次资源。未修改聊天 UI 掩盖错误，正式 daemon 与安装版生命周期不变。

### Files Changed
- `scripts/desktop-dev.mjs`：命令入口、SIGINT/SIGTERM 与简明失败说明；`package.json` 的 `desktop:dev` 指向它。
- `scripts/desktop-dev-session.mjs`：设置/环境数据目录选择、独立 SQLite 开发锁、源码准备、启动顺序、认证身份及清理。Vite 采用已安装的 JS API，直接随 supervisor 关闭。
- `scripts/desktop-dev-processes.mjs`：精确旧 Runtime 入口识别、受管子进程、参数边界、超时和自有进程组清理；`desktop-dev-runtime.mjs` 是仅开发使用的 IPC worker，父连接断开会优雅停止服务，不改变正式 runtime/main。
- `scripts/desktop-dev-windows.ps1`：Windows Tauri 子树 Job Object 包装；悬挂创建后先加入 Job 再恢复，CLI 自身先退出也通过 KILL_ON_JOB_CLOSE 清理后代。使用系统 PowerShell 与项目已有 EncodedCommand 方式，不修改全局执行策略。Windows 未实机运行。
- `apps/cli/src/process.ts`：`stop(p, expectedInstanceId?)` 在发送 shutdown 前核对可选实例 ID，避免接管核实后出现替代实例被误停；原 CLI 调用不变。
- 原生 `development.rs`、`desktop.rs`、`main.rs`：只有 debug 且显式 supervisor 环境可启用；统一数据目录和当前开发 CLI，跳过 detached start/desktop-finish，开发关闭/退出交还 supervisor，Rust 热重载不创建新后台。托管会话中不允许 UI 切换到另一个数据目录；正式模式保持既有行为。
- `tests/integration/desktop-dev.test.ts`：使用临时目录和真实 Runtime/受控子进程的定向测试。
- README、开发者指南、技术栈：一条命令开发、数据/退出语义、外部后台冲突、后端修改重跑与 Windows 验证边界。

### Important Decisions
- 精确允许的旧入口为本仓库 `dist/runtime/src/main.js`、旧 `target/debug/runtime/dist/runtime/src/main.js` 和 `build/portable/dist/runtime/src/main.js`；Unix/Linux/Windows 均核实 PID 对应入口，认证状态 PID/instance 必须与 connection 匹配。未知入口拒绝而非模糊搜索或全局杀进程。
- 每个数据目录在启动前持有独立内核 SQLite 锁，重复开发命令不能互相接管；Runtime 仍使用原有实例锁。清理只处理记录的子进程/进程组或 Windows Job，不删除连接文件来伪造停机。
- 自有 Runtime 停机使用 expected instance 约束；替代实例不收 shutdown。早期中断等待已获取的异步资源被正确回收，避免前端初始化完成在 cleanup 之后而泄漏。
- 托管配置放在 Tauri CLI 的第一个 `--` 之前，保留 runner/app 参数边界；`--release` 在接管任何后台之前拒绝。开发覆盖禁用发行资源复制与 beforeDevCommand，只由 supervisor 启动 Vite。
- 后端无自动热重载；重新执行入口编译和启动当前代码。开发首次没有桌面设置时仍显示原有引导，不伪造已配置状态。

### Validation
- Risk Level：S3，仅开发构建、进程所有权及原生托管分支。
- `npm run build:node` exit 0，日志 `build/managed-dev-node.log`；包含可选 expected-instance 参数编译和现有资源准备。
- `npx vitest run tests/integration/desktop-dev.test.ts` 最终 exit 0，10/10，3.49 秒，日志 `build/managed-dev-tests.log`。覆盖真实旧 daemon 接管、流式接口 200/初始快照、重复会话保护、真实外部入口不受影响、前端失败清理、准备/异步前端中断、退出清理、后台意外退出、替代实例拒停、路径空格/边界及 Tauri 参数。初轮 8/9 通过，唯一失败是测试创建会话未配置模型；补仅本地 fixture 模型（不发生成请求）后通过。同期 supervisor/worker 参数与 IPC 边界有具体变更，因此重跑该定向文件；未运行完整业务套件。
- `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` exit 0，14.16 秒，日志 `build/managed-dev-rust.log`；Rust 后续未变，未重复 check。
- `git diff --check` 通过。Windows 专用 EncodedCommand 调整只影响 Windows 启动路径，未据此重复 macOS 测试/构建；结构/flag 依据下述官方 API 核实，不声称 Windows 运行通过。
- 协调者另行进行真实原生开发 smoke 和已授权用户会话刷新；由协调者追加实际证据。实施 Agent 未操作真实用户数据、旧后台或桌面进程。

### References / Limits
- [Node Child Process](https://nodejs.org/api/child_process.html)：IPC disconnect 和受管子进程；[Vite JS API](https://vite.dev/guide/api-javascript.html)：createServer/listen/close；[Tauri 配置](https://v2.tauri.app/reference/config/)：开发 hook/resource 覆盖。
- [Microsoft Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)、[CreateProcessW](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw)：子树归属与先悬挂后分配，Job 关闭回收。无 Windows 主机，未进行 Job、EXE、安装或真实桌面验证；该限制需后续实机覆盖。
- 没有新增依赖、schema 或公开 Runtime API；未修改正式打包命令、其他 UI/资产、模型/平台配置。不能捕获的操作系统强杀不承诺完整所有进程清理；受管 worker 能在 IPC 父连接断开时退出。
- 未提交，等待新的独立验收与协调者本地 commit。

## 协调者实际启动验证

- 隔离原生命令：`BIGFATFISH_DATA_DIR="$PWD/build/managed-dev-native-data" npm run desktop:dev -- --no-watch --config '{"identifier":"org.bigfatfish.devcheck"}'`。自动准备 Node、认证后台就绪、Vite 200；实际 Cargo dev 编译 5.00 秒并运行原生进程。随后向本次 supervisor 发 SIGINT（Ctrl+C 同一信号），命令退出 130，supervisor/Runtime/Tauri/native 四个 PID 均消失，连接文件移除，1420 端口关闭。证据 `build/managed-dev-native.log`、`build/managed-dev-native-evidence.json`。
- 用户此前启动的 Tauri/Vite 已自行退出；root 没有结束未知桌面进程。按已确认的接管授权运行普通 `npm run desktop:dev`，日志明确识别并停止本项目旧后台，PID10046 已退出；新 IPC worker PID85905 使用现有数据，既有会话仍有1条，前端200。真实原生编译3.04秒并启动；这是应用到用户会话，不是无理由重跑同一验证。
- 用户数据上的 `/v1/events/stream` 从404恢复为200、`application/x-ndjson`，实际收到 `snapshot-start`、`snapshot-message`、`snapshot-end`；只读取已有会话，没有调用真实模型或更改模型配置。证据 `build/managed-dev-current.log`、`build/managed-dev-current-evidence.json`（不含token或聊天正文）。
- 当前由root启动的开发会话 exec session5927 保留给用户，关闭窗口可结束；未再手工启动 detached 后台。CUA不能直接绑定未打包开发进程，本轮未取得原生窗口关闭按钮的实拍/点击证据；原生退出分支经代码审查与编译，进程退出和真实SIGINT清理有上述证据。Windows仍无实机。
- 为核实默认 watch 模式与隔离 smoke 的 `--no-watch` 差异，root 只读核实固定 [Tauri CLI v2.12.4 的 on_app_exit](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.4/crates/tauri-cli/src/dev.rs#L311)：正常应用退出会结束 CLI，源码热重载的 TriggeredKill 不结束 watcher。此为上游代码证据，不额外声称关闭按钮已实测，也未因此重复运行已通过检查。

## R1：独立验收的停服维护边界返工

首轮 `/root/accept_managed_dev` FAIL，完整报告已读取：临时数据复现真实 CLI backup export 后 supervisor 报 DEV_RUNTIME_EXITED、受控桌面结束；原生维护 CLI 属于同一进程树，大文件维护有被中断风险（未声称已发生数据损坏）。唯一返工范围为托管模式原生备份导出/恢复、在线与离线更新 install=true、desktop_restart 在任何副作用前明确拒绝，接入现有中文错误提示；只读 inspect/check 保留，正式模式不变。

采用职责层前置保护，退出开发会话后使用独立 CLI/安装版完成维护；本轮不新建跨进程维护协议。由新的实施 Agent 完成，再由新的独立验收 Agent 重验。验证只覆盖新增策略及对应调用顺序，不重复已通过的 supervisor 集成/原生启动，除非相关代码继续变化。

## R1 Implementation Report（2026-11-04）

### Summary / Root Cause
新实施 Agent：`/root/rework_dev_maintenance`。备份和更新会由 CLI 主动停止 Runtime，而 supervisor 正确地将受管 Runtime 退出视为会话失败并回收 Tauri 子树；维护 CLI 属于该子树，可能被中途停止。修复在原生开发适配职责层统一前置拒绝这些操作，保留 supervisor 的异常清理保证，不新增维护控制协议或修改独立 CLI 行为。

### Files Changed / Decisions
- `development.rs`：集中 `Operation` 策略与三个定向测试。仅托管模式拒绝原生备份导出/恢复、安装更新及重启；CLI 适配同时拒绝 start/stop/restart、update snapshot/rollback/install 系列及其维护阶段，避免遗漏的调用方绕过边界。inspect、update check/trust、install=false 和非托管路径保持。
- `desktop.rs`：维护入口在 `spawn_blocking` 前保护，公共 CLI 适配器在命令构造/数据路径读取/子进程启动前再次执行同一策略。
- `updater.rs`：在线/离线 install=true 在读取配置、归档或发起网络请求前拒绝；重启先保护，再修改 ALLOW_EXIT 或执行 app.restart。正式模式仍走原流程。
- `api.ts`、`Setup.tsx`：新增中文错误映射，明确退出开发后使用独立 CLI、正常安装版更新或重新运行开发命令；重启 invoke 的拒绝进入已有 fail 通知。
- README、开发者指南、技术栈：补充上述维护限制和可用的只读检查；本 Plan 记录返工。不修改首轮 FAIL 或协调者管理的 Spec/Decision/交接。

### Validation
- Risk Level：S3，限原生维护与开发生命周期交界；未扩大到无关子系统。
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml development::tests -- --nocapture` exit 0，3/3；编译 15.16 秒，测试 0.00 秒，日志 `build/managed-dev-r1-rust.log`。覆盖托管命令拒绝矩阵、只读检查允许及非托管路径不受限；没有修改全局环境或访问实际数据。此检查已编译 Rust 改动，不再追加 cargo check。
- `npx tsc -p build/chat-experience/tsconfig.json` exit 0，日志 `build/managed-dev-r1-types.log`；复用已存在的 apps 源码范围配置，排除测试，不声称全项目类型检查通过。
- `git diff --check` 通过；静态核对 `desktop.rs:48,166`、`updater.rs:46,144,220` 的保护均位于进程/IO/网络/重启副作用前。inspect 和 install=false 通过策略后仍沿原有验证链路执行。

### Known Limitations / Remaining Questions
未执行真实备份、恢复、安装更新或重启，也未操作用户 Runtime；运行时不受拒绝影响的依据为纯策略测试与入口调用顺序审查，未宣称新增实际 UI/Runtime 存活实测。未重复已通过的 10 项 supervisor 测试、Node 构建或原生 smoke；Windows 限制保持。无剩余实施问题，源码冻结，待新的独立验收；未 commit/push/切分支。
