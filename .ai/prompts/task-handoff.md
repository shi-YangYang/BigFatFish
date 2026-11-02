# Task Handoff

## Role

Implementation（一个实施 Agent 串行完成 P0）→ 新的独立 Acceptance。上游只读研究独立开展，不改业务文件。

## Goal

完整目标 P0–P7 保持 active。当前实现 Spec 002 的 P0 可运行工程；通过验收后继续 P1。外部条件影响的验收项单列，继续独立工作。

## Context

初始仓库只有目录和文档，dev 基线 f18d3ec。用户最新要求自主实现、安装依赖并执行每阶段检查；保留普通源码模块封装，不恢复 packages。根产品原稿和各状态文档按最新指定位置整理。

## Project Mode

EXISTING，阶段 Acceptance。P0独立验收accept_p0发现的三项具体缺陷已由rework_p0修复，完整报告记录在Spec002 Plan的Rework 1 Implementation Report；新的验收Agent独立复核。Windows原生证据缺失，不标阶段全部完成。上游研究已完成并汇总docs/upstreams.md；Spec003仅准备草稿。

## Spec

- [Spec 002](../../specs/spec-002-p0-foundation/spec.md)
- [Plan 002](../../specs/spec-002-p0-foundation/plan.md)
- [Decision 002](../decisions/002-autonomous-delivery.md)

## Relevant Files

根 AGENTS.md、BigFatFish_产品设计目标.md、ARCHITECTURE.md、constitution、.ai/rules、当前 Spec/Plan；研究输出后补充 docs/upstreams.md。

## Scope

单根 npm 工程，Node24/Fastify/node:sqlite Runtime，CLI，React/Tauri2状态壳，测试/构建/CI与Linux Docker验证。实施者可修改实际工程文件和README运行说明，协调者维护治理与整体状态。

## Out of Scope

不把 P1–P7 标为实现，不安装或使用真实社交账号，不执行平台写操作；不将测试替身当真实服务。不得读取其他应用保存的凭据。

## Constraints

模块封装，不分独立公共包；统一 Runtime/人格/记忆/权限；UI 不直接访问 DB。独立验收者不能修改实现，失败后由新实施者返工。真实业务代码必须实现，不用空脚本凑检查。

## Acceptance Criteria

遵循 Spec 002。S3：类型、Lint、unit/integration、真实CLI生命周期、Linux Docker、前端构建、本机Tauri；Windows等未执行证据单列。

## Commands

实际命令由根 package.json 定义，结果写进现有阶段 Plan/acceptance 和 docs/progress/development.md。不得重复无变化且已经通过的检查。

## Expected Output

实施报告列文件、决定、实际检查及结果、未验证平台/阻塞；协调者组织新的独立验收。

## Git 状态与授权

当前 dev，基线 f18d3ec，开始时工作区干净。前次本地commit授权已用于初始化；本次全阶段开发没有新的commit/push/PR授权。不得切分支、提交、推送或修改全局配置。开发已获授权，继续实施。
