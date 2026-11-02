# Task Handoff

## Role

P2代码验收已完成，协调者执行已授权的阶段本地提交，随后进入P3。

## Goal

完整P0–P7 Goal保持active。当前实现Spec004：有来源、可确认/管理的长期记忆，日记、兴趣、经历、关系、心情与养成主页。不能缩减为演示或将未来Draft当实现。

## Context / Project Mode

EXISTING，P2代码验收PASS。P0本地提交52eaaf8；P1提交b1f73b3。首轮三项问题由新rework_p2修复，完整报告在Plan004；新的accept_p2_rework逐项审阅后PASS。Windows原生/ACL、真实云Key与本轮P2 Linux实跑仍未验证，用户允许继续不依赖外部条件的工作。

## Spec / Relevant Files

- specs/spec-004-p2-memory-life/spec.md、plan.md。
- .ai/decisions/004-memory-confirmation.md，既有Decision002/003。
- 根AGENTS、constitution/mission/tech-stack、全部.ai/rules、产品目标、ARCHITECTURE。
- P1实际接口在Plan004列明；docs/ai-core.md与Spec003验收提供现有行为/证据。

## Scope

Memory Engine及schema迁移、来源/候选/确认/拒绝/去重/冲突/检索/管理/导出，真实DSH提取与日记任务，同一聊天的有限已确认上下文，统一经历/活动/兴趣/关系/心情及可读Markdown副本，认证API/CLI/Desktop主页/时间线/记忆页。实施者负责业务与必要使用文档；协调者维护全局状态/spec/decision。

## Out of Scope

不提前实现QQ/B站/抖音，不用静态假数据制造活动，不调用未授权真实收费模型或读取其他应用凭据。不重构目录或建立公共包。完整备份/恢复在P6，P2完成本阶段的可读导出。

## Constraints

单根npm工程、普通模块；Runtime唯一业务入口，统一人格/模型/AgentEngine/记忆/权限。默认提取为候选，用户确认后才跨会话检索；推测不能成为确定事实。提取和日记默认显式触发，不偷偷每轮调用收费模型。中文短查询须可用，检索有预算；来源文本不授予工具权限。

P1 Chat选择身份/草稿版本、DSH资源清理、P0生命周期/ACL修复须保留。新任务参加同一停止/重启恢复，不在DB关闭后写入。Windows新增敏感文件权限不得遗漏。

## Acceptance Criteria / Commands

按Spec004，S3：类型/Lint、相关unit/integration、真正DSH+本地HTTP模型夹具走聊天→候选→确认→新会话检索；拒绝/删除/冲突/来源/导出/迁移/重启/文件失败边界；实际CLI与Desktop。只跑受影响检查，不无故重复P0/P1全矩阵。未运行的平台和真实云Key明确单列。

## Expected Output

PASS/FAIL Acceptance Report，按Spec逐项核对实际源码、diff和实施证据。不要机械重跑已通过检查；有具体疑点才执行定向复现。审查管理/来源/删除/预算、任务恢复、文件权限/失败、UI异步与真实数据、现有聊天回归。将代码验收与Windows/真实云等外部缺口分开，不将未执行环境写为通过。失败由新的实施者与新的验收者闭环；验收者不修改业务代码或Git index。

## Git 状态与授权

当前dev，HEAD b1f73b3。用户明确“以后每完成一个阶段，就本地commit一次”，协调者在每阶段实现与代码验收后提交，不重复询问。没有push/PR/历史改写授权，远端CI未运行。

P2实施者不得git add/restore/reset、更改index、切分支、commit或push；保护当前治理文档改动与Spec004–009未跟踪稿。Spec005–009只是未来Draft，各自阶段再提交，不夹带到P2业务提交。

## 已完成验证资源

2026-11-03最新Goal状态active，曾暂停后恢复，沿原断点继续。P1正式bigfatfish:p1-check镜像保留，已通过Linux arm64 Node24.22.2真实DSH检查；无需重复。诊断容器/镜像/cache卷已删除，所有旧exec sessions结束。/tmp/bff-p1-linux-check和/tmp/bff-chat-rework-check仅保留夹具代码供复现，运行数据与进程已清理。所有P1Agent报告已读取处理，无未完成的P1实施任务。
