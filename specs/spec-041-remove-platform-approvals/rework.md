# Rework — R1 测试生命周期

## 目标
依据 acceptance.md，修复 `tests/integration/douyin.test.ts` 新取消机制关闭浏览器后继续调用 `fixture.account` 的测试回归。产品 Runtime/UI/CLI 已通过独立代码检查，无业务代码返工。

## 范围与约束
由新的实施 Agent 修改此测试的场景顺序或必要夹具生命周期；优先将账号切换检查置于首次取消之前，保持同一已连接 context。保留账号不符零提交、取消零提交、真实收据等原断言，不跳过、不吞异常、不弱化取消。不修改其他业务，不创建子 Agent，不 commit/push。

## 必要验证
S1，仅一个无 Python 的最小真实 Chromium 生命周期检查（有效 context 中切换账号、关闭后重新 attach；对应所选修复）。不重复已通过9项，不运行全仓库检查，不安装新环境。完成后由新的独立验收 Agent 复验。

## Implementation Report
### Summary
返工实施 Agent：`/root/rework_approval_test_lifecycle`，2026-11-06。R1 已修复，交新的独立验收。根因是测试在 TaskQueue 取消关闭浏览器之后仍向旧 context 写入账号 Cookie；将完整账号切换/拒绝/恢复场景移至首次取消之前，使它使用当前仍存活的 Runtime 浏览器。随后取消仍关闭该浏览器，后续操作由原 lease 正常重新 attach，不修改取消机制。

### Files Changed
- `tests/integration/douyin.test.ts`：仅移动原账号变化场景并添加生命周期注释；保留账号不符、两种取消均不增加提交数的全部断言。
- 本文件记录返工。检查脚本及结果放于被忽略的 `build/approval-removal/r1-lifecycle-{check.mjs,result.json}`，未增加产品文件或新依赖。

### Validation
- Risk Level: S1（仅测试场景顺序）。
- `node build/approval-removal/r1-lifecycle-check.mjs`：PASS，退出码 0。脚本先核对源码中账号切换及恢复均在首次取消之前，再用真实 headless Chrome 与原 `douyinFixture` 验证有效 context 的 67890 → 12345 切换；关闭后重新 attach 得到 12345，提交数为 0。未导航到真实平台，浏览器已在 finally 关闭。
- 仅执行上述一个定向生命周期检查并审阅相关 diff；未重跑此前 9 项、类型检查、全套测试或 build，未安装 Python/ffmpeg。

### Known Limitations
本次只验证 R1 生命周期修正，不冒称真实 Python/上游整条链已运行。无业务代码修改、真实账号/后台操作或 Git 写入。

### Remaining Questions
无。实现已冻结，等待新独立验收。
