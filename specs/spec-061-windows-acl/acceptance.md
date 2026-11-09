# Spec061 独立验收

## Result

**PASS**。验收 Agent：`/root/accept_windows_acl`。无待返工项；Windows 实际重跑仍是明确的验证缺口。

## Spec Coverage

- 修复位于现有 ACL 适配层，未改 CI、权限白名单或业务调用方。隐藏 PowerShell 改为直接解码 UTF-8 stdin，中文及含引号、括号的路径仍通过 JSON 传递，不拼接进可执行脚本。
- `restrict` 继续先检查路径类型、reparse point 和可信 owner，再构造仅当前用户/SYSTEM 的完整访问 DACL，并读取实际落地结果校验；`verify` 仍只读。原规则数量、权限、继承和保护状态判断保持。
- 新安全描述符仅修改 Access 部分，经 `.NET Directory/File.SetAccessControl` 持久化，避免 `Set-Acl` 复制 All 时带上不需要修改的审计部分。核对微软 FileSystemSecurity 实现中 `GetAccessControlSectionsFromChanges`/`Persist` 的按修改标记选择行为，未发现放宽权限或改变 owner/group 的路径。
- 错误公开 message 保持 `WINDOWS_ACL_UNSAFE`；PowerShell 只输出固定阶段或指定原因，TypeScript 再按白名单接收。未知 stdout、原 stderr、子进程 Error 和敏感路径不进入最终 cause，执行失败和非法成功响应均继续拒绝。
- Windows 实测用例保留宽权限修复/拒绝、无关文件保持和 junction 拒绝，并增加隐藏进程 Unicode 路径、重复 restrict/verify、owner/group 与内容保持检查。已核对本机 Vitest 5 的 `vi.fn(actual).mockReset()` 恢复 actual 实现，协议 mock 不会使后续 Windows 用例绕过真实 PowerShell。

## Validation

- Risk Level：**S3**（本机权限边界），审阅范围限 ACL 及其直接测试。
- 完整阅读 Spec、Plan 中实施报告、交接、项目规则和实际 diff；核对 [libuv 的隐藏进程实现](https://github.com/libuv/libuv/blob/v1.51.0/src/win/process.c)、[微软 Console 实现](https://github.com/microsoft/referencesource/blob/main/mscorlib/system/console.cs)与 [FileSystemSecurity 持久化实现](https://github.com/microsoft/referencesource/blob/main/mscorlib/system/security/accesscontrol/filesecurity.cs)。这些是 API 使用缺陷的源码证据，不是 Windows runner 的执行结果。
- `/tmp/bff-spec061-acl.log`：6 项协议/错误过滤测试通过，3 项真实 Windows ACL 场景按平台跳过。测试 helper 后续仅改为 DACL-only 写入，属于本机跳过的 Windows 路径；没有无理由重复已过协议测试。
- `/tmp/bff-spec061-build.log` 与实施报告记录 Node 编译及 ps1 资源复制通过；单文件测试类型检查通过，日志 `/tmp/bff-spec061-test-types.log` 无诊断。实施者 diff 检查通过。
- 本验收独立核对代码、依赖源码与已有证据，未重新运行测试、构建、lint 或类型检查；未修改业务代码、真实数据或权限，未暂存、提交或推送。仅新增本报告。

## Issues / Required Rework

无。代码与必要的本机证据满足当前规格，停止追加验证。

## Regression Risks

原 Windows CI 把底层异常隐藏为统一错误，不能确定此次 runner 的每个失败都已由这两处修改消除。新 Windows ACL/Runtime CI 尚未运行；本机协议 mock 和 Mac 构建不能替代它。现有生命周期超时没有被放宽，后续 Windows 仍失败时应依据固定原因码继续定位。
