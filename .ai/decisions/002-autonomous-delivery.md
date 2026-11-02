# Decision 002: 全阶段交付与 P0 工具链

## Context

2026-11-02 用户明确授权持续实现完整 P0–P7，安装依赖、运行测试并自主处理常规技术问题，阶段验收后继续下一阶段。之前本地提交仅涵盖初始化，不能自动沿用为后续提交/推送授权。

## Decision

- 维持完整目标。每项状态由代码与实际证据决定；账号/密钥/操作系统外部验收不足不能写成已支持，也不阻止独立工作。
- 最新请求明确指定根文档位置：将产品原稿、CONTRIBUTING、SECURITY、CHANGELOG 移到根，新增 ROADMAP、ARCHITECTURE、IMPLEMENTATION_STATUS，详细连续记录放 docs/progress/development.md。覆盖之前仅 README 在根的安排；原稿内容保持。
- 保留用户已确认的普通模块封装。单根 package.json/npm lock，不使用多包 workspace；Rust Cargo 工程为 Tauri 所需。
- P0 使用本机可用 Node 24、npm、TypeScript，Fastify，node:sqlite；React/Vite/Tauri 2；Vitest/ESLint。通过真实 registry 核实版本后锁定依赖。
- 本地默认 loopback API，受保护的 token 文件、认证管理接口、单实例及事务化迁移。独立 API/CLI 集成与 Docker Linux 实跑先完成；具体发布封装在 P6 扩展。

## Reason

执行明确产品方向，减少跨平台原生 SQLite 依赖和不必要的包管理；本机和 Docker 能提供实际运行证据。外部引擎、平台及发布能力仍按原阶段审查与实现。

## Alternatives

不使用独立公共包；不重写上游成熟 Python 能力；不以模型直连替代所要求的 DSH Adapter；不把 CI YAML 当跨系统验收结果。

## Consequences

P0 属 S3（数据库、认证、构建）。每阶段独立验收；发生失败由新实施者返工。外部条件未满足的项目单独标注并继续可执行路径。当前没有授权新的 commit、push、PR、远端 CI 发布、签名服务或平台社交写操作。

## 后续 Git 授权更新

2026-11-02，用户回复“以后每完成一个阶段，就本地commit一次”。自此在本次完整Goal中，各阶段实现与代码验收后由协调者创建一次本地提交；外部验收缺口仍须如实记录，不因commit将阶段虚报Done。授权不包含push、PR、历史改写或平台写操作。

P0已核对暂存快照于dev提交为`52eaaf8 feat: 实现 P0 工程基础与运行验证`，树`d6c289cea52fe5f036ad662d3b0f883b5bfb882c`；未混入正在实施的P1。未推送，远端CI/Windows实机缺口保持开放。此前“无新commit授权”是原始状态，由本次明确指令更新。
