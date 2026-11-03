# Acceptance

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
