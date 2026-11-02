# Task Handoff

## Role

P1代码验收与Linux收尾完成，协调者本地提交后进入P2。

## Goal

完整目标 P0–P7 保持 active。当前实现 Spec 003 的真实DSH模型/人格/会话/聊天链路。P0代码返工PASS，Windows外部证据单列；按用户要求继续独立工作。

## Context

初始仓库只有目录和文档，dev 基线 f18d3ec。用户最新要求自主实现、安装依赖并执行每阶段检查；保留普通源码模块封装，不恢复 packages。根产品原稿和各状态文档按最新指定位置整理。

## Project Mode

EXISTING，阶段 Acceptance。P1的两项Chat问题已由rework_p1修复并由accept_p1_rework给PASS；Docker两行并发设置由fix_p1_docker_install实施、独立审阅PASS。正式Linux镜像真实DSH smoke已通过。Windows与真实云Key仍未验证，完整阶段不虚报Done；下一步按用户授权本地提交P1并继续P2。

## Spec

- [Spec 003](../../specs/spec-003-p1-ai-core/spec.md)
- [Plan 003](../../specs/spec-003-p1-ai-core/plan.md)
- [Decision 002](../decisions/002-autonomous-delivery.md)
- [Decision 003](../decisions/003-dsh-engine-boundary.md)

## Relevant Files

根 AGENTS.md、BigFatFish_产品设计目标.md、ARCHITECTURE.md、constitution、.ai/rules、当前 Spec/Plan；研究输出后补充 docs/upstreams.md。

## Scope

在单根npm工程和现有Runtime上实现真实DSH Adapter、受控profile/bridge、模型凭据加密与路由、版本化人格、会话与消息迁移、真实流/取消/恢复、认证API/WebSocket、CLI及React/Tauri界面。实施者可修改实际工程文件、README和必要使用文档；协调者维护治理与整体状态。

## Out of Scope

不把P2–P7标为实现，不使用真实社交账号或执行平台写操作；不将测试模型当真实云模型。不得读取其他应用保存的凭据或调用未授权收费服务。

## Constraints

模块封装，不分独立公共包；统一 Runtime/人格/记忆/权限；UI 不直接访问 DB。独立验收者不能修改实现，失败后由新实施者返工。真实业务代码必须实现，不用空脚本凑检查。

## Acceptance Criteria

遵循Spec003。S3：类型/Lint/unit/integration、真实官方SDK/子进程连接本地HTTP模型夹具、真实CLI/桌面链路、受影响构建；模型实际云调用与Windows等未执行证据单列。

## Commands

实际命令由根 package.json 定义，结果写进现有阶段 Plan/acceptance 和 docs/progress/development.md。不得重复无变化且已经通过的检查。

## Expected Output

实施报告列文件、决定、实际检查及结果、未验证平台/阻塞；协调者组织新的独立验收。

## Git 状态与授权

当前dev，P0快照已按用户最新授权本地提交`52eaaf8`，树`d6c289cea52fe5f036ad662d3b0f883b5bfb882c`。用户已明确“以后每完成一个阶段，就本地commit一次”：协调者在每阶段实现/代码验收后本地提交，不再重复申请；外部门槛仍需准确保留。没有push/PR/改写历史授权，远端CI未运行。

P1所有改动保持未暂存；实施Agent不得git add/restore/reset、更改index、切分支、commit或push，由协调者在独立验收后统一处理。Spec003–009与Decision003尚未提交，其中004–009仅未来Draft，应在各自阶段提交。远端`git@github.com:shi-YangYang/BigFatFish.git`，未做推送，未知远端状态不补写成功。

## 当前运行验证交接

2026-11-03最新Goal状态active，用户短暂暂停后恢复，不重启任务。P1所有实施/验收报告已读取处理。原Dockerfile两次ECONNRESET后低并发安装成功，正式bigfatfish:p1-check构建及镜像内DSH/CLI流与重启resume smoke均PASS；无需重复。诊断容器bff-p1-deps-01a19aff、镜像p1-linux-deps-check和cache卷均已删除。正式p1-check镜像保留；测试夹具代码/tmp/bff-p1-linux-check保留复现，运行数据/进程已清理。所有旧exec sessions均结束，不再等待它们。
