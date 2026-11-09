# Plan

1. 读取 Windows CI 失败和 ACL 脚本/调用方，核对官方 PowerShell 5.1/.NET API 行为。
2. 在 ACL 适配层修正已证实问题，保留严格访问边界；必要时固定原因码改善诊断。
3. 增补直接相关的协议/错误过滤测试与 Windows 实际 ACL 回归，运行本机可执行的最小相关检查。
4. 实施报告写在本文件；新的独立 Agent 审查代码、证据与 Windows 实测限制。

S3 但限本机权限子系统；不运行全仓业务套件，不无理由重跑已经通过的检查。预计文件为 windows-acl.ps1、windows-acl.ts、直接相关测试/夹具；若证据需要调整范围先报告。没有数据迁移，不修改真实文件权限。

## Implementation Report

实施者 `/root/implement_windows_acl`，实施完成，待新独立验收。

### Summary / 根因与职责

发现两项有源码依据、同属 ACL 适配层的问题：

1. `windowsHide: true` 且三个 stdio 都是 pipe 时，libuv 在 Windows 使用 `CREATE_NO_WINDOW`。原 PowerShell 第一条语句设置 `Console.InputEncoding`；Windows PowerShell 5.1 使用的 .NET Framework setter 会调用 `SetConsoleCP`，失败即抛异常，未根据 stdin 重定向跳过。这使无控制台的后台脚本在读取 JSON、执行 ACL 前就可能失败。现改为 `StreamReader(Console.OpenStandardInput(), strict UTF8, false)` 直接解码管道，继续通过 stdin 传路径，不把路径拼进可执行脚本。
2. 原 `Set-Acl` 将新建安全描述符按 `AccessControlSections.All` 持久化，连没有要修改的审计部分也写入；权限不足时 fallback 的保护状态比较还可能让已保护目录继续请求审计权限。现使用 .NET Framework `Directory.SetAccessControl` / `File.SetAccessControl`，只持久化本对象实际修改过的 DACL；不写 owner、group 或审计。原 owner 信任集合、用户/SYSTEM FullControl 白名单、继承、reparse/type 检查及 verify 只读行为保持。

第一项是可确认的 API 使用缺陷，与 Windows CI 两个 ACL 场景均约 300ms 早失败、而不是 10 秒超时相符。但原日志已经丢失底层异常，不能声称直接捕获了此次 runner 的原生错误；第二项为同一 restrict 路径的权限环境风险，不能声称用户这次一定也触发了它。未在 Mac 冒充执行 Windows ACL。

### 第一方依据

