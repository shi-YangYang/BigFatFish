# Spec061 R1 独立验收

## Result

**PASS**。验收 Agent：`/root/accept_windows_acl_read`。无代码返工项；结论是当前 R1 代码与本机证据满足返工范围，不能据此宣称 Windows CI 已恢复。

## Spec Coverage

- 已完整阅读 Spec、Rework、Plan 的 R1 实施报告、首轮验收和交接，核对实际源码及 diff。新附件的 `WINDOWS_ACL_ACL_READ` 和 `Get-Acl` / `CouldNotAutoloadMatchingModule` 确认读取模块是本轮直接阻断点；具体模块路径污染仍只是可能机制，报告没有把它写成已捕获事实。
- 两处生产读取和所有测试辅助读取均按文件/目录类型使用对应的原生 API，读取范围一致为 `Access, Owner, Group`。微软 [.NET Framework Directory.GetAccessControl](https://learn.microsoft.com/en-us/dotnet/api/system.io.directory.getaccesscontrol?view=netframework-4.8.1) 和 [File.GetAccessControl](https://learn.microsoft.com/en-us/dotnet/api/system.io.file.getaccesscontrol?view=netframework-4.8.1) 均提供该重载，位于 mscorlib；脚本没有引入 PowerShell 7 专有语法，兼容目标 Windows PowerShell 5.1 的 API 与语法契约。
- 移除的是 Security cmdlet 依赖，不是权限检查。原路径类型、reparse point、可信 owner、SID/FullControl、规则数量、继承和保护状态判断均保留；restrict 仍只持久化 DACL 并读取实际结果，verify 仍只读，不请求 Audit。公开错误和固定原因码、CI、进程环境均未修改。
- 测试辅助改用 `GetSecurityDescriptorSddlForm`，不依赖 `Get-Acl` 扩展属性；无关文件使用 File API，junction 外部目标使用 Directory API，前后比较使用相同读取范围。Stop、显式管道及 SID/SDDL/ACE 非空断言避免先前读取失败后空结果假通过。
- 新 Windows 用例将 Get-Acl/Set-Acl 影射为抛错函数后执行实际生产 ps1，使用临时目录和文件验证 restrict/verify，再真实放宽 DACL 检查拒绝。它验证不调用这两个 cmdlet，不声称重现 runner 的具体模块环境。真实用例保留实际子进程调用，协议 mock 的复原沿用首轮已核实行为，没有跳过或放宽原 Windows 边界断言。

## Validation

Risk Level：**S3**（权限边界），范围仅 ACL 子系统。

- 读取 `/tmp/bff-spec061-r1-acl.log`：6 项协议测试通过、4 项 Windows-only 跳过，82ms；这不构成 Windows 权限实测。
- 读取 `/tmp/bff-spec061-r1-build.log`：Node 编译及资源复制命令无诊断。实施报告记录进程结束、生成产物与源 ps1 一致，但原工具退出码丢失；验收没有把这些证据表述为亲见 exit 0，也未为补足置信心重复构建。
- 复用实施者已通过的 diff 检查，独立审阅实际 diff、完整生产脚本和相关测试；没有重新运行测试、构建、lint 或类型检查。当前分支为 dev；仅新增本验收报告，未改业务代码或真实数据/权限，未暂存、提交、推送或触发 CI。

## Issues / Remaining Work

无当前范围内的阻塞缺陷。四个真实 Windows ACL 场景及 Runtime 全链路仍待 Windows CI；生命周期超时是否全部随此修复消失尚未证实。达到本轮审查停止条件，不追加无关检查。
