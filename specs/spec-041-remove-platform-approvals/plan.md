# Plan

## 实施
1. 单一实施 Agent 串行修改 Runtime 抖音写操作、退役旧审批 API、移除任务取消对审批存储的依赖；复用 TaskQueue 保存结果，保留 WriteGate 精确匹配与账号/配置/取消检查。
2. 迁移 CLI 与 Desktop/Web 调用，清除 App 计数/菜单/抽屉/轮询和抖音审批列表；互动直接提交并反馈，保留操作记录与活动控制。
3. 检查旧共享审批模块的活跃引用，移除执行机制但不删除 schema 历史表；相关测试迁移到直接行为，当前文档同步。

## 验证计划
Risk Level: S3（修改公共 API 和执行授权链），范围限定抖音直接写、TaskQueue取消、CLI、共享 App/抖音界面。运行相关定向测试和类型检查；不默认全仓库测试/构建，不重复已通过检查。真实平台外发禁止。新独立验收审阅差异与证据，不机械重跑。

## 兼容与风险
旧提案请求不能静默升级成执行；旧待办不重放；未验证协议仍拒绝。复用既有 schema 和操作记录，无迁移或数据删除。当前用户数据、进程和QQ登录态不为测试而重启。

## Git
dev 基线 5aa72b1；该提交已完成上轮 Spec040，本轮开始工作区干净。本次无 commit/push 授权。

## Implementation Report
### Summary
实施完成，待新的独立验收。根因为 Spec025 仅移除 QQ 审批，抖音仍创建 ApprovalStore 提案，App 持续轮询并展示计数。本轮在 Runtime 执行职责层改用现有 TaskQueue，不隐藏按钮或内部自动批准；CLI 与 Desktop/Web 同步直接写入口。无数据迁移、历史待办执行、真实服务重启或 Git 写入。

### Files Changed
- Runtime：douyin/service.ts、routes.ts、tasks/service.ts；删除无活跃消费者的 permissions/store.ts，保留历史 schema 表及归档兼容。
- CLI：activities.ts 新增 write，旧 approvals/propose/decide/revoke 明确退役。
- UI：App.tsx 移除计数/轮询/菜单/抽屉，Douyin.tsx 移除审批组件并改为「点赞 / 发送评论」后进入操作记录，api.ts 同步错误提示，style.css 清理专用样式。
- 测试：迁移 douyin、douyin-write、boundaries、queue、desktop-webui 与旧菜单夹具；新增 douyin-direct、platform-direct-ui 定向回归。
- 文档：README、ARCHITECTURE、SECURITY、docs/douyin、docs/developer、constitution 相关现状。

### Important Decisions
直接写输入固定 tool/args/requestId；已校验参数、账号和 revision 绑定任务并复用队列幂等。最终提交仍检查信号、账号、配置、插件和活动暂停，WriteGate 精确请求/单次提交/回执契约不变。protocol-unverified 在入队前拒绝，旧审批 API 返回 410，历史行不重放。取消与停用使用任务信号，不依赖审批状态。跳到新操作记录作为提交反馈，不复用错误样式的通知。

### Validation
- Risk Level: S3，限定直接相关子系统。
- `npx tsc -p tsconfig.node.json --noEmit`：通过。初次发现 pause 残留 approvals 引用，修复后通过；之后未改后端业务代码。
- `npx vitest run tests/integration/douyin-direct.test.ts apps/runtime/src/douyin/write-gate.test.ts apps/runtime/src/douyin/boundaries.test.ts apps/runtime/src/tasks/queue.test.ts`：既有三个文件 7 tests 通过；新增 direct 用例首跑夹具过早关闭页面导致回执未读取，改为等待响应 body 后仅重跑该文件，1 test 通过。
- 新 direct 回归使用隔离 Runtime、模拟 MCP 和真实 Chromium/WriteGate，覆盖直接点赞/评论、重复 ID 不重发/冲突、缺少 ID 拒绝、未支持协议拒绝、旧接口退役、目标偏离、重复网络写只允许一次、未知结果、排队/在途取消、账号切换、暂停/配置停用和实际 CLI write/旧命令退役；历史审批行无变化。
- `npx vitest run tests/integration/platform-direct-ui.test.ts`：1 test 通过。实际共享 App 在 Desktop IPC 夹具及 Web API 夹具两种模式下无审批请求/入口，暂停/恢复可用，点赞/评论一次提交后进入操作记录，未知结果正确显示。首跑定位器使用错误旧卡片类，改为 article 后通过。协调检查发现「已提交」使用全局红色通知，移除后仅重跑此测试通过。最新 4 图：`build/approval-removal/{desktop,web}-{interaction,records}.png`。
- TypeScript API 限定 Desktop/Web 与本轮改动测试及其依赖：0 diagnostics。此后仅删去通知 import/call 和同步文档，定向 UI 已重验。
- `git diff --check`：业务差异通过。未运行全仓库测试、完整 build 或重复已通过的后端检查。

### Known Limitations
旧 `/tmp/bff-p5-python/bin/python` 与 ffmpeg 测试依赖已不存在；真实 Python/上游端到端用例已迁移并通过类型检查，但本轮未运行，不声称 Python 链路或真实平台外发验证。没有接入真实账号、调用云模型或重启用户开发后台；后端生效需下次运行 `npm run desktop:dev`。隔离测试不代表 Windows/原生实机验收。

### Remaining Questions
无。源码冻结，交独立验收。

## Final Acceptance
2026-11-06：首验产品行为通过，唯一 R1 测试生命周期由新实施 Agent 修复；新的独立验收 `acceptance-r1.md` PASS，全部报告已读取，无待返工。既有9项与相关类型检查沿用，返工仅一次生命周期检查。Spec041 Done，满足停止条件。当前 dev/5aa72b1 上本轮改动未提交，未 push；真实开发后台未重启，需重新运行 `npm run desktop:dev` 生效。
