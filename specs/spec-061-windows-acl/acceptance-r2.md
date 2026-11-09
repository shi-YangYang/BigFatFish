# Spec061 R2 Acceptance

## Result

**PASS**。独立验收者 `/root/accept_windows_stop_race`，审查基线 `dev/654a71e` 及当前 R2 工作区改动。该结论覆盖实现、安全边界、确定性回归与本机平台验证；**不代表本轮 Windows 实机或新 Windows CI 已通过**。

## Spec Coverage

- 生产修改集中于共享 `readConnection`：仅 `WINDOWS_ACL_PATH_CHECK` / `WINDOWS_ACL_ACL_READ` 允许复查，且仅 `lstatSync(connection)` 实际抛出 `ENOENT` 才交回缺失语义；路径仍存在或复查报其他错误时仍抛出原 ACL 错误。owner、DACL、reparse、类型、继承等明确拒绝不进入缺失分支。PowerShell 协议、权限策略及公开错误类别未变。
- `lstat` 检查路径本身，避免把目标不存在的链接当作文件缺失。新增用例真实删除临时连接，分别覆盖两种读取阶段、文件仍存在、六类明确安全拒绝和悬空链接；Windows 使用 junction，无需普通符号链接权限。mock 内的文件系统断言如失败会导致最终原因不匹配，不会被包装成预期成功。
- 修复位于连接读取职责层，CLI、维护及开发桌面复用既有缺失处理。审阅 `stop` 与 SQLite 锁夹具确认：连接消失不直接等于停止完成；真实锁仍被持有时不能成功，释放后才允许维护。鉴权失败、停止前及停止后的实例替换检查和超时用例均保留，生产停止逻辑未改。
- 退出竞态回归在第二次 ACL 调用真实删除连接，观察该边界后确认锁仍占用；夹具只能收到 IPC 后释放锁，不能靠固定等待伪造释放。旧实现的三项失败与修复后平台检查形成实际回归证据。
- 崩溃用例统一使用 `SIGKILL`，验证会话报错、桌面进程退出、旧连接遗留、真实实例锁释放、新会话产生不同实例并能认证查询，随后正常停止删除连接。原有正常桌面退出及中止清理断言保留，没有新增 skip，也没有放宽生产清理或隐藏原失败。
- 本轮无 schema、公开 API、CI 范围、依赖或无关业务变更；未修改真实用户数据，验收者只新增本报告，没有 stage、commit、push 或触发 CI。

## Validation

- **Risk Level: S3**，范围限本机凭据读取和 Runtime 生命周期。
- 实际审阅当前 Spec、R2 Rework、Plan 的 R2 Implementation Report、四个源码/测试文件 diff，以及直接相关的 ACL 错误协议、CLI stop、SQLite 锁夹具、开发会话清理代码。
- 实际读取 `/tmp/bff-spec061-r2-race-red.log`：修复前确定性回归 **3 failed / 25 按筛选跳过**，分别为 PATH_CHECK、ACL_READ 和 stop 关闭后读取竞态。
- 实际读取 `/tmp/bff-spec061-r2-platform.log`：`npm run test:platform` 完成 Node 编译/资源复制，**7 files passed，47 passed / 5 skipped / 52 total，32.97s**。退出码 **0** 由实施报告及协调者保留的工具最终返回确认；日志本身未打印退出码。
- 5 项条件跳过为既有 4 项 Windows 原生 ACL 与 1 项 Windows 安装器用例；新增测试没有条件跳过。旧 Windows 日志 `/tmp/bff-spec061-r2-windows-job-clean.log` 为 **30 passed / 8 failed / 2 skipped**，其中全部 10 项 ACL 测试通过；这是上一提交的证据，不能当作本轮 Windows 结果。
- 沿用已完成且源码此后未变的本机平台检查及实施者 `git diff --check` 结果；本验收未重跑测试、build、lint 或 typecheck，未发现需要扩大验证的具体缺口。

## Issues

无阻塞实现问题。

## Regression Risks

本机为 macOS，Windows PowerShell 原生行为、Windows 进程强制结束后的恢复及整套 Windows 平台结果仍待新 Windows CI 确认。新增协议夹具验证文件实际删除和错误分类，不能替代原生 ACL 实测。该平台证据边界已在实施报告中明确，按本轮 Spec 不作为实现验收失败。

## Required Rework

无。满足本轮停止条件，不追加检查；后续提交、推送与远端验证按用户授权处理。
