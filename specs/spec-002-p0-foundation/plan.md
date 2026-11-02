# Plan 002: P0

## 实施顺序

1. 根依赖、TS/ESLint/Vitest/Vite 构建配置与 CI。
2. Runtime 数据路径、SQLite 迁移、日志、单实例与生命周期。
3. 本地认证 API 与 CLI 管理，真实子进程集成测试。
4. React/Tauri 状态壳，Linux Docker 验证路径。
5. 定向修复失败，记录结果并交给新的独立验收 Agent。

工程实施由一个 Agent 串行处理，避免改同一依赖与接口；上游只读研究独立进行。协调者维护全局文档、规格和重要决策。

## 文件范围

根 package/lock/构建配置、apps/runtime、apps/cli、apps/desktop、必要普通共享源码模块、scripts、tests、infra/docker、.github/workflows。不建独立公共包，不更改原始产品文档或许可证。

## 接口与数据

Runtime API 是唯一业务入口；CLI/桌面共享的连接解析可封装普通模块。SQLite 第一版只放基础配置/迁移/审计所需表，后续模块通过版本迁移扩展。认证 token 仅本机权限受限文件可见，日志脱敏；health 不泄露本地路径和秘密。

## 验证

S3：schema、认证与构建。必须执行 npm typecheck、lint、unit/integration、Node build、前端 build、可行的 Tauri build/check，以及一次真实 CLI 生命周期与 Linux Docker运行。具体脚本以实现为准，记录命令/结果/平台；失败后只重跑受影响检查，不因主观信心重复通过项。

## 风险

单实例启动竞态、陈旧 PID、进程残留、SQLite 迁移失败、跨站管理接口访问、日志泄密、不同系统路径与后台进程行为。发布签名、Windows 原生环境及真实账号是单列外部验收条件。

## Implementation Report

实施者 implement_p0 已完成根npm/TS/ESLint/Vitest/Vite工程、Runtime路径/迁移/SQLite实例锁/脱敏日志/认证API/生命周期、CLI六命令、React/Tauri真实状态壳、unit/integration、smoke、Docker与CI。只使用普通模块，无公共分包。

S3实际检查：npm ci成功且零漏洞；npm run typecheck、npm run lint、npm test通过（2文件10测试，包含Node构建）；React生产构建通过；macOS arm64 Node24.20.0 CLI smoke通过；Docker Linux arm64 Node24.22.2镜像构建与CLI smoke通过。覆盖并发启动、单实例、错误token、端口冲突、重启/崩溃恢复、持久化、迁移回滚/版本拒绝、跨站访问、权限和日志脱敏。

原生成功命令：cargo build --release --locked --features tauri/custom-protocol --manifest-path apps/desktop/src-tauri/Cargo.toml。首次缺icon已修正；直接cargo构建必须显式启用custom-protocol，Tauri CLI会自动处理。随后npx tauri bundle --bundles app生成本地未签名测试.app；通过真实AX界面观察连接状态、启动时间和CLI stop后未启动状态。测试进程/临时目录已清理。该.app不是正式发行安装包。

具体修复：开发依赖minimatch覆盖11.0.1消除audit报告；Windows路径测试与dangling symlink边界修正后重跑受影响检查。其余通过项未无故重复。

剩余限制：Windows构建/ACL尚无执行证据，远端CI未运行；数据目录需本机文件系统；启动失败日志在logs/bootstrap.log。独立验收不能据此虚报Windows支持，也不应重复已完成的全部检查。

## Rework 1

accept_p0返回FAIL，完整证据见acceptance.md。由新的实施Agent处理：生命周期必须协调pending listen和stop，监听/进程停止后才释放锁；Windows目录及敏感文件必须明确限制/验证DACL（包括已有显式宽权限和受保护子目录），不能证明安全则拒绝启动；CLI竞争者必须遵守完整就绪期限且区分真实启动错误。新增根因对应的回归用例，只重跑受影响Node检查，不重复未改变的前端/原生壳。Windows实机执行继续列为外部证据缺口。

### Rework 1 Implementation Report

rework_p0已完成：lifecycle等待初始化（含listen）结束后统一关闭，重复停止共享Promise，关闭日志出错仍释放资源并保留错误；startup私有IPC区分ready/contended/failed，竞争等待完整就绪期限；instance只将真实busy/locked归类为竞争。

Windows新增共享PowerShell/.NET helper，从空DACL授予当前用户与SYSTEM，重新读取核验。保护根目录、产品子目录、明确的敏感文件及SQLite sidecar；不递归修改未知文件。Node写入连接token之前限制权限，Node/Rust读取时均验证并fail closed。路径通过JSON stdin传递，双方有helper超时。所有者允许当前身份、SYSTEM、Administrators，但不向Administrators另授DACL权限。Node构建复制脚本，Rust嵌入同一来源。Windows分支仍未实跑。

修改范围：Runtime lifecycle/paths/connection/instance/main/startup/windows-acl模块及测试；CLI process；Rust main/connection_security；integration生命周期和interrupted-start夹具；根build:node及资源复制脚本。未改P1或全局文档。

S3实际检查：Node noEmit类型检查、最终build:node（含类型编译/资源复制）、最终lint均通过；macOS cargo check --locked通过，helper新增超时后重跑受影响检查通过。首轮npm test为13通过、2个Windows专用跳过、1个综合生命周期超时，不记为整套成功；该失败用例单独重跑1100ms通过。随后CLI握手收紧，直接受影响的综合生命周期/端口冲突/慢初始化竞争3项定向检查3.38s通过；新增关闭日志失败1项通过。累计15项macOS可执行测试有通过证据，未放宽断言或超时。

回归证据：pending-listen信号时序注入、重复停止及日志异常均检查实际子进程退出、端口重新绑定和锁重新获取；另有真实OS SIGTERM测试。SQLite真实写事务阻塞1.4秒、三CLI并发返回同一就绪实例；真实启动错误保持失败。首轮超时仅定位到综合用例第23行，记录Test timed out in 30000ms/耗时77310ms，没有内部步骤日志，原因未明，后续未复现；不能编造已查明根因。

未重复无变化的前端/原生UI/Linux全矩阵。测试临时数据与进程已清理；dev未commit/push。交给新的独立验收者，Windows原生/ACL与远端CI证据继续作为外部门槛。
