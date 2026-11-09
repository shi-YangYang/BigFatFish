# Spec061：Windows Runtime 权限初始化失败

状态：R2 实施完成，[独立验收 PASS](acceptance-r2.md)。本机 `npm run test:platform` 实际 exit 0，47 passed / 5 平台条件 skipped；修复前 3 项确定性竞态回归已复现同类失败。新 Windows CI 尚未运行，不代表 Windows 全链路已通过。R1 的 10 项 Windows ACL 测试通过及剩余 8 项失败证据见 [返工要求](rework.md)。风险 S3：本机凭据与数据目录权限边界及 Runtime 生命周期。

## 背景与当前行为

用户提供新版 Windows CI 日志，多组 Runtime/CLI/ACL 测试在 preparePaths → windowsAcl 抛出 WINDOWS_ACL_UNSAFE，部分启动夹具随后超时。当前 TypeScript 包装和 PowerShell 脚本都将底层失败压为同一错误，无法直接区分执行错误与真实权限不安全。

## 目标与目标行为

定位并修复有证据的 Windows ACL 初始化兼容问题，使合法私有数据目录能够启动；保持拒绝不安全权限、未知 owner 和 reparse point 的边界。错误应保留受限且不泄露路径/身份的诊断原因。

## 功能需求

- 根据代码、CI 日志和官方 PowerShell/.NET 契约定位失败，不用跳过 ACL 或接受所有权限来通过测试。
- restrict 仅修复产品路径，verify 只读；保留当前用户/SYSTEM DACL、可信 owner、继承和链接检查。
- 若原日志不足定位，补充固定枚举诊断，不输出任意 PowerShell 错误、路径、SID、配置内容。
- 定向回归必须覆盖实际 Windows ACL 操作及故障边界；本机可以验证调用协议和错误清洗，但不能将 Mac 测试称作 Windows 通过。
- ACL 读取与测试辅助读取不得依赖当前环境无法加载的 PowerShell Security 模块；通过 .NET Framework 文件/目录 API 获取 Owner/Group/Access，维持同一权限校验。
- Runtime 正常退出期间连接文件消失应走既有文件不存在及内核锁等待流程；真实权限错误仍必须拒绝，不能把所有 PATH_CHECK 或 ACL 错误当成停止成功。
- 强制结束进程与优雅退出分别验证；跨平台崩溃测试不得依赖 Windows 不支持的 POSIX 信号处理行为。
- 修复后本地实际执行与 CI 相同的 Runtime 平台检查并保留明确退出码；增加可在本机确定复现退出竞态的回归，说明哪些 Windows 原生部分尚未实测。

## 非目标

不扩大 CI 套件、不改变打包策略，不修改无关业务，不操作真实用户数据/平台，不 commit/push/触发新远端运行。

## 技术约束与兼容

Windows PowerShell 5.1、Node 24；既有公开 WINDOWS_ACL_UNSAFE 错误类别应保持兼容。权限策略不得放宽。仅对隔离测试目录进行安全验证，既有真实 Windows DACL 测试继续保留。

## 验收标准

- [x] 解释有证据的根因及修复职责，不把推测或本机 mock 当成 Windows 实测。
- [x] 合法路径处理符合平台 API 契约，危险权限和链接继续拒绝，错误诊断受限。
- [x] R2 本地 Runtime 平台检查及确定性竞态回归通过，新的独立验收完成；Windows 原生未实测范围明确。
- [x] 无无关业务/CI 变化，未提交/推送。

## 待确认问题

无产品决策。实现前按证据确认技术根因；若需云端 Windows 验证，先完成可审查修复，再报告缺口。