- [libuv Windows process.c v1.51.0](https://github.com/libuv/libuv/blob/v1.51.0/src/win/process.c#L1034-L1042)：hidden 且不继承 stdio 时使用 CREATE_NO_WINDOW。
- [微软 .NET Framework Console 实现](https://github.com/microsoft/referencesource/blob/main/mscorlib/system/console.cs#L541-L592)：InputEncoding setter 对 UTF-8 调用 SetConsoleCP，失败调用 WinIOError；[微软 API 说明](https://learn.microsoft.com/en-us/dotnet/api/system.console.inputencoding?view=netframework-4.8.1)列出 IOException。
- [PowerShell 早期公开源 SetSecurityDescriptor](https://github.com/PowerShell/PowerShell/blob/v6.0.0-alpha.9/src/System.Management.Automation/namespaces/FileSystemSecurity.cs#L139-L242)：Set-Acl 从 All 开始且 fallback 对比保护状态。此源不是本机 Windows PowerShell 5.1 执行证据。
- [微软 NativeObjectSecurity.Persist](https://github.com/microsoft/referencesource/blob/main/mscorlib/system/security/accesscontrol/nativeobjectsecurity.cs#L180-L266)：Owner/Group 为 null 会跳过，不据此猜测 InvalidOwner；Audit 被选中则仍加入 SystemAcl。[Directory.SetAccessControl 文档](https://learn.microsoft.com/en-us/dotnet/api/system.io.directory.setaccesscontrol?view=netframework-4.8.1)说明只持久化对象创建后修改的部分。

### Files Changed

- `apps/runtime/src/windows-acl.ps1`：无控制台 UTF-8 管道读取；仅写 DACL；失败输出固定阶段/原因协议，原始错误文本、路径及身份不输出。
- `apps/runtime/src/windows-acl.ts`：保留公开错误 message `WINDOWS_ACL_UNSAFE`，只把白名单原因放进新的固定 Error.cause，区分脚本读取、环境、执行、超时、非法响应与脚本阶段；不保留原 child_process 错误或 stderr。
- `apps/runtime/src/windows-acl.test.ts`：6 项跨平台协议/诊断测试，只 mock 子进程边界并明确不代表 ACL 实测；新增 Windows 真实 Unicode/引号/括号路径的隐藏进程测试，重复 restrict/verify 并确认 owner/group 与文件内容不变。既有 broad ACE、受保护文件修复、verify 拒绝宽权限、无关文件不变与 junction 拒绝测试保留。测试 helper 同样直接解码 stdin，写权限只改 DACL；未放宽原断言。

### Validation

Risk Level：S3（权限边界），范围只限 ACL 子系统，没有全仓业务测试或云端操作。

- `npx vitest run apps/runtime/src/windows-acl.test.ts`：6 passed、3 个真实 Windows 场景按平台 skipped；106ms。日志 `/tmp/bff-spec061-acl.log`。测试后仅将 Windows 测试 helper 的 Set-Acl 字符串改为同职责 DACL-only 写入；本机跳过该代码，没有无意义重跑相同协议测试。
- `npm run build:node`：通过，包含生产 TypeScript 编译和 ps1 资源复制；日志 `/tmp/bff-spec061-build.log`。
- `npx tsc --noEmit --strict --esModuleInterop --target ES2023 --module NodeNext --skipLibCheck apps/runtime/src/windows-acl.test.ts`：通过，专门校验新协议 mock 和重载调用类型；日志 `/tmp/bff-spec061-test-types.log`。未重复完整仓库 typecheck。
- `git diff --check` 通过；实际 diff 保持原安全判断，未修改 CI 命令、权限白名单或业务调用方。

### Known Limitations / Remaining Questions

本机没有 Windows PowerShell/Windows 文件系统；3 个真实 ACL 场景及新版 Windows Runtime 全链路仍需后续 CI 实际运行。Windows 原有生命周期/停止夹具的超时可能是 ACL 初始化失败的连带结果，本轮没有以增加超时掩盖它们；若 ACL 修复后仍失败，需依据新原因码进一步定位。

未操作真实数据/文件权限、模型或账号，未 stage/commit/push。没有产品决策待问；未获推送授权不影响本轮代码交付，但不得宣称 Windows 问题已经实机验证消失。

## R1 Implementation Report

实施者 `/root/rework_windows_acl_read`。本轮针对提交 `b4d4658` 后的新 Windows CI 失败，实施完成，待新的独立验收。

### Confirmed Failure / 修复边界

用户新附件 `5389009f-2cba-47a9-bf65-859066921173/已粘贴的文本.txt` 中，27 个真实场景失败、6 个协议测试通过。生产固定原因码落在 `WINDOWS_ACL_ACL_READ`；测试辅助的 CLIXML 明确报告：找到 `Get-Acl` 所在的 `Microsoft.PowerShell.Security`，但模块无法加载，错误为 `CouldNotAutoloadMatchingModule`。这是本轮已捕获的直接阻断点，首轮的 stdin 和 DACL-only 写入修改未覆盖它。

微软文档说明 PowerShell 7 经中间进程启动 Windows PowerShell 时，可能继承不兼容的模块搜索路径；本项目 pwsh → npm/Node → powershell.exe 符合该调用形态，但本次 runner 的实际环境变量没有记录，不能认定具体是某项 `PSModulePath` 值导致。现有日志中的其他 cmdlet 已成功执行，本轮只去掉不必要的 Security 模块依赖，没有修改进程环境、CI shell、超时或全局设置。

### Files Changed

- `apps/runtime/src/windows-acl.ps1`：首次读取与 restrict 后复读均改用 .NET Framework `Directory.GetAccessControl` / `File.GetAccessControl`，按路径类型选择，显式只读取 `Access, Owner, Group`。不读取 Audit；首轮 DACL-only 写入和 owner、SID、继承、路径类型、reparse、verify 只读检查全部保留。
- `apps/runtime/src/windows-acl.test.ts`：所有测试辅助 ACL 读取同步改用上述原生 API；SDDL 使用 `GetSecurityDescriptorSddlForm`，不再依赖 `Get-Acl` 的扩展属性。辅助脚本统一 `ErrorActionPreference = Stop`，防止读取失败后空值调用继续运行；owner/group 的 SID 数量与格式、SDDL 内容和 ACE 列表均检查非空，避免空结果比较假通过。隐藏管道和 Unicode/特殊字符路径、重复调用、真实宽权限拒绝、无关文件与 junction 保护检查保留。
- 同一测试文件新增真实 Windows 回归：在隔离 PowerShell 会话里将 `Get-Acl` 和 `Set-Acl` 屏蔽为直接抛错的函数，再执行实际生产脚本，验证 restrict、verify 成功及宽权限 verify 拒绝。它验证不依赖这两个 cmdlet，不冒充复现 runner 的具体模块搜索环境；本机 macOS 不运行该 Windows 用例。
- `windows-acl.ts` 无须修改；公开错误与原因协议保持。

### 第一方依据

- [Directory.GetAccessControl (.NET Framework 4.8.1)](https://learn.microsoft.com/en-us/dotnet/api/system.io.directory.getaccesscontrol?view=netframework-4.8.1) 与 [File.GetAccessControl](https://learn.microsoft.com/en-us/dotnet/api/system.io.file.getaccesscontrol?view=netframework-4.8.1)：提供带 `AccessControlSections` 参数的原生目录/文件安全描述符读取，适用于 Windows PowerShell 使用的 .NET Framework。
- [about_PSModulePath — Starting Windows PowerShell from PowerShell 7](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_psmodulepath?view=powershell-7.5)：解释中间进程启动时模块搜索路径的兼容性风险；用于说明可能环境机制，不作为本次 runner 环境已实测的证据。

### Validation

Risk Level：S3（权限边界），验证限制在改动的 ACL 子系统与生产 Node 编译，不运行全仓测试、其他平台或云端作业。

- `npx vitest run apps/runtime/src/windows-acl.test.ts`：6 passed、4 Windows-only skipped，82ms。日志 `/tmp/bff-spec061-r1-acl.log`；本机执行的是协议测试，四项真实 ACL 测试等待 Windows CI。
- `npm run build:node`：编译和资源复制完成，日志 `/tmp/bff-spec061-r1-build.log` 无错误；编译产物和 ps1 的本次更新时间为 2026-11-09 11:28:08，复制后的 `dist/runtime/src/windows-acl.ps1` 与源文件逐字节一致。本轮工具输出在上下文压缩时截断，未保留该命令返回的退出码，因此补查了日志、进程结束和生成产物，没有无理由重跑构建。
- `git diff --check` 通过；逐项检查实际 diff，没有放宽安全校验。测试通过后没有再改源代码，没有重复执行测试。

### Remaining Work / 限制

本机没有 Windows PowerShell 与 Windows 文件系统，新的 Security cmdlet 隔离回归和 Windows Runtime 全链路仍须 Windows CI 实测；目前只交付明确针对已捕获读取失败的修复，不声称 Windows 全链路已经通过。没有新产品决策、schema 变更或数据迁移。

本轮只修改上述两个源码/测试文件和本报告。未改用户数据/真实文件权限，未调用模型或账号，未 stage、commit、push 或触发云端执行。

## R2 Implementation Report

实施者 `/root/rework_windows_stop_race`。基线 `dev/654a71e`；实施完成，待新的独立验收。协调者已修改的 Spec、Rework、索引及交接完整保留。

### Summary / 根因与职责

新 Windows CI 的全部 10 项 ACL 测试已通过；8 项剩余失败集中于关闭流程以及强制结束测试。正常 Runtime shutdown 先删除 `connection.json`，随后释放 SQLite 实例锁；`readConnection` 的 Node 文件检查与 PowerShell 验权之间存在时间窗口。连接在子进程检查路径或读取 ACL 时被正常删除，固定诊断会成为 `WINDOWS_ACL_PATH_CHECK` / `WINDOWS_ACL_ACL_READ`，而 CLI stop 的既有缺失处理只识别 `ENOENT`。本轮先通过真实临时文件删除重现了这条错误链，包括 stop 在已发送 shutdown 后的锁等待循环。

修复位于共享连接读取层：仅上述两个读取阶段错误允许以 `lstatSync` 复查连接路径，且仅复查确实返回 `ENOENT` 时交回该原生缺失错误。文件仍存在、悬空链接、其他读取失败及明确的 owner/DACL/reparse/type/继承拒绝都继续保留原 ACL 错误。使用 lstat 避免把目标缺失的链接误作连接文件不存在。没有修改 PowerShell 协议或权限策略；CLI、维护、开发桌面继续复用既有缺失/真实内核锁等待和实例替换保护，无需各自补丁。

另一处失败是测试将 Windows `child.kill('SIGTERM')` 的强制结束当作优雅退出，错误要求遗留连接已删除。[Node 子进程文档](https://nodejs.org/api/child_process.html#subprocesskillsignal)明确 Windows 的 SIGTERM/SIGINT/SIGKILL 均强制结束。本轮改用各平台一致的 SIGKILL 验证崩溃：桌面关闭、会话失败、旧连接遗留、内核锁释放，随后新会话能够恢复并在正常停止后清理。生产崩溃清理逻辑未修改；正常退出测试仍要求删除连接。

### Files Changed

- `apps/runtime/src/connection.ts`：在 Windows ACL 读取失败处确认连接是否确实缺失，保留全部其他错误。
- `apps/runtime/src/windows-acl.test.ts`：增加 11 项跨平台进程边界回归，实际删除临时连接，覆盖 PATH_CHECK/ACL_READ 缺失、文件仍存在、六类明确安全拒绝以及悬空链接。只有 ACL 子进程被替换为确定性协议夹具，文件系统操作是真实操作；原有四项 Windows DACL 实测不变。
- `tests/integration/stop-completion.test.ts`：增加一项真实 SQLite 锁夹具测试，在 stop 的关闭后读取循环删除连接并返回 PATH_CHECK，确认 stop 在 IPC 释放锁前不能完成、释放后可立即获取维护锁。原有鉴权失败、替换实例和超时用例保留。
- `tests/integration/desktop-dev.test.ts`：用 SIGKILL 区分崩溃与正常退出，并补齐锁释放及后续会话恢复断言。
- 本文件追加实施证据；没有新增独立测试文件或修改 `test:platform` / CI 范围。

### Validation

Risk Level：**S3**，限共享本机凭据读取与 Runtime 生命周期，按用户要求执行与 CI 完全相同的平台检查；不运行全仓业务套件、全量 lint/typecheck、桌面构建或远端作业。

- 修复前 `npx vitest run apps/runtime/src/windows-acl.test.ts tests/integration/stop-completion.test.ts -t 'connection disappears during ACL'`：实际 **exit 1**，3 failed / 25 按筛选跳过。三项都捕获原始 ACL 错误而非预期缺失语义，stop 堆栈位于关闭后的 `readCurrent`。日志 `/tmp/bff-spec061-r2-race-red.log`。
- 修复后 **`npm run test:platform`：实际 exit 0**（工具会话 42284 的最终返回已保留），Node 生产编译与资源复制完成，**7 test files passed，47 passed / 5 skipped / 52 total，32.97s**。日志 `/tmp/bff-spec061-r2-platform.log`。包含上述全部新增回归，以及 CLI 生命周期、开发桌面、备份与更新现有检查；不是只运行 mock 的结果。
- 本机为 macOS，5 项条件跳过包含 4 项 Windows 原生 ACL 用例与 1 项 Windows 安装器边界用例；没有新增 skip。已审阅实际 diff，`git diff --check` 实际 exit 0。测试通过后没有再改源码或重复执行测试。

### Known Limitations / Remaining Questions

本机没有 Windows PowerShell/Windows 系统，不能将 47 项本地通过称作 Windows 全链路通过。四项真实 Windows ACL 在先前 654a71e CI 已通过，但本轮的 Windows 停止/崩溃恢复仍待新的 Windows 运行；本机新增协议边界测试仅确定验证实际文件删除与错误分类，不替代原生 ACL。

无 schema、公开 API 或权限白名单变更，不修改真实用户数据或 QQ，也没有 stage、commit、push 或触发 CI。本轮没有产品问题待确认；按既有边界交由新的独立验收者审查，不追加已通过的检查。
