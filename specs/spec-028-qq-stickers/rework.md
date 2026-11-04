# Rework — R1 图片完整性与看图成功资格

首轮独立验收 /root/accept_qq_stickers FAIL，完整报告已由 root 读取。其隔离复现证明：合法 PNG 头尾/137B 坏压缩流能通过 export/restore；完整解码失败后 send_sticker 仍 queued，segment 仍 image。

## 返工范围
1. 统一上传、恢复/可用库的完整解码与像素约束；无效恢复不能冒充成功或使正常 Runtime 后续才被坏图拖垮。
2. 本轮查看资格以图片工具实际成功呈现为准；DSH attachment 保存/渲染失败时不保留可发送标记。选择与最终发送只使用成功且当前有效的图片。
3. 保持固定目标/账号/记忆/图片revision、网络toggle、普通插件gate与unknown不重放。
4. 若必须将内部 restoreArchive 异步化，完整接住 CLI/Web/测试直接调用者；公开 HTTP/CLI 行为不改变，失败仍在替换用户数据前返回，保持原 journal/锁语义。不做实际用户数据恢复或迁移。

## 验证
S3，但仅本次影响：坏归档/超像素或损坏图片、图片工具呈现失败后选择被拒、成功 DSH 看图→选择→图片发送；归档调用契约改变时运行相关备份恢复检查。Node build 更新 bridge 与相关类型检查；不重复 UI/网络已过边界或无关项目套件。

由新的实施 Agent 返工，完成后新的独立验收 Agent 重验，保留首轮失败历史。不提交/推送，root验收通过后按持续授权本地commit。

## Implementation Report — R1（2026-11-05）

### Summary / Root Cause
首轮问题的根因是两处职责不完整：归档恢复仅验证文件外壳，未复用上传的完整 raster 解码约束；取图成功被误当成 DSH 真正呈现图片成功。现将完整性检查归回表情库，将呈现确认归回 DSH 引擎桥接，不在 QQ send 调用点堆例外或吞错误。

### Files Changed
- `channels/stickers.ts`：`validateStored()` 复用 `validateStickerImage()` 完整解码、边长/像素检查，并继续校验归档字段、数量、字节与总量。
- `maintenance/archive.ts`：内部 `restoreArchive()` 异步化，在原实例锁、staging SQLite 事务内 await 完整校验，全部通过才执行原 journal/目录替换。失败仍清理 staging 并释放锁，不覆盖原数据。
- `web/server.ts`：await 恢复结果后再启动 Runtime 并返回 completed。CLI 的 `maintenanceCommand` 原本为 async 并直接 return restore Promise，已有上层 await，契约自然衔接无需无意义改写。
- `ai/engine.ts`、`dsh.ts`、`dsh-bridge.mjs`：可信图片工具增加内部 `onImageResult` 回调。每次调用生成私有随机 receipt，绑定该 Adapter run/session 和具体结果；只有 DSH attachments.saveImage、结果序列化成功后才确认成功。成功只能消费一次，随后若确认响应异常仍可回传失败撤销；失败确认消费并删除 receipt，未确认结果在 turn cleanup 撤销。receipt 数量有界，不传给模型或普通插件。若桥接既无法确认成功又无法回传撤销，取消 owned turn，不能继续生成后发送。
- `channels/sticker-turn.ts`：execute 不再设置 viewed，呈现回调成功后才按 ID/revision 记录资格；失败删除资格。开始重读同图会清除旧资格，send 与最终 segment 都检查当前成功资格，原目标/账号/记忆/network/revision guard 保持。
- `tests/integration/qq-stickers.test.ts`：恢复调用 await、mock 引擎显式模拟呈现确认；新增坏压缩 PNG/超边长 PNG 归档失败后原数据库字节不变且后续可正常恢复，以及真实 DSH 附件解码失败后选择仍被拒的回归。
- `tests/integration/backup.test.ts`、`plugins.test.ts`：异步恢复调用及拒绝断言；原功能断言保持。
- `tests/integration/web.test.ts`：新增仅 HTTP inject 的真实恢复顺序用例，Runtime restart 读取恢复后的表情，未运行浏览器或 UI。

### Validation
Risk Level: S3，仅 R1 直接影响模块。
- `npm run build:node`：通过，含最终桥接复制。
- `npx tsc -p build/fish-persona/tsconfig.apps.json`：通过。
- 首批定向：`vitest run` qq-stickers / backup / plugins，以 namePattern 选择库/归档兼容、网络回合选择确认、正常真实 DSH+OneBot、最终删除撤回、坏归档、新真实 DSH 呈现失败、选择性恢复、插件实际工具与恢复；8 项通过，5 项未选择，17.37s。
- 首批 pattern 没选中旧完整加密恢复用例，因此仅补跑该项和新增 Web 恢复顺序；2 项通过、4 项未选择，11.94s。两阶段共 10 个唯一用例通过，没有失败后放宽断言，没有重跑已通过的用例。
- 坏图回归覆盖合法头尾但压缩流损坏、4097px 边长超限；两者恢复明确失败，目标数据库原字节保留，之后有效归档可恢复（锁已释放）。
- 真实 DSH 故障注入位于库取图后、attachments.saveImage 前；DSH 原生解码实际失败，get_sticker_image/send_sticker 均 failed，模型请求没有 image data URL 或 queued_for_reply；后续 send 仍拒绝，segment 无图。未确认和晚到失败撤销也覆盖。
- 已检查 restoreArchive 全部源码/测试调用者；CLI Promise 转交、Web await、直接测试 await 完整。未重复 UI、固定源网络传输、其他未影响测试，没有真实 QQ/云模型/用户数据操作或重新打包。
- `git diff --check` 通过。Root 的首轮素材/UI/网络证据保持适用。

### Known Limitations / Remaining Questions
无 R1 已知未解决实现问题，交新的独立验收 Agent 判断。真实账号发图、云模型自然调用和 Windows 发行仍为此前未验证项。未切分支、未 commit/push、未修改 root 的 Spec/Decision/UI 证据。
