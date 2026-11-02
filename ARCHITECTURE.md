# 架构

## 运行边界

Desktop、CLI、未来 Web Console → Runtime API/IPC → 同一个 BigFatFish Runtime → 引擎适配、平台插件、存储及辅助服务。

Runtime 统一拥有人格、模型路由、会话、记忆、任务、权限和审计。客户端只调用接口，不能直接操作 SQLite 或平台协议。关闭桌面窗口与停止 Runtime 是不同操作。

## 源码组织

- apps/runtime/src：核心后台及职责明确的普通模块，包括 AgentEngine/DSHAdapter。
- apps/cli/src：本地命令行、后台进程控制和 Runtime 请求。
- apps/desktop/src、src-tauri：React 界面与 Rust 原生外壳。
- plugins：平台/能力插件；services：复用 Python 等辅助服务。
- infra：Docker 与 systemd；scripts：工程脚本；tests：跨模块验收。

只使用一个根 JavaScript 依赖清单和锁文件。复用通过普通源码模块实现，不恢复 packages 目录，不为组件/模块增加独立发布。Tauri 保留生态需要的 Cargo 工程。

## P0 技术选择

Node.js 24、TypeScript、npm，Fastify 管理 API，Node 内置 SQLite；React + Vite + Tauri 2；Vitest 单元/集成测试，ESLint 和 TypeScript 静态检查。依赖实际版本由安装时核实并锁定。

本地 API 默认仅监听 loopback，使用随机 bearer token 和受限文件权限；不得向网页或日志公开凭据。所有管理路由认证，健康检查只返回最低限度信息。非 loopback 监听在具备 TLS/认证部署路径前不得默默开放。

用户数据与安装目录分离，支持显式 data-dir，默认按 Windows/macOS/Linux 选择用户数据位置。SQLite 迁移有版本记录且事务化；Runtime 单实例、崩溃后可恢复、退出释放资源。基础日志必须脱敏。

## 外部集成

DSH 与平台适配使用真实、已核对的公开接口。上游代码不未经许可复制；研究结果进入 docs/upstreams.md。平台事件转换为统一事件，不能维护第二套人格、记忆或调度。社交写操作必须经过统一权限和审批门。

## 验证边界

单元/协议测试、真实 Runtime 进程运行、外部账号实测、操作系统构建和安装验证分别记录；任一层通过不能替代其他层。跨平台 CI 配置存在不表示 CI 已执行。
