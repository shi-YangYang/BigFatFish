# Acceptance

## Result

PASS。新独立验收者accept_linux_x64完整报告已处理。Linux x64发行补充满足本轮范围，无直接相关返工；不是完整P6或全产品完成。此前停机修复及P6历史验收保留如下。

## Spec Coverage

- 原Dockerfile与发行脚本实际生成linux/amd64镜像及linux-x64归档，无生产源码或依赖变更。运行报告证明linux/x64、uname x86_64、UID1000、Node24.20.0、SQLite3.53.4及数据库写入/查询、Runtime启停。
- SDK打包/安装/拒权/调用/停用、真实固定DSH工具续答及结果消费、TLS首页/资源/登录/401/403/Cookie/同Runtime代理/退出撤销都有对应断言与执行记录。
- 实际归档解压到/tmp/安装 包，干净容器无/app，受限PATH下使用随包Node/CLI；镜像与归档七项资源hash一致，包含已验收停机修复。
- 产物路径隔离，未覆盖Mac/arm64产物，临时资源清理符合范围。

## Validation

- Risk Level: S3，限目标架构发行与运行。
- 独立审阅治理、Spec/Plan/实施报告/历史验收/Decision008、Dockerfile、发行/运行脚本、模型夹具、命令、构建日志、两份运行报告及原生模块库存。
- 实际只读核对六个源文件和编译process.js哈希，均与build/p6-linux-x64-evidence/evidence.json一致；两份归档均182984198字节，校验文件与报告一致，元数据目标linux-x64。
- 实际核对Docker镜像ID/amd64/普通用户/无声明端口、临时目录已删除和任务容器为空。首次Docker模板读取缺失ExposedPorts字段失败，改读JSON确认空值，不是产品故障。
- 未重跑构建、测试、Lint、完整归档哈希或其他平台矩阵，未修改文件/Git/index。

## Issues

无直接相关未解决问题。

## Regression Risks

arm64 Mac上的Docker amd64模拟执行不能证明原生x64 VPS实测。模型是本地协议夹具，不是云服务/模型鉴权证据；原生模块库存不等于逐个调用。Windows、真实平台账号、正式签名发布及其他未覆盖矩阵仍保留。

## Required Rework

无。root同步安装/实际状态/验收记录并按既有授权本地提交；无push/发布授权。

---

# Stop Completion and Cross-OS Migration Acceptance

## Result

PASS。新的独立验收者accept_stop_migration完整报告已读取，覆盖跨系统迁移及其发现的共用CLI stop完成判定修复。没有与本轮直接相关的未解决问题；此前三项P6返工PASS及首轮FAIL历史保留如下。

## Spec Coverage

- 连接文件消失或ECONNREFUSED后继续等待实际取得实例锁，取得后再次核对instanceId，finally释放探测锁。保持认证失败拒绝、INSTANCE_CHANGED、启动中无连接等待、ENOENT竞态与STOP_TIMEOUT，不删锁文件、不按PID杀进程。
- 修复位于共用CLI stop层，restart、backup export/restore、update与Desktop/Web维护沿用同一契约；Runtime清理顺序不变，维护核心独立取锁保持。
- 脚本、源代码和实际命令记录证明：Mac运行中默认/加密导出，Linux运行中目标恢复、新增数据后直接导出，返回Mac运行中目标直接恢复，均无先单独stop绕行。
- 源4条消息/3条确认记忆/5条经历，Linux新增后6/4/7；人格、模型路由、会话、消息、记忆来源、日记、时间线、心情与经历逐字段保持。真实DSH返程请求包含Mac历史、Linux新增历史及确认记忆。
- 隔离模型/渠道夹具严格验证Authorization，加密凭据实际可用；默认无Key路径实际401。重新生成token、master key、instanceId和引擎session；插件机器路径、安装状态与权限剥离，存储保留；渠道/计划停用、旧审批不可执行、无自动重放。
- 业务修改仅process.ts及两个直接测试文件，无schema、依赖、认证API或UI改动。最终产物包含修复，旧失败和中间错误产物记录保留，未冒充通过。

## Validation

