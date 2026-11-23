# Acceptance — Spec062

## Result

**FAIL — R1：Git 检出会改写第三方原始字节，阻断完整性校验与可重复构建。**

本次为独立验收，只审阅业务实现与已有执行证据；未修改业务、第三方源码、原工作区，未重复已通过的测试或构建。

## Spec Coverage

| 验收项 | 结果 |
| --- | --- |
| 固定来源、原许可、完整清单与锁文件 | 当前文件和临时索引符合；但检出后 9 个 BAT 字节变化，未通过可交付性要求。 |
| 真实源码构建与开发/发行接入 | 已有真实构建成功证据；`desktop:dev`、`release:prepare` 调用本地构建，Runtime 加载本地产物。独立 CLI 额外构建步骤已写入 README。 |
| 安装/启动与平台边界 | 定向证据支持：缺失/损坏产物拒绝、Docker 不可变 ID/只读挂载、双架构固定归档、校验失败不 load、归属拒绝、Windows bootstrap 导入与父目录链接拒绝。并非容器或 Windows 原生端到端验证。 |
| 四角色与事务 | BASELINE/MODIFIED/ROLLBACK 行为及恢复 hash 已记录；完整 DIFF 因 R1 暂停生成，故尚未完成。原 tracked 文件最终清单校验仍由协调者收尾。 |
| 独立验收与限制说明 | 本报告完成独立判断；真实 QQ、Windows 原生及完整 Docker tar 下载/load 均明确未验证。 |

## Validation

- Risk Level: **S3**，涉及第三方源码、构建、分发、进程启动与路径安全。
- 已读 `.ai/AGENTS.md`、使命/技术栈、网页规则、当前交接、Spec062、Plan 内 Implementation Report、Decision030，以及实际业务 diff、构建脚本、7 项新增组件测试和相关上游入口。
- 审阅既有日志：`build-napcat-current.log`（WebUI 3317、shell 1699、插件 37 modules，exit 0）、`build-node-fixed.log`（exit 0）、`typecheck-final.log` / `lint-napcat-fixed.log`（exit 0）。
- 审阅既有定向回归：`tests-napcat.log` 为 3 files / 12 passed；补父目录与真实 bootstrap 反例后的 `tests-napcat-fixed.log` 为 1 file / 7 passed。两次结果有重叠，不相加统计。
- 源码与编译产物职责分离：原始树在 `third_party/napcat`，构建在忽略的副本内执行；frozen lock 与禁用生命周期脚本保留。原 `.node` / DLL / EXE 为上游预编译资源，未冒称本机原生编译。
- Docker 精确归档 metadata、实际 loader 和 entrypoint 证据已审阅：loader 导入 `/app/napcat/napcat.mjs`；本地 shell/chunk/worker/native/static/依赖挂载到该路径。入口不会在本地 `napcat.mjs` 已存在时复制旧程序覆盖；只读 chown 失败不因 `set -e` 退出。当前产物文件 0644/UID 501、目录 0755，启动参数传递本机 UID；这是代码及文件权限审阅，不是 Docker 启动实测。
- Windows 夹具使用原始 `napcat-develop/index.js` 真实导入本地 shell，未替换 QQ/Node bootstrap；`NAPCAT_WORKDIR` / `NAPCAT_QQ_DATA_DIR` 与上游路径实现一致，保留用户 `work/` / `qq/`。
- 本验收新增操作仅为只读检查并写本报告；无全仓测试、build 或 lint 重跑。

所有日志与下列证据位于 `/Users/yang/project/BigFatFish-napcat-20261120-s9kv_ghl/`。

## Issues

### R1 / P1 — 根换行属性破坏原样 vendor 与干净检出后的构建

`.gitattributes` 当前含 `* text=auto eol=lf` 和 `*.bat text eol=crlf`，未对 `third_party/napcat/**` 排除文本规范化。源码清单按原始字节校验，但正常 Git 检出会把 9 个上游 BAT 改为 CRLF。

