# Task Handoff

当前结果：accept_p6_rework完整PASS已由root读取并写入Spec008 acceptance；三项返工闭环，无运行中子任务。root同步阶段记录并按既有授权本地提交P6，排除未来Decision009/Spec009；不重建验收、不重复已过检查。提交后进入P7，届时重写交接。以下保留刚完成的验收上下文。

## Role / Goal

Acceptance / Rework，EXISTING。新的独立验收者检查 P6 三项返工：Desktop HTTP包地址、CLI config等待stdin、Windows portable测试契约。acceptance.md保留首轮完整FAIL；Plan末尾First Rework为新完整报告，rework.md定义目标，全部必读。只读审查，不改任何文件/Git/index/分支，不创建子Agent。根业务已重新冻结，root维护治理；下文原阶段上下文继续有效，聚焦三项修复及直接影响，不机械重审未变全部模块。

## Required Reads / Context

按 AGENTS.md 顺序读 constitution/mission.md、tech-stack.md、全部 .ai/rules；再读 Spec008 spec/plan（Implementation Report 为完整报告）、Decision008、本交接及相关源码/diff/测试。README、IMPLEMENTATION_STATUS、安装指南用于核对用户可见说明。单根 npm 清单与普通模块，禁止新增 packages/workspaces；治理与源码位置保持。

当前 dev HEAD e9b080b（P5 已通过新独立验收且本地提交），P6 工作区包含新增未跟踪代码/文档，index 空。Spec009 为未来 P7 草稿，排除本阶段。root 只维护治理文档，前轮业务已冻结；当前仅按 rework.md 开放三项返工。用户明确每阶段本地 commit，root 验收后执行；无 push/PR/merge/发行授权。远端状态只依据旧缓存，未重新核实，不推断云端状态。

## Scope / Review Focus

对照 Spec008 全部要求及 Plan008 核对实现与证据。重点是：一致快照与选择范围；默认秘密排除/可迁移加密；恢复与更新的独占锁、journal、中断及失败保留；恢复后权限失效/活动暂停且不重放；真实数据兼容预检；签名与实际解包字节/版本绑定；安装与数据目录隔离；真正内置 Node 的独立产物与资源定位；桌面生命周期/确认/后台；Linux 部署；文档真实准确。

实际范围含 Runtime maintenance、chat/lifecycle/douyin资源路径；CLI maintenance/update/main；Tauri desktop/updater/main及资源/依赖；React Setup/App/api；release脚本、Docker/Compose/systemd/CI；backup/update测试和Rust回归。逐文件详情见Plan008报告。不得把假设性风险当缺陷，疑点须落到具体调用/失败路径或最小复现。

## Evidence / Validation

S3（持久数据、构建、签名更新）。独立判断不等于重跑实施者已通过的完整检查；先读源代码、diff、测试及已留存运行证据，仅对具体未解决疑点执行最小检查。禁止为提高主观信心重复 type/lint/build/全套测试。根业务最后修改为原生归档根检查，随后 type/lint/Node build、最终原生构建和真实升级/回退完成；此后仅文档和清理。

完整命令、先失败后修复过程、最终顺序及真实/未验证边界均见Plan008 Implementation Report。核心留存：build/p6-updater-test/evidence.json、runtime-events.jsonl、systemd-runtime-events.jsonl；真实app和Mac/Linux portable在build/artifacts/，DMG在apps/desktop/src-tauri/target/release/bundle/dmg/BigFatFish_0.1.0_aarch64.dmg。不要递归列出build/artifacts中整个node_modules，使用明确文件或顶层清单。

证据重点：真实DSH跨目录恢复续聊、10003历史最新100/省略9903/当前不重复；actual portable受限PATH的0.1.0→0.1.1→0.1.0；实际原生Mac安装/关闭后台/退出停服/启动项创建撤销；同源码候选实际package_info 0.1.1升级后续聊；缺Node失败DB hash保持；保存旧.app人工回退后GUI0.1.0，4条原消息恢复/失败6条另存；Docker持久卷、真实systemd用户服务生命周期。不要把algorithm dummy old/new文件测试当这些实际产物证据。

## External Limits / Authorization

用户已说明没有Windows机或VM、先继续其他工作；Mac已解锁，P6原生操作完成。Windows MSI/NSIS与CI未运行；Mac仅ad-hoc，无正式签名公证/发布；启动项开启撤销已测，未注销/重启；schema6→6已测，非跨schema；systemd为真实Linux容器，非全部发行版/VPS。正式更新源/云Key/平台账号未提供。代码验收与这些开放的产品交付门槛分别记录，不能将无环境写成通过，也不要仅因已获用户接受的外部门槛阻止其他工作。

测试只用隔离临时资源，不操作真实鱼/其他软件的密钥和配置，不修改系统代理/全局Node/无关服务。P6先前任务实例/临时信任/私钥/数据与容器已清理，保留产物和公开证据；如确需复现，创建并清理本次自有资源。

## Expected Output

返回独立 Acceptance Report：PASS/FAIL、三项覆盖/具体证据、Risk S3与实际审阅/检查、问题/风险/返工。先读源码/测试/留存证据，仅具体疑点新增最小检查，不重复已通过未变检查。新build/p6-rework/evidence.json及其子证据对应最终0.1.0，旧0.1.1候选仅历史不含返工；不能混称。报告后等待root处理，不自行继续P7。