- Risk Level: S3（共用生命周期与持久维护）。
- 独立读取治理、Spec/Plan、历史验收、Rework、Decision008、交接与实施报告，审阅源码/diff、真实子进程SQLite锁夹具、六个用例、Runtime生命周期及直接调用方。
- 审阅build/p6-stop-rework/evidence.json、三阶段报告、迁移/模型脚本、Linux执行命令、DMG证据及原失败；实际只读核对三个源/测试文件和四个编译资源哈希，与证据一致。
- 审阅实施检查记录：Node构建（含相关类型检查）、三文件ESLint及stop-completion/lifecycle/backup/update四文件19项通过、1项Windows专用跳过。不存在的cli-maintenance.test.ts未计入执行结果。
- 验收者未重复测试、build、lint、typecheck、全归档哈希或未变平台矩阵，未修改文件/Git/index。实施者负责的临时进程、容器、鱼与迁移归档已清理，DMG已卸载。

## Issues

无直接相关未解决问题。最终资源与迁移证据支持本轮结论。

## Regression Risks

stop与下一次维护取锁不是原子交接；随后启动的合法新实例可以导致维护安全拒绝，不可强行覆盖。证据范围为Mac arm64、Linux arm64隔离容器与本地鉴权夹具，不能覆盖Windows/x64/裸机、真实云模型和平台账号、跨schema或正式签名发行。本轮未重演未变的升级回退、systemd或原生UI矩阵。

## Required Rework

无。root同步治理并按既有授权本地提交；无push或发布授权。

---

# P6 First Rework Acceptance (historical)

## Result

PASS。新的独立 accept_p6_rework 完整报告已读取。首轮三项缺陷已修复，未发现直接相关未解决问题；这是本地代码返工验收，不代表Windows实机或完整跨平台发行完成。首轮FAIL历史保留如下。

## Spec Coverage

- 实际Update.download_url在available/download前强制HTTPS，Rust两个分支与HTTP请求0证据支持。
- Policy::none保留，锁定updater2.14.1的客户端配置同样用于下载，下载返回前仍验签，requireSignedVersion=true；离线本地字节验签语义保持。
- maintenance仅backup/onboard读stdin，config直接查询，未知命令在启动前拒绝；大小上限、stdin口令与原备份职责保持。
- Windows拒绝与POSIX算法测试分开，Windows检查health未调用/原程序和鱼不变；公共签名测试无平台跳过，生产保护未删除。
- 最终0.1.0 app/DMG、Mac/Linux portable重建及内置CLI证据完整；说明准确，旧0.1.1明确为返工前历史。
- P6其余主体保持首轮认可结论，不重开未变范围。Windows/正式签名发布等门槛继续开放。

## Validation

Risk Level: S3。

独立读取规定治理、完整两轮实施报告/首轮FAIL/rework/Decision/交接；审阅源码、diff、测试、CI、安装文档及build/p6-rework/evidence.json和四份子证据。只读SHA256核对本轮五个源码/测试文件与证据一致。

审阅实施记录：Vitest4过/Windows专用1跳过，Rust2过，HTTP请求0；这些不是验收者重新执行的测试。最终三种产物configExitCode=0/stdinEndedAtExit=false，CLI hash一致；原生代码段一致性与ad-hoc完整签名文件差异区分。未重复type/lint/build/测试套件/原生升级回退/平台矩阵，未修改文件或Git。

## Issues

无阻塞。修复职责正确，未放宽签名、删除Windows保护或全局跳过测试。

## Regression Risks

Windows MSI/NSIS/实机/远端CI未执行；Mac ad-hoc非正式签名/公证/发布；本轮未重演HTTPS真实下载/redirect但审查保留实现；原生升级回退为返工前候选历史，不混称最终修复版本；跨schema、注销重启和已有外部限制保留。

## Required Rework

无。root按既有授权本地提交P6，排除Decision009/Spec009；不push/发布。

---

# First Acceptance (historical)

## Result

FAIL。新的独立 accept_p6 完整报告已由协调 Agent 读取。主要安装、备份恢复与更新架构符合 Spec，但以下三项直接问题须返工；Windows 实机、正式签名/公证等外部门槛不是本次 FAIL 原因。

