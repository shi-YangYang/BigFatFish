# 项目目录整理

根目录只保留 README.md 作为 Markdown 入口。协作说明在 .ai/ 中维护，设计与使用资料归 docs/，长期技术约束和路线归 constitution/。同一份资料只保留一个维护位置。

已信任的 Codex 项目通过仓库内 .codex/config.toml 把 README.md 作为规则入口。README 要求开发前读取 .ai/AGENTS.md。此设置符合 [OpenAI Docs 的备用文件名机制](https://learn.chatgpt.com/docs/agent-configuration/agents-md#customize-fallback-filenames)；本机实测以含斜线的 .ai/AGENTS.md 直接作为备用文件名不能加载规则。

Desktop 保留应用入口，按功能组织聊天、连接、我的鱼、设置，通用组件及 beUI、API 调用和样式有各自位置。Web 复用这些模块。CLI 将命令与共享输入、进程和 Runtime 访问分开。Runtime 延续现有领域模块，插件及辅助服务保持原有边界。直接更新消费者的引用，避免保留重复的路径或增加独立包。

目录调整仅影响源码路径与维护说明。通过 Git 可恢复旧目录；已有账号、安装目录、数据和对外协议无需迁移。
