# 变更记录

此文件记录实际变化；路线与计划见 [roadmap](constitution/roadmap.md)。尚无已发布版本。

## 未发布

- 初始化应用、插件、辅助服务、部署与测试目录。
- 按用户决定采用普通源码模块封装，移除独立公共包的空目录预留。
- 纳入产品设计和 Agent 协作规范，建立 constitution、Spec 模板及初始化记录。
- 增加 Git 忽略规则、编辑与换行约定、项目入口及贡献文档。
- 实现 Node Runtime、认证本地 API、SQLite 迁移与单实例、脱敏日志，以及真实启停/重启/状态/日志/诊断 CLI。
- 实现读取真实 Runtime 状态的 React/Tauri 桌面壳、根 npm 工程、测试、基础 Docker 和跨系统 CI 配置。
- 修复启动中断残留监听、慢初始化并发误报；增加共享 Windows ACL 限制与读取验证。代码返工已独立审阅，Windows 实机检查仍未执行。
- 核查用户指定上游的版本、许可证与接入边界，记录于 docs/upstreams.md。

当前尚无聊天、养成、平台集成或正式安装包；完整阶段与平台证据见 [实现状态](IMPLEMENTATION_STATUS.md)。
