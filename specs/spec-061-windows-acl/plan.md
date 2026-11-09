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
