# Acceptance

## Result
PASS

最终结论来自下方 R1 新独立复验；首轮 FAIL 记录保留作历史，不代表当前状态。

## 首轮验收历史（FAIL）

### Result
FAIL

独立验收：`/root/accept_qq_stickers`，2026-11-05。实施者为 `/root/implement_qq_stickers`；未修改业务代码、未执行 Git 写操作。

### Spec Coverage
- 本地库、三张内置素材、上传/启停/删除和认证图片 API：代码符合正常使用路径；根 Agent 的三张 UI 证据已实际目视，桌面与 380px 窄屏没有明显错位或溢出，标签简洁且沿用 beUI。
- QQ 内部回合工具与原插件权限分离；固定目标、单张选择、最终账号/目标/记忆/图片 revision 检查，以及 unknown 不重放：代码和现有定向用例支持。
- 梗鲸固定目录/CDN、关键词候选、实际图片内容、网络开关与有界传输：正常路径符合；只读公网下载证据来自实施报告与 root，不视作真实 QQ/云模型验证。
- DSH 原生 image block 正常链路有真实本地模型协议用例，普通插件不能透传 resultKind 提权。
- schema 7、表情/开关备份、schema 6 兼容：正常归档路径已覆盖；坏图恢复和失败看图资格存在 R1，未满足图片有效性及「实际看过后再选」边界。
- 本地 commit 属于 root 后续已授权操作；验收失败期间不提交完成声明。

### Validation
- Risk Level: S3（图片工具信任、外发授权、增量 schema 与恢复边界）。
- Evidence Reviewed / Checks Performed:
  - 阅读 AGENTS、mission、tech-stack、web-design、Spec028、Plan 实施报告、Decision017、当前交接与 Git 状态；当前为 dev，工作区改动归本轮，未覆盖既有修改。
  - 审阅新增表情库/网络/回合模块、ChatService/DSH bridge、插件工具字段白名单、QQ send guard、路由、schema/归档、前端与资源复制差异。
  - 审阅 `qq-stickers.test.ts`、`sticker-network.test.ts` 和相关插件边界新增用例；实施报告记录 20 个唯一相关测试分阶段通过、Node 构建/apps-only 类型通过。本验收没有机械重跑这些检查。
  - 实际查看 `build/qq-stickers/01-desktop.png`、`02-narrow-add.png`、`03-narrow-grid.png`，与 root 的隔离 UI 操作/尺寸记录一致；没有重新操作真实用户窗口或后台。
  - 仅新增一个针对具体疑点的隔离 Node 复现：临时数据目录和 SQLite，使用当前 dist 模块；制造合法头尾但压缩数据损坏的 137-byte PNG，放入表情归档，经真实 exportArchive/restoreArchive，再调用本轮工具。结束后临时目录已清除。未修改测试或业务文件。
  - 复现输出：`corrupt_archive_restored true`；完整解码 `INVALID_STICKER_IMAGE`；随后 `send_after_failed_decode { status: 'queued_for_reply', id: 'corrupt' }`；`outbound_segment image`。

### Issues
#### R1 — 恢复坏图后，看图失败仍可以选择发送（P2）
`apps/runtime/src/channels/stickers.ts` 的 `validateStored()` 仅校验 base64、头尾、体积和字段，没有执行上传入口使用的完整 raster 解码/像素检查。因此恢复会接受损坏 PNG，也不能保证恢复库仍满足上传时的图像约束。

`apps/runtime/src/channels/sticker-turn.ts` 的本地 `get_sticker_image` 分支在返回图片字节时已写入 `viewed`，而实际 DSH `attachments.saveImage` 的完整解码发生在下游 `apps/runtime/src/ai/dsh-bridge.mjs`。若解码失败，模型收到的是工具失败，`viewed` 却不会撤销。后续 `send_sticker` 只检查该标记和 revision，仍可暂存原始坏图，最终 segment 也只做既有头尾校验。这违反 Spec 的「查看工具必须真实提供图片」「工具失败不能留下发送资格」要求，也可能把坏附件发给 QQ 导致整条回复失败或 unknown。

复现已经证明这一行为，不是仅凭假设提出的防御性扩展；没有实际外发 QQ 消息。

### Regression Risks
- 修复需在图片完整性/看图成功边界恢复一致约束，保持 final QQ guard 与既有 unknown 语义；不要只在某个调用点吞掉坏图错误或伪造看图成功。
- 如采用异步归档验证，须同步检查相关恢复调用契约；如保持同步恢复接口，也应在可承担该校验的职责层阻止无效图片取得可发送资格。无需为此泛化媒体体系或重写维护架构。
- 云模型自然选图、真实 QQ 发图、Windows 发行仍未验证；这些既有范围限制不构成本次 R1 的替代证据。

