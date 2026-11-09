# Spec 002: P0 可运行工程基础

状态：Acceptance（外部验证待完成）。三项代码返工已通过新的独立审阅；Windows原生构建/ACL实机证据仍缺，P0整体不标Done。范围来自完整 P0–P7 目标；用户已授权自主完成工程技术选择。

## 背景

现有仓库只有已验收的目录与文档。需要真正可运行的统一 Runtime，供后续各阶段扩展。

## 目标

实现单仓库工程、Node/TS Runtime、CLI 生命周期、数据目录与 SQLite、基础认证 API、真实桌面状态连接、CI 和测试。

## 非目标

本阶段不声称聊天、平台插件、养成或正式安装包已完成；这些继续在 P1–P7 实现。不得生成假插件、假状态或带成功退出码的空测试。

## 当前行为

没有可执行代码、依赖清单、数据库和构建流程。dev 基线 f18d3ec。

## 目标行为

用户能安装依赖、构建，用 CLI 启停后台并查询状态/日志，进程脱离终端继续运行。数据目录可指定，SQLite 能初始化和重开，重复启动不产生第二实例。Desktop 经统一 API 显示真实 Runtime 状态，故障有明确提示。

## 功能需求

1. 单根 package.json 与锁文件，普通模块封装，不创建 packages/workspaces；提供 build/typecheck/lint/test 和 CLI/桌面开发命令。
2. Runtime 前台及后台运行、单实例协调、健康检查、优雅关闭、启动失败清理、崩溃后重启恢复。不得杀死非本产品进程。
3. 跨平台用户数据目录与 --data-dir/BIGFATFISH_DATA_DIR；分离 config/data/runtime/logs，数据库迁移事务化、版本检查，权限收紧、凭据不进日志。
4. Fastify 本地 API：最小健康检查、认证状态查询、受认证停止、有限量日志查询；请求校验、错误返回、超时。loopback 默认，禁止无保护绑定公网。
5. CLI 至少 start/stop/restart/status/logs/doctor，支持可脚本化 JSON 输出、真实退出码；start 等待实际就绪，stop 等待实际停止。共享连接代码以普通模块提取。
6. React + Tauri 2 最小原生壳，真实读取 Runtime 状态和连接错误；UI 不直接访问数据库/平台。原生宿主可以读取本机受限连接元数据并调用 API。
7. CI 覆盖 Node 类型/Lint/单元集成、Linux 运行、Windows/macOS 桌面壳构建；本机实际运行可执行的项目，不能虚报远端 CI 已执行。
8. 基础 Docker 执行路径用于 Linux 实测，可在 P6 完善发布。无需真实密钥或平台账号。

## 边界条件

数据路径带空格；端口占用；锁竞争与陈旧锁；权限失败；启动中断；错误 token；跨站请求；数据库版本过新或迁移失败；未启动 status；重复 start/stop；后台 stdout/stderr 管理。测试不应污染真实用户数据。

## 技术约束

Node 24 + TypeScript + npm，Fastify 与 node:sqlite；React/Vite/Tauri2，Vitest/ESLint；按现有 apps 组织，用户数据和源码隔离。具体版本锁定在 manifest/lockfile。遵循 ARCHITECTURE 和 Decision 002。

## 兼容性要求

Windows/macOS 桌面构建与 Linux CLI 是产品门槛，分别记录证据。当前本机 macOS arm64、Docker Linux aarch64；缺少外部执行环境的验收保持未验证，不伪造完成。

## 验收标准

- [x] 从锁文件安装依赖，类型检查与 Lint 通过。
- [x] 单元测试覆盖数据路径、迁移/版本边界、认证和单实例关键逻辑。
- [x] 集成测试启动真实 Runtime/CLI，验证 start/status/restart/stop、持久化、错误授权和异常恢复。
- [x] 本机实跑与 Docker Linux 运行得到真实健康/状态及退出结果。
- [x] React 构建和本机 Tauri 壳编译通过，UI 状态来自 API。
- [ ] Windows/macOS 桌面壳构建分别有真实证据；缺失项标外部未验证，不标阶段全部完成。
- [x] CI 和用户命令有效，文档记录实际结果、限制与下一阶段任务（P1发现并修复Tauri版本不匹配，正式desktop:build已通过；远端CI仍未运行）。
- [x] 独立验收完成；无本阶段必须修复的已知代码缺陷（完整阶段仍受Windows证据门槛约束）。

## 待确认问题

本阶段无需要用户再次决策的工程问题。未具备 Windows 执行环境、上游账号/密钥等条件时记录受影响证据，不阻塞独立工作。
