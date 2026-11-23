# Acceptance R1 — Spec062

## Result

**PASS。** 首轮唯一阻塞 R1 已在正确职责层修复，完整补丁已有成功重建证据。未发现需要进一步业务返工的问题。

本轮是新的独立验收；只审阅代码、已有执行记录和实际交付文件，不修改业务，不重复源码构建、协议测试、typecheck 或 lint。协调者接下来同步完成状态、将本报告纳入最终补丁，属于交付文档收尾，不改变本次业务判断。

## Spec Coverage

| 验收项 | 判断 |
| --- | --- |
| 原样源码、来源、许可和完整性 | 1111 文件及固定来源清单保留；锁文件和公开 WebUI `.env` 均在交付索引。没有修改 NapCat 原始树或伪改摘要。 |
| 干净检出可重复 | 根 `.gitattributes` 最后追加 `third_party/napcat/** -text`，仅关闭 vendor 树的文本转换，不影响自有 BAT 的 CRLF 约定。索引、干净检出和现工作副本均 1111 文件 / 0 差异。 |
| 真实源码构建及平台接入 | 沿用未受 R1 改动影响的真实构建、定向协议和首轮代码审阅证据；`ComponentPlatform.install/start` 仍验证并使用本地产物，缺失产物不静默回退。 |
| 可交付补丁 | 已读取完整 `DIFF.patch`；1137 个文件段，与 `patch-review.json` 一致。实际从基线 archive 应用补丁 exit 0，修改文件摘要/可执行属性及 vendor 摘要均零差异。 |
| 原项目与回退 | 既有最终清单检查原 tracked 727 文件 / 0 变化；本次重新打开 TARGET、修改副本、补丁、验证记录与可执行回退脚本，摘要及字面行为相符。 |
| 限制与授权 | 未把隔离执行称为真实 QQ 或 Windows 实测；没有 commit/push，ignored Vitest 缓存例外明确保留。 |

## Validation

- Risk Level：**S3 中的定点返工验收**。具体风险为仓库文本属性破坏精确来源校验；不是重新扩大检查全部平台。
- 已读项目协作规则、使命、技术栈、网页规则、当前交接、Decision030、Spec062、完整 Plan 及首轮 FAIL 报告。
- 已审阅 `.gitattributes` 实际 diff、`scripts/napcat-source.mjs` 精确摘要机制、绑定的 `platform.ts`、新增组件测试与补丁生成/重建脚本。修复没有关闭校验或改变运行逻辑。
- `r1-source-verification.json`：新隔离索引 force 收录完整上游文件；索引 blob、干净 checkout、当前副本各自的差异数组均为空，包含 lockfile 和公开 `.env`。检出目录内实际执行 `node scripts/napcat-source.mjs`，exit 0，stderr 空，stdout 为：

```text
{"commit":"9335843246e3b7a17944861f3ac8731a259732c2","files":1111,"verified":true}
```

- `patch-review.json`：重建到 `/Users/yang/project/BigFatFish-napcat-20261120-s9kv_ghl/patch-review-reconstructed-zmxwc5va`，1137 改动文件、1111 vendor 文件，`fileHashErrors`、`vendorErrors`、`originalChanges` 均为空。生成脚本确实使用独立 `GIT_INDEX_FILE`，不是原工作区索引。
- 本验收重新读取补丁全文计算 SHA256，结果为 `ea7144a30183fb487ca7fff0c0b8a5dec12740e1038e1d54fe425c64451f89c5`，84482480 字节，与审阅快照相同。该值对应本报告加入前的审阅补丁；最终文档收尾后的摘要由协调者记录，不混称同一版本。
- 读取 `VERIFICATION.txt` 中真实失败与修正记录，包括宿主 Python tarfile 参数不兼容及后续已成功的系统 tar 重建。没有遗漏失败而仅保留成功。

### 固定四角色

四者均在本次验收中重新打开；回退脚本具有执行权限，使用嵌入原始文本恢复指定副本，不依赖外部原仓库。

1. MODIFIED_FILE：`/Users/yang/project/BigFatFish-napcat-20261120-s9kv_ghl/workspace/apps/runtime/src/channels/managed/platform.ts`
2. DIFF_FILE：`/Users/yang/project/BigFatFish-napcat-20261120-s9kv_ghl/DIFF.patch`
3. VERIFICATION：`/Users/yang/project/BigFatFish-napcat-20261120-s9kv_ghl/VERIFICATION.txt`
4. ROLLBACK：`/Users/yang/project/BigFatFish-napcat-20261120-s9kv_ghl/ROLLBACK.sh`

既有同输入 `start isolated managed QQ, no real Docker/account` 的字面行为：

| 角色 | 观察结果 |
| --- | --- |
| BASELINE | 旧镜像 digest；`localShellMounted:false`；`loopback:true`、`configMount:true`；exit 0。 |
| MODIFIED | 隔离夹具的内容寻址 ID `sha256:aaaa…`；`localShellMounted:true`；上述回环和配置边界保持；exit 0。 |
| ROLLBACK | 独立副本恢复旧 digest 和 `localShellMounted:false`；其余边界保持；exit 0。 |

三次 probe 的 stderr 均为空。回退执行本身 exit 0、stdout/stderr 空。恢复摘要 `2c082eecc273aa09cbc27eb7d5656d27d7c03bf793082bfd0cdd863afa979e94` 等于原 TARGET；修改副本仍为 `13cb1a2fd60c80746e4668c61c8fc79d349e7868a4e384bff87a87e7e2c20f5d`。Docker 执行边界使用替身，不代表真实容器启动或 QQ 登录。

## Issues

无未解决阻塞。R1 已关闭；没有借返工更改 vendor 原文、业务逻辑、已有配置或账号范围。

## Regression Risks

- 尚未验证真实 QQ 登录收发、Windows 原生运行、完整发行安装包，以及完整 Docker tar 的实际下载、整体校验和 load。精确归档 metadata/小层及隔离协议证据不能替代这些实机结果。
- Limited Redistribution License 及子目录许可继续适用；纳入源码不等于获得任意商业使用或公开修改版权利。
- 原工作区最初的 ignored `node_modules` Vitest 缓存曾被写入，后续已独立复制依赖；只承诺 tracked 项目文件与 TARGET 未改，不声称整个原目录逐字节不变。
- 既有 `desktop-dev-session.mjs:132` lint 问题未扩展处理，非本次 R1 引入。代码没有重新执行真实账号操作。

## Required Rework

无。协调者仅需更新完成状态、将本报告与最终文档纳入补丁并保留最终重建摘要。按停止规则，不追加已经通过的构建或业务测试。
