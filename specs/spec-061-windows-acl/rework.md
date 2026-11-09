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

# R2：退出竞态与 Windows 强制终止

## 新的实际证据

654a71e 的 [Windows Runtime CI](https://github.com/shi-YangYang/BigFatFish/actions/runs/42557851484/job/128967474140) 共 30 passed / 8 failed / 2 skipped。全部 10 项 ACL 测试通过，包括 4 项 Windows 原生权限测试；其余五个 job 均成功。完整日志暂存在 `/tmp/bff-spec061-r2-windows-job-clean.log`。

失败集中在 desktop-dev 清理、CLI stop、backup export。读取连接先在 Node stat，随后启动 PowerShell 验权；后台此时可能已删除 connection.json。脚本把 Get-Item 的文件不存在压成 PATH_CHECK，readCurrent 只识别 ENOENT，因此停止失败。需以确定性回归验证这一竞态，不能单凭错误阶段将全部权限错误忽略。另一个断言使用 child.kill('SIGTERM') 后要求连接文件被优雅清理，Windows 的该操作为强制终止，应区分崩溃恢复与正常退出的契约。

[Node.js 官方 subprocess.kill 文档](https://nodejs.org/api/child_process.html#subprocesskillsignal) 明确 Windows 的 SIGTERM、SIGINT、SIGKILL 会强制结束进程；本轮保留优雅退出测试，新增统一强杀后的恢复证据。

## 返工与验证要求

- 最小范围修复连接文件在验证期间消失的处理。仅明确的缺失可进入既有 ENOENT/内核锁等待分支；存在但权限不安全、鉴权失败或实例被替换仍拒绝，不删除不属于当前实例的文件，不吞掉任意 ACL 错误。
- 添加跨平台可运行的确定性竞态回归：在检查与读取边界使文件实际消失，验证不是把所有权限异常当作成功；继续覆盖停止须等待锁释放。
- 崩溃测试使用所有平台都有的强制终止路径，验证桌面关闭、失败上报、锁释放及后续会话恢复；正常退出场景继续要求完整清理。不得单纯跳过 Windows 测试或放宽断言隐藏失败。
- 用户明确要求本地先跑。改动完成后执行 `npm run test:platform`，保留实际退出码与结果；有新增定向测试时纳入对应范围。不要重复已通过检查或跑全仓套件；Windows 原生无法在 Mac 验证的部分必须如实标注。
- 新的单一实施 Agent 与新的独立验收 Agent；报告追加到 Plan，验收为 acceptance-r2.md。开始 dev/654a71e 干净。没有本轮 commit/push 授权，不修改真实用户数据/QQ 进程或本机真实权限。