## Spec Coverage

| 功能需求 | 验收结论 |
| --- | --- |
| 1 独立Desktop与首次配置 | Mac实施证据支持；资源定位、内置Node、向导/路径隔离符合。Windows门槛保留 |
| 2 生命周期/后台/启动项 | CLI统一启停、认证握手、关闭/托盘/退出与实施记录对应；注销重启未验证 |
| 3 Linux CLI/Headless | portable和服务证据支持；config等待stdin缺陷见问题2 |
| 4 Docker/systemd | 非root/卷/认证健康/用户服务与实际记录符合，不扩展为所有发行版证据 |
| 5 一致选择性备份 | 一致快照、白名单逻辑归档、校验、默认秘密排除与DSH状态隔离符合 |
| 6 加密凭据迁移 | 独立口令/随机盐/scrypt/AES-GCM/新master key及正确错误口令证据支持 |
| 7 恢复与数据保护 | 暂存、表列/外键、固定锁、journal及原数据保留符合 |
| 8 新目录与续聊 | 实际DSH、长历史/连接凭据证据支持；完整历史与上下文预算明确区分 |
| 9 可信更新/回退 | 签名绑定、真实数据预检/旧程序与数据保留符合；HTTP下载缺口见问题1 |
| 10 CI/分平台产物 | Mac/Linux产物/运行证据已记录；Windows测试确定矛盾见问题3 |
| 11 文档 | 安装迁移/人工回退/外部限制充分；config示例须随代码修复恢复可用 |

## Validation

- Risk Level: S3。
- 独立读取全部治理、Spec/Plan/交接/Decision，审阅Runtime maintenance/chat/lifecycle、CLI、Tauri/React、打包、Docker/systemd/CI、测试与文档。
- 读取build/p6-updater-test/evidence.json、Runtime和systemd事件；原生安装/升级/人工回退为已审阅实施证据，未称独立重演。
- 核对锁定tauri-plugin-updater 2.14.1本地源码，确认非HTTPS仅warning后仍GET。
- 仅新增一个最小复现：保持config子进程stdin打开，1.2秒无输出且未创建数据；终止并清理自有临时目录。
- 未重跑已通过type/lint/build/完整测试；未修改任何仓库文件或Git/index，未创建子Agent。

## Issues

1. **P1 在线桌面更新未拒绝HTTP包地址**：`apps/desktop/src-tauri/src/updater.rs:79`得到update后直接download，只验证清单endpoint。锁定官方插件updater.rs:827–835对非HTTPS只warning，随后GET。HTTPS清单可包含HTTP包，违反Spec9/Decision008。签名仍有效，此问题不等于签名绕过。报告可用更新/下载前验证实际包URL，保留Policy::none，并用最小请求计数证明HTTP请求未发出。
2. **P2 config等待终端EOF**：`apps/cli/src/maintenance.ts:21`无条件await readInput，之后才判断无需输入的config；普通终端及默认交互Docker exec均等待Ctrl-D，最小复现发生在启动Runtime前。只在需要JSON的命令分支读取stdin，保留口令不入argv。
3. **P2 Windows portable CI确定失败**：`tests/integration/update.test.ts:77`无平台分支期待UPDATE_NOT_NEWER/HEALTH_FAILED/installed，生产`maintenance/update.ts:215`在win32先抛UPDATE_REQUIRES_WINDOWS_INSTALLER；CI Windows执行npm test，阻止后续产物。按平台契约区分安装算法与Windows明确拒绝，保留跨平台签名测试；不得为测试通过开放Windows portable安装。

## Regression Risks

HTTPS正常更新/无release/签名版本绑定/拒绝重定向；备份与onboard的stdin敏感输入；Windows拒绝安装和签名验证都须保持。Windows实机、正式签名公证/发布、跨schema、注销重启仍开放。

## Required Rework

新实施 Agent 修复三项并做相称定向验证、更新受影响产物与报告，再交新的独立验收。当前不标PASS、不按已完成阶段提交。见rework.md。