### Required Rework
1. 统一恢复库与正常加入库的实际图片有效性约束，确保坏图/超像素图不成为可用表情；失败时保留清晰错误，不能静默接受。
2. 图片工具实际呈现失败时不得留下「本轮已查看」资格；选择/最终发送应依赖成功且仍有效的图像结果。
3. 增加一个针对坏归档和失败看图后再次选择的最小回归；复用正常 DSH 看图→选择→发送用例确认成功路径。仅重跑受修改影响的检查；UI 与未影响的网络传输用例无需重复。
4. root 按 AGENTS 安排新的实施 Agent 返工，再由新的独立验收 Agent 重验。

## R1 独立复验（2026-11-05）

验收 Agent：`/root/accept_qq_sticker_integrity`，独立于初轮实施、初轮验收和 R1 实施 Agent。本轮仅修改此验收记录，未修改业务代码、未执行 Git 写操作。

### Result
PASS

### Spec Coverage
- R1 图片完整性：`validateStored()` 现在复用上传的 `validateStickerImage()`，完整解码、边长/像素、格式、单图字节与库总量约束一致。坏图片不能通过恢复进入可用库。
- R1 失败资格：`get_sticker_image.execute` 仅返回待呈现结果，不授予 viewed。DSH 附件保存和结果序列化成功后，通过私有 receipt 确认，才按 ID/revision 授予本轮资格；失败、未确认、晚到失败均不能保留有效发送资格。
- receipt 与 Adapter 单次运行、session、工具和具体结果绑定，不进入模型或插件 manifest；成功只确认一次，失败删除 receipt，未确认项由 cleanup 撤销。若确认/撤销都无法传输，bridge 取消 owned turn，generation 不会以成功状态继续发送。
- 选择与最终 QQ send guard 仍复核 viewed/revision、取消、网络开关、账号、目标和记忆范围；普通插件仅使用显式元数据字段，不能自行获得图片工具能力。原有 unknown 不重放和固定当前收件人的行为保持。
- `restoreArchive` 的异步校验仍在原实例锁和 staging SQLite 内，全部成功后才写 journal/替换目录；失败清理 staging、释放锁且保留原数据。CLI 既有 async Promise 转交与上层 await 完整；Web 已等待恢复完成后再启动 Runtime。
- 首轮其余 Spec028 范围的实现、测试和 UI 证据仍适用；R1 没有修改 UI/网络来源实现，不重新把这些范围当作待验证事项。Spec 的实际 QQ/云模型验证限制仍保留。

### Validation
- Risk Level: S3；仅复查 R1 直接影响的图片工具和恢复边界。
- Evidence Reviewed / Checks Performed:
  - 读取当前 AGENTS、mission、tech-stack、全部有效 `.ai/rules`、Spec028/Plan/首轮 FAIL/完整 R1 实施报告、Decision017、当前 handoff 与 Git 状态；dev 工作区为本任务改动。
  - 独立审阅 `dsh.ts`、`dsh-bridge.mjs`、`engine.ts`、`sticker-turn.ts`、`stickers.ts`、归档恢复及 Web/CLI 调用链，核对 receipt 资格的授予/失败/清理和最终发送守卫。
  - 搜索 `apps` 与 `tests` 全部 `restoreArchive` 调用者，核对 Promise 被等待或正确转交，未发现遗留同步调用。
  - 独立审阅新增回归的真实断言：坏压缩流及 4097px 图片恢复拒绝、目标 SQLite 原字节不变且后续有效恢复成功；真实 DSH `attachments.saveImage` 失败后 get/send 均失败、无模型图片 data URL/queued_for_reply、后续选择仍拒绝；未确认与晚到失败撤销；正常 DSH+OneBot 图片路径；Web 恢复完成后读取新表情。
  - R1 实施报告记录 10 个唯一相关用例分两阶段通过、Node build/apps-only 类型/diff 通过；本验收基于独立代码/断言检查和这些已有结果作判断，没有机械重跑检查，也没有执行新的测试、build、typecheck、UI 或公网请求。
  - 首轮 root 与独立验收已实际目视三张隔离 UI 图，R1 未改变界面。本轮仅审阅相关记录，没有冒称重新操作用户桌面或真实账号。

### Issues
无本轮直接相关的未解决阻塞；首轮 R1 已关闭。

### Regression Risks
- 云模型实际工具调用习惯、真实 QQ 发图、Windows 发行仍未验证；本地 fixture 和代码验收不能代替这些外部事实。
- 网络图库可用性和内容依赖第三方，已有超时/关闭机制；这不是本轮恢复与资格修复的缺陷。
- 内部恢复函数现在为 Promise；当前源码调用链已匹配，后续新增调用者须等待恢复结束再读取或启动 Runtime。

### Required Rework
无。交 root 完成已授权的本地提交；不需要追加无关检查或重复已通过验证。
