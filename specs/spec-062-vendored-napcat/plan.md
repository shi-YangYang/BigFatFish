# Spec062 Plan

单实施 Agent 串行完成来源固定、构建与 Runtime 接入及事务回归，新的独立 Agent 验收。协调者维护规格、事务角色和交付，不在原工作区直接落地。必要验证限源码构建、组件/构建脚本、托管 QQ 与事务；不重跑全仓测试。

实施报告在本文件追加，记录实际命令、退出码、源码与二进制边界、未验范围。第一次 baseline 必须在修改绑定 platform.ts 前执行。

## Implementation Report（2026-11-20）

### Summary

在隔离 worktree 完成 NapCat 原始源码保存、真实本地构建和托管 QQ 接入。根因是旧上游 release / DockerHub 来源失效且本项目此前没有可维护的底层源码；修复职责位于第三方构建和组件平台层，没有更改 QQ 身份、消息、记忆或回复策略。

- `third_party/napcat/` 保存固定 commit 的 1111 文件、145545156 字节；原许可及多模块边界保留。逐文件 SHA 位于 `third_party/napcat-source.json`。上游 `.gitignore` 会忽略其已跟踪的 lockfile；完整交付必须包含 `pnpm-lock.yaml` 与公开 `.env`，协调者构建临时索引时使用 force add。
- `scripts/build-napcat.mjs` 在隔离副本安装 frozen lock 依赖，禁用所有安装生命周期脚本，依次真实编译 WebUI、shell、内置插件。锁定 pnpm 9.15.9 与生产 express 5.1.0 / ws 8.18.3；构建和依赖锁在第三方树之外。原生 `.node`/DLL/EXE 仅复制上游预编译资源。
- `ComponentPlatform.install/start` 验证本地产物；Mac/Linux 先复用可信旧 digest，否则完整 SHA 校验归档后 load，派生精确 Image ID，启动禁止 pull。将本地 shell、生成的 JS chunks、WebUI、native、生产依赖只读挂载进真实 loader 路径。归属检查仍要求实例标签、根目录及精确镜像，不接受任意 tag。
- Windows 保留原始校验和、受限解包、Job Object。覆盖独立 bootstrap 的 `napcat/` 程序目录；`qq/`、`work/` 不变。父目录 symlink/junction 在任何覆盖前拒绝。
- `prepareNode` 和发行准备自动构建/复制；`test:platform` 只追加 7 项无下载的组件夹具检查，不构建整个 QQ。缺失/损坏本地产物明确报错，没有旧远端 shell 回退。

### Files Changed

- 新增：`third_party/napcat/**`、`third_party/napcat-source.json`、`third_party/NAPCAT-NOTICE.md`。
- 新增：`scripts/napcat-source.mjs`、`scripts/build-napcat.mjs`、`scripts/napcat-tools/{package.json,package-lock.json}`、`scripts/napcat-runtime/{package.json,package-lock.json}`。
- 修改：`apps/runtime/src/channels/managed/platform.ts`、`service.ts`；`apps/desktop/src/features/connections/qq/QQConnection.tsx`（明确缺失本地产物提示）。
- 修改：`package.json`、`scripts/desktop-dev-session.mjs`、`eslint.config.js`（vendor 原始代码排除）；新增 `tests/integration/vendored-napcat.test.ts`。
- 更新：`README.md`、`docs/qq.md`、`docs/upstreams.md`、`constitution/tech-stack.md`。规格、交接及决策由协调者维护。

### Validation

Risk Level: **S3**，仅执行此组件/构建边界相关验证，没有运行全仓业务测试或完整桌面安装包。

证据根目录：`/Users/yang/project/BigFatFish-napcat-20261120-s9kv_ghl/`。

| 实际命令/行为 | 结果 |
| --- | --- |
| `node scripts/napcat-source.mjs` | exit 0；1111 原始文件摘要一致。 |
| `node scripts/build-napcat.mjs --copy-runtime` | exit 0；WebUI、1699 modules shell、37 modules builtin plugin 真实构建；shell 3344922 字节。首次日志 `build-napcat.log`；补充 Buffer 显式导入后因构建指纹改变重建，最终 `build-napcat-current.log` exit 0。 |
| `npm run build:node` | exit 0；父目录安全修复后更新编译 `build-node-fixed.log` exit 0。 |
| `node node_modules/vitest/vitest.mjs run tests/integration/vendored-napcat.test.ts tests/integration/managed-qq.test.ts tests/integration/managed-qq-http.test.ts` | 3 files / 12 passed，49.51s，exit 0；真实假 Docker 子进程捕获参数，既有托管协议回归通过。 |
| `node node_modules/vitest/vitest.mjs run tests/integration/vendored-napcat.test.ts` | 父目录反例与真实上游 Windows index.js import 夹具新增后，7 passed / 692ms / exit 0；未重跑未受影响的旧协议文件。 |
| `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` | 首次 exit 2（新测试 mock 的 never 类型），仅修类型后通过；最终 `typecheck-final.log` exit 0。 |
| 定向 ESLint（platform、service、两个新构建脚本、vendored 测试） | 最终 exit 0，`lint-napcat-fixed.log`。首次还检查了 desktop-dev-session.mjs，旧第132行 preserve-caught-error 规则失败保留；未修改无关代码。 |
| `git diff --check` | exit 0。 |
| 事务同一 probe / 同输入 | BASELINE：旧 digest、无本地 shell mount；MODIFIED：内容寻址 ID、有本地 shell mount；ROLLBACK：旧 digest、无 mount。三者回环端口及配置 mount 保持。均 exit 0；字面 stdout/stderr 与命令在 `VERIFICATION.txt`。 |
| 执行 `ROLLBACK.sh` 到独立修改副本 | exit 0，恢复 SHA256 `2c082eecc273aa09cbc27eb7d5656d27d7c03bf793082bfd0cdd863afa979e94` 等于原文件；最终修改副本 SHA256 `13cb1a2fd60c80746e4668c61c8fc79d349e7868a4e384bff87a87e7e2c20f5d` 保持新行为。 |

