# Spec061：Windows Runtime 权限初始化失败

状态：Done，[独立验收 PASS](acceptance.md)；Windows CI 实际重跑待后续推送。风险 S3：本机凭据与数据目录权限边界。

## 背景与当前行为

用户提供新版 Windows CI 日志，多组 Runtime/CLI/ACL 测试在 preparePaths → windowsAcl 抛出 WINDOWS_ACL_UNSAFE，部分启动夹具随后超时。当前 TypeScript 包装和 PowerShell 脚本都将底层失败压为同一错误，无法直接区分执行错误与真实权限不安全。

## 目标与目标行为

定位并修复有证据的 Windows ACL 初始化兼容问题，使合法私有数据目录能够启动；保持拒绝不安全权限、未知 owner 和 reparse point 的边界。错误应保留受限且不泄露路径/身份的诊断原因。

## 功能需求

- 根据代码、CI 日志和官方 PowerShell/.NET 契约定位失败，不用跳过 ACL 或接受所有权限来通过测试。
- restrict 仅修复产品路径，verify 只读；保留当前用户/SYSTEM DACL、可信 owner、继承和链接检查。
- 若原日志不足定位，补充固定枚举诊断，不输出任意 PowerShell 错误、路径、SID、配置内容。
- 定向回归必须覆盖实际 Windows ACL 操作及故障边界；本机可以验证调用协议和错误清洗，但不能将 Mac 测试称作 Windows 通过。

## 非目标

不扩大 CI 套件、不改变打包策略，不修改无关业务，不操作真实用户数据/平台，不 commit/push/触发新远端运行。

## 技术约束与兼容

Windows PowerShell 5.1、Node 24；既有公开 WINDOWS_ACL_UNSAFE 错误类别应保持兼容。权限策略不得放宽。仅对隔离测试目录进行安全验证，既有真实 Windows DACL 测试继续保留。

## 验收标准

- [x] 解释有证据的根因及修复职责，不把推测或本机 mock 当成 Windows 实测。
- [x] 合法路径处理符合平台 API 契约，危险权限和链接继续拒绝，错误诊断受限。
- [x] 必要定向检查通过，独立验收 PASS；Windows 未实测范围明确。
- [x] 无无关业务/CI 变化，未提交/推送。

## 待确认问题

无产品决策。实现前按证据确认技术根因；若需云端 Windows 验证，先完成可审查修复，再报告缺口。
