# R1：Windows CI 的 ACL 读取模块依赖

## 证据与原因

用户提供 b4d4658 新版 Windows CI 完整日志，6 项协议测试已通过，但 27 个真实场景失败；实际错误为 WINDOWS_ACL_ACL_READ。Windows 测试辅助代码还记录 Get-Acl 无法加载 Microsoft.PowerShell.Security，错误 ID 为 CouldNotAutoloadMatchingModule。读取步骤仍是实际阻断点，首轮修复不能代表 Windows 已恢复。

具体模块为什么无法加载尚未获取更深异常；可能的 PowerShell 版本/模块搜索路径混用不能直接当事实。无需为完成 ACL 读取引入该模块依赖，.NET Framework 的 Directory/File.GetAccessControl 能直接返回需要的安全描述符。

## 返工范围

- 生产脚本两处 ACL 读取，以及同文件测试辅助读取，改为合适的 Directory/File.GetAccessControl；明确读取 Access/Owner/Group，不请求 Audit。
- 保留 Unicode 管道、DACL-only 写入、原因码、owner/权限/继承/reparse 安全判断；不修改系统模块路径或执行策略，不以跳过测试或延长超时掩盖问题。
- Windows 测试辅助脚本对失败及时退出，避免 Get-Acl 加载失败后继续 null 调用并生成误导数据。
- 增补有意义的 Security 模块不可用时回归；如果本机不能实际执行 Windows，只运行必要协议/编译检查并明确未验，不声称实测成功。

## 流程与限制

新的实施 Agent → 新的独立验收 Agent；实施报告追加到现有 Plan。S3 仅 ACL 子系统，无新 CI 改造、真实数据/权限操作。当前 dev/b4d4658，开始干净；前次 commit/push 授权已用于首轮，本轮没有新提交或推送授权。
