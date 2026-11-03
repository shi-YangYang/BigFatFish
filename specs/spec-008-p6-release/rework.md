# P6 首轮返工

## Baseline / Scope

dev e9b080b，P6未提交；accept_p6独立FAIL完整报告在acceptance.md。一个新的实施者串行修复三项，不能重做整个P6或扩张无关模块。Spec009草稿排除。root维护治理与全局阶段文档，实施者仅业务/测试及必要使用文档。

## Required Changes

1. Desktop在线更新在报告可用与下载前验证真实download_url必须HTTPS，拒绝不安全包地址。保持现有Policy::none、签名版本与字节绑定、可信配置、正常HTTPS/无release行为。根因是固定官方updater2.14.1仅对HTTP包warning而非拒绝，不能依赖endpoint约束代替包URL约束。若同一验证适用于离线清单，保持其语义准确：离线读取本地已验签字节不伪装在线下载。
2. CLI maintenanceCommand只在backup/onboard等确需输入的分支读取stdin，config无需EOF即可完成。保留JSON上限与秘密通过stdin的约束；不改为从命令行接收口令。与此同根因的无输入分支一并核对，不扩张其他CLI重构。
3. update.test按平台行为组织：POSIX安装算法测试不对Windows作错误成功期望；Windows有明确拒绝portable更新的检查，签名/manifest等通用校验仍在各平台运行。生产Windows安装保护不删除，不全局跳过文件或CI。

## Validation / Artifacts

S3（更新传输及发布测试），按三项具体影响定向验证。HTTP包需有发起请求之前被拒绝的证据；正常HTTPS/重定向边界复用已存证据并补受影响最小检查。config保持stdin打开真实调用并在不发送EOF时返回结果；备份/onboard输入路径保留必要定向回归。平台测试逻辑静态对应与本机相关测试通过；没有Windows环境不假报实机执行。

按实际受影响源执行定向type/lint/编译；因CLI/Rust改变，重新生成交付Mac app/DMG及Mac/Linux portable，核对新增修复已进入产物并更新公开hash/证据。不机械重演原生0.1.0→1.1→回退、Docker/systemd全矩阵；除非出现具体相关失败，不重测已过未变的备份/审批/浏览器链路。原0.1.1候选是此前实施证据，不要与本轮最终产物混称。

测试资源隔离，不能安装全局测试CA、改系统代理、读取其他应用钥或影响真实鱼。无Git写入/发布/子Agent；普通技术问题自主解决。完整实施报告交root（含根因/职责层、文件、实际命令/结果、最后改动顺序、最终产物及证据限制），随后新独立验收。

## 跨系统迁移补充：停止完成判定

来源为当前9a9de0c产物真实Mac→Linux→Mac验证，非推测。Linux直接backup export返回ALREADY_RUNNING，显式先stop再export可完成。apps/cli/src/process.ts:61连接文件消失即返回、:56连接拒绝即返回；lifecycle.ts先关闭监听/删除连接文件，再db.close与release，故维护可碰到旧实例尚持锁。包括backup export/restore、restart及update调用链的同根因入口。

要求在共用停止契约正确层确认目标实例已释放内核锁后才报停止；保留instanceId变化拒绝、认证失败不可视为成功、启动中/陈旧记录语义和有界等待。不能把删除connection、PID不存在或任意sleep当完成，也不能删除锁文件、提前释放仍需保护的锁或放宽维护独占；不在每个backup/update调用点堆重试。另一个合法新实例抢先启动仍应安全报告变更/争用，不杀新实例、不强行维护。

S3共用生命周期/持久维护。用真实多进程锁/认证接口建立确定性connection删除但锁延迟释放与ECONNREFUSED仍持锁用例；停止返回时应可取得锁，实例更换及认证错误仍拒绝。补实际直接backup export/restore及相同stop路径必要回归，不重跑无关全矩阵。同步受影响Mac/Linux最终资源（无需无关原生代码重编译或重新下载Node/依赖），用保留迁移脚本在修复产物完成直接一体备份的往返证据，不能沿用先stop测试绕行。保留旧失败/旧哈希历史，新产物另记。

业务实施交新Agent串行，root维护治理。若修职责层需合理局部调整可在范围内完成，不改变公开接口或安全契约；重大偏离先报告。新独立验收后本地commit，无push/发布。

完成状态：fix_stop_completion修复共用stop并以真实进程锁覆盖六项边界；四个相关测试文件19项通过、1项Windows专用跳过。当前Mac/Linux产物直接完成无先stop绕行的往返备份恢复。新accept_stop_migration独立PASS已读取并记录acceptance.md，无直接相关未解决问题。合法新实例在stop返回后抢锁仍可导致维护安全拒绝，这是原有独占契约，不承诺跨命令原子交接。
