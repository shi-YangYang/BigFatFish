# Acceptance 002: P0

## Result

FAIL（P0 完整阶段）。Windows 原生构建与 ACL 实机证据仍缺，不能标 Done。2026-11-02 新独立验收者 accept_p0_rework 对 Rework 1 代码返工给出 PASS；三项已知代码缺陷已闭环，无新增代码返工。以下保留初轮证据，末尾记录复验结果。

## Spec Coverage

普通模块、Runtime/CLI、数据库迁移、认证API、桌面状态、Docker及CI均有真实实现；测试覆盖事务回滚、版本拒绝、正常并发、持久化、崩溃恢复、错误token、跨站/Host拒绝及日志脱敏。Rust读取受限连接并调用API，React不直接接触token/DB。P1+尚未实现不计为本阶段代码缺陷。

## Validation

- Risk Level: S3。
- Evidence Reviewed / Checks Performed: 独立阅读实现/测试/配置及实施报告；仅执行启动中断与慢初始化并发两个针对具体疑点的复现，未重复整套检查。
- 实施者已有本机/Linux/React/Tauri与原生UI证据单独保留，不当作本验收者重新执行。
- 复现临时进程与目录已清理，未修改工程或Git。

## Issues

1. P1：lifecycle.ts在app.listen未完成时处理SIGTERM，app.close可能先完成而listen随后打开socket；catch再次stop被幂等标志跳过。通过newListener微任务注入SIGTERM处理时序，得到START_INTERRUPTED、connection不存在、锁已释放，但lsof仍见127.0.0.1:55210监听；该PID已清理。这是信号处理时序注入，不冒充真实OS信号。应等待pending listen settled及监听真正关闭后释放锁；回归必须证明进程退出和端口释放。
2. P1：paths.ts使用icacls /inheritance:r /grant:r，保留既有Everyone/Users显式ACE，也不收紧受保护子目录/文件。自定义宽权限目录可能暴露bearer token。依据代码与[Microsoft icacls官方语义](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/icacls)，不是Windows实测。应建立/验证明确受限DACL，不可确认安全则拒绝启动，并添加Windows特定用例。
3. P2：CLI process.ts在竞争子进程退出后仅等250ms便START_FAILED，绕过12秒总期限。真实临时DB持写事务1.4秒、并发3个CLI，两个失败一个成功，随后status正常。应区分竞争与真正失败，竞争者等待获锁实例到实际就绪或总期限，保留真实失败退出码。

## Regression Risks

生命周期清理顺序、并发就绪判断、Windows敏感数据ACL为直接风险。已通过的前端/原生壳不因未相关修改机械重跑。

## Required Rework

初轮要求由新的实施Agent修复三项及相关回归，再由新的独立Agent复验；该代码返工现已完成。Windows原生构建/ACL实机未执行，远端CI未运行；继续单列外部缺口，不能用YAML或macOS成功替代。

## Rework 1 Acceptance

Result: PASS（仅代码返工审阅）。accept_p0_rework独立阅读实现、回归断言、构建资源复制和CI接入，未发现三项修复仍需返工的具体问题；采用实施报告中已有检查证据，未重新运行已通过项。

- lifecycle.ts初始化barrier与共享停止Promise协调pending listen，资源按顺序释放；回归证明实际进程退出、端口再绑定和锁重新取得，时序注入与真实OS信号明确区分。
- CLI私有IPC区分ready/contended/failed；竞争者等待认证就绪，真实错误仍失败；真实SQLite事务阻塞和三并发CLI覆盖原始条件。
- Windows从空DACL建立并复核允许项，token写入前收紧权限，Node/Rust读取前共用helper校验；拒绝reparse point，仅处理明确产品路径。Windows用例覆盖宽显式权限、受保护产品文件、未知文件与junction，但尚未实跑。

Risk Level: S3。首轮综合测试超时原因未明，后续定向通过且未放宽断言；没有支持扩大验证的具体缺陷证据，保留限制。Required Rework: 无新增代码返工。Windows外部门槛继续开放，按用户要求推进不依赖此条件的P1。
