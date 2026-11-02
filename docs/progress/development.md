# 全阶段开发记录

## 2026-11-02：目标接入与仓库审查

- 全目标为 P0–P7，未缩减为演示。当前在 dev，初始基线 f18d3ec，工作区开始时干净；只有目录/文档，无依赖和业务实现。
- 产品原稿原位内容从 docs/product-design.md 移到用户指定的根 BigFatFish_产品设计目标.md。根 ROADMAP、CHANGELOG、ARCHITECTURE、CONTRIBUTING、SECURITY、IMPLEMENTATION_STATUS 按最新任务安排；既有治理结构保留。
- 工程继续按普通源码模块封装，单根依赖清单，不建立独立公共包。
- 实测环境：macOS arm64；Node 24.20.0、npm 11.19.0、Rust/Cargo 1.99.0；Docker 引擎 linux aarch64 可用。当前仅装 aarch64-apple-darwin Rust target。
- 已开始上游 DSH/两个抖音项目，以及 B站/QQ 的只读接口和许可证核查。研究代理不修改工程代码。
- P0 将作为 S3 实施：涉及 SQLite、认证 API、构建和 CI，按用户要求执行类型、Lint、单元、集成与运行检查。

下一步：实施 Spec 002。Windows 构建/安装与各平台账号实测只在取得真实证据后更新状态；普通技术问题自行处理。

## 上游核查与 P0 实施进展

- 用户已明确提供13个上游地址，B站准确来源疑问解除；固定版本、接口、许可和复用边界汇总在 docs/upstreams.md。DSH实际发布包与master API存在差异，P1拟固定alpha.2并使用受控工具profile与自有bridge；尚未把静态分析当运行证明。
- P0实施者已完成第一轮Node类型/Lint及10项unit/integration、macOS真实CLI smoke与React生产构建。随后修正Windows路径测试、dangling symlink边界和开发依赖minimatch漏洞，并重跑受影响检查。
- 最新实施者报告：npm ci零漏洞，typecheck/lint/10测试通过；本机 cargo build --release --locked通过；Docker Linux arm64真实CLI smoke通过。具体报告、独立验收与桌面实际UI验证尚在收尾，当前不标P0全部完成。

## P0 独立验收与返工

- 原生.app已通过AX实际观察：连接Runtime时显示已连接/真实启动时间；CLI停止后刷新显示服务尚未启动，进程与临时数据已清理。
- accept_p0完成独立审阅并返回FAIL：启动中断可遗留HTTP监听；慢数据库初始化时并发start过早失败；Windows既有宽权限DACL未被明确清除/验证。前两项有定向复现，第三项为代码与Microsoft官方语义证据，未冒充Windows实测。
- 新实施者rework_p0正在修复生命周期停止Promise、私有IPC启动握手和共享Windows ACL helper，补根因对应回归。只重跑受影响Node检查及必要Rust检查，不重复无变化的完整验证。
- Windows原生与ACL实机、真实云模型/社交账号、正式发行安装仍未验收。完整目标保持active，当前先消除P0代码缺陷。

## P0 返工复验

- rework_p0报告三项代码修复完成，完整证据进入Spec002 Plan。Node类型/build/lint与macOS Rust check通过；15项本机可执行测试累计有通过结果。首轮综合用例超时，定向复跑及握手调整后的受影响测试通过，超时根因未查明，没有改写为整套测试一次通过。
- 新的独立验收者accept_p0_rework正在复核上述三项根因和回归证据，不重复未变化的完整矩阵。
- P1草稿和Decision003已记录真实DSH版本、受控profile、模型凭据、流/取消/恢复边界；业务代码尚未开始。
- accept_p0_rework已返回PASS（代码返工范围）：三项修复无新增具体缺陷，不需再次返工。P0完整阶段仍因Windows证据不足保持未完成；按照用户允许继续独立工作的指令，下一步进入P1。工作区diff格式检查通过，未创建新commit或push。