安装脚本审计保存于 `install-script-audit.json`：98 项依赖生命周期记录均未执行；只运行审阅过的 Vite 构建命令。Docker 入口与 loader 的精确归档层、hash 及 Range 读取证据由协调者保存在 `docker-image-metadata.json`、`image-entrypoint.sh`、`image-loadNapCat.js`。

### Known Limitations / Boundaries

- 没有启动 Docker daemon、真实 QQ、Windows 原生进程树、用户账号或发送消息。Docker 参数和 Windows loader 布局是隔离执行，不是真机端到端结果；未生成完整发行安装包。
- 未完成整份 Docker tar 的实际下载/SHA/load。可选 arm64 慢下载已主动终止（exit143），其 153MB 部分文件仅保留为 `build/downloads/napcat-docker-v4.18.42-arm64.tar.partial`，不可当作有效安装缓存。源码归档与真实编译已完成。没有遗留本人创建的下载/clone后台进程。
- 首次使用原 node_modules 的符号链接时，Vitest 写入原工作区 `node_modules/.vite/vitest/.../results.json` 和 `.vitest-cache` 等生成缓存；**不能声称原目录每个缓存字节未变**。随后换成 worktree 内 APFS clone；原 tracked 源码没有修改。协调者仍须以基线清单确认并明确此边界。
- Limited Redistribution License 并未变成 MIT；本次只接管保存、构建、适配，不授予任意商业或公开修改版权利。后续许可允许的源码维护须同步真实来源和摘要清单，未登记改动会被完整性检查拒绝。
- 独立验收及全量 binary diff 重建由新的验收者/协调者完成。没有 commit/push 授权，未提交或推送。

### Remaining Questions

没有新的产品决策问题；以上实机与分发许可边界保留，交付待独立验收。

## R1 Implementation Report（2026-11-20）

- **根因与修改**：根 `.gitattributes` 的 BAT CRLF 规则改写了 9 个原样 vendor 文件，导致干净检出不再符合源码摘要。只在根属性末尾加入 `third_party/napcat/** -text`，在 Git 转换职责层保留整个固定第三方树的原始字节；原 NapCat 文件、清单、业务及构建脚本均未改。
- **验证范围**：S3 交付完整性中的定点返工，仅新临时索引和干净检出；未重跑既有源码构建、协议测试、typecheck 或 lint。
- **实际结果**：全新外部索引 force 收录 1111 个 vendor 文件（含 `pnpm-lock.yaml` 和公开 WebUI `.env`）；索引 blob、干净 checkout 和现工作副本分别与原清单逐项 SHA256 比较，均 1111 / 0 差异。干净 checkout 内 `node scripts/napcat-source.mjs` exit 0，stdout 为 `{"commit":"9335843246e3b7a17944861f3ac8731a259732c2","files":1111,"verified":true}`，stderr 空。属性 diff 检查 exit 0。
- **证据**：`/Users/yang/project/BigFatFish-napcat-20261120-s9kv_ghl/r1-source-verification.json` 保存命令、字面 stdout/stderr、退出码、临时索引与 checkout 路径；事务 `VERIFICATION.txt` 已追加。协调者原 `patch.index` 未动。
- **边界与待办**：只修改自有 `.gitattributes` 与本 Plan，未改原工作区、分支、真实账号，未 commit/push。固定四角色不变，ComponentPlatform 旧有 BASELINE/MODIFIED/ROLLBACK 证据继续有效。全量 binary DIFF 重建和新独立验收由协调者接续；本返工不冒称全任务验收通过。

## 协调收尾

已完整读取全部实施与两轮独立验收报告；R1 已关闭，无待返工。完整补丁曾从基线重建 1137 个改动文件并逐项比较摘要/可执行属性，零差异；本段及最终验收加入后再生成最终交付快照，结果统一见事务根 `patch-final.json` 与 `VERIFICATION.txt`。原 tracked 727 文件与 TARGET 未改，依赖缓存例外保持如实记录。代码在隔离 worktree 中完成，尚未应用到原开发目录或启用用户实例；未 commit/push。满足停止条件，不追加业务验证。
