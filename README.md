# BigFatFish

一条可以长期陪伴、积累记忆与经历的 AI 鱼。

BigFatFish 计划通过同一个独立 Runtime 提供桌面、命令行和无界面服务入口，并通过插件接入 QQ、B站、抖音等平台。人格、记忆、模型配置和权限由 Runtime 统一管理。

## 当前状态

目前完成的是仓库目录与文档初始化。Runtime、CLI、桌面应用、平台插件和 CI 均未实现，尚无安装包、依赖清单或运行命令。Windows/macOS 桌面、三平台 CLI 和 Linux Headless 是产品目标，尚未验证支持。

下一步按 [P0 路线](constitution/roadmap.md) 确认工具链及接口，建立可运行的最小工程。技术方向与待确认事项见 [技术栈与工程边界](constitution/tech-stack.md)。

## 目录

```text
apps/
├── runtime/src/             # 独立核心 Runtime
├── cli/src/                 # 命令行入口
└── desktop/
    ├── src/                 # React 界面
    └── src-tauri/src/       # Rust 桌面外壳
plugins/                    # 平台与能力插件源码
services/                   # 独立辅助服务
infra/                      # Docker / systemd 部署文件预留
scripts/                    # 工程脚本预留
tests/                      # 集成与端到端测试预留
docs/                       # 产品基线与详细文档
constitution/               # 使命、路线与技术边界
specs/                      # 规格、计划、验收与模板
.ai/                        # Agent 决策、流程、交接与规则
```

源码按职责组织为普通模块，出现实际共享需求时再封装复用，不建立独立公共包。

源码目录目前通过 `.gitkeep` 保留，尚无可运行实现。用户数据与源码分离；未来本地开发数据约定放在已被 Git 忽略的 `.local/bigfatfish/`。

## 文档与参与

- [产品设计目标](docs/product-design.md) · [项目使命](constitution/mission.md) · [开发路线](constitution/roadmap.md)
- [协作规范](AGENTS.md) · [Spec 管理](specs/README.md) · [初始化规格](specs/spec-001-repository-initialization/spec.md)
- [贡献指南](docs/CONTRIBUTING.md) · [行为准则](docs/CODE_OF_CONDUCT.md) · [安全说明](docs/SECURITY.md) · [变更记录](docs/CHANGELOG.md)

项目采用 [MIT 许可证](LICENSE)。后续集成第三方代码前需单独核对其许可证与使用条件。