协调者已实际执行：

```text
git checkout-index --all --prefix /Users/yang/project/BigFatFish-napcat-20261120-s9kv_ghl/index-checkout/
exit: 0
stdout: empty
stderr: empty
```

本验收重新打开的 `index-source-comparison.json` 显示 `files: 1111, different: []`；`checkout-source-comparison.json` 显示同样 1111 文件、9 个 difference，包括 `packages/napcat-develop/napcat.bat` 与 shell-loader 的启动 BAT。也就是说，索引 blob 正确不足以证明交付正确。干净检出的文件不再匹配 `napcat-source.json`，`verifySource()` 的精确摘要比较会拒绝，进而阻断 `build:napcat` 与自动依赖它的开发/发行入口。

不要修改原 vendor 文件或把清单改为 CRLF 来掩盖问题。需要在自有根 `.gitattributes` 为 vendor 树设置明确的 `-text` 原字节边界。

## Regression Risks

- Limited Redistribution License 的商业/公开修改版限制仍生效；本次只保存、构建和适配，不构成额外授权或公开发布批准。
- Docker daemon 未启动，完整 tar 未下载校验/load；Range metadata 与校验通过的精确小层不能替代整包校验。真实 QQ / Windows 原生 / 完整发行包均未实测。
- 原工作区曾因首次共享 `node_modules` 被 Vitest 写入 ignored 缓存，已在 Plan/VERIFICATION 说明；不能声称原目录所有字节均未改变。协调者已同步 Spec/Decision/交接为 tracked 项目文件与 TARGET 的保留承诺并注明缓存例外；最终 hash 证据仍须完成。
- 旧 `desktop-dev-session.mjs:132` lint 失败属于既有问题，未扩大修改范围。

## Required Rework

1. 仅在自有根 `.gitattributes` 修复第三方树文本转换边界，保留原始 NapCat 字节、许可证与摘要，不改业务逻辑。
2. 用新临时索引与干净 checkout 复验 1111 个文件：索引和检出均须与原始清单零差异，锁文件和公开 `.env` 必须在交付中。只复验这一具体风险，不重跑源码构建或既有协议测试。
3. 完成全量 binary DIFF 与重建比较，补齐最终原 tracked 文件 hash 证据；如实保留已发生的 ignored 缓存例外。随后由新独立验收者复验 R1。

固定四角色本次重新打开情况：

- MODIFIED_FILE：`/Users/yang/project/BigFatFish-napcat-20261120-s9kv_ghl/workspace/apps/runtime/src/channels/managed/platform.ts`，已读。
- DIFF_FILE：`/Users/yang/project/BigFatFish-napcat-20261120-s9kv_ghl/DIFF.patch`，R1 阻塞下尚未生成，不能声称齐全。
- VERIFICATION：`/Users/yang/project/BigFatFish-napcat-20261120-s9kv_ghl/VERIFICATION.txt`，已读。
- ROLLBACK：`/Users/yang/project/BigFatFish-napcat-20261120-s9kv_ghl/ROLLBACK.sh`，已读，具可执行权限。

既有同输入字面证据：BASELINE 为旧 digest、`localShellMounted:false`；MODIFIED 为 `sha256:aaaa…` 的隔离夹具 ID、`localShellMounted:true`；ROLLBACK 恢复旧 digest、`localShellMounted:false`。三者 `loopback:true`、`configMount:true`、exit 0。恢复 SHA256 为 `2c082eecc273aa09cbc27eb7d5656d27d7c03bf793082bfd0cdd863afa979e94`，等于原 TARGET；修改副本最终 SHA256 为 `13cb1a2fd60c80746e4668c61c8fc79d349e7868a4e384bff87a87e7e2c20f5d`。不把 Docker 边界替身解释为真实 QQ 启动。

未 commit/push；原工作区没有本验收写入，返工仍只在同一隔离副本进行。
