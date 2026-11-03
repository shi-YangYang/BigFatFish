# Plan 008: P6 发布与迁移

基线：dev e9b080b。P5最后本地代码验收PASS与完整报告已处理并提交，未来Spec009不混入P6。采用Decision008；用户无Windows环境、未授权push/发行，其他实施持续。

## 实施顺序

1. 前序业务验收后梳理真实Runtime/插件资源与各平台依赖，制定实际产物清单。
   包括P4的ffmpeg与固定whale资源、P5的浏览器/Python/MCP依赖；桌面从图形界面启动时PATH不同，需明确发现/配置方式，不能依赖开发终端或/tmp测试工具。
   已发现具体打包衔接项：P5 browser.ts的asset()固定../../../../路径，在dist/runtime/src/douyin下仍指向仓库根plugins/services，而copy-runtime-assets将文件复制到dist/plugins与dist/services。仓库内运行可掩盖此差异；P6须统一实际产物资源解析，像既有QQ/B站分别识别构建资源与开发源码，避免打包多份资源掩盖错误。隔离安装验收必须不含仓库根plugins/services。
2. 一致备份、校验/加密、暂存恢复/回滚与跨目录迁移，先验证数据保护。
   实施采用一致SQLite快照后的白名单逻辑归档；恢复向当前schema写入验证过的结构化行，不执行归档内SQL。DSH引擎存储不跨机器复制，agent_sessions重建；主人首次续聊从当前人格/已选择记忆及角色化的近期消息重建上下文，随后正常持久resume。窗口直接从最新已完成历史按当前模型预算选取，排除本次请求，明确呈现接续范围；长会话不应仅因总条数超过窗口而无法继续。外部受众不重放旧助手上下文，继续优先共享记忆撤销保护，历史仍保留可查看。验证既包含实际DSH请求中的已选历史，也包含被排除内容/旧授权/绝对路径不经隐藏副本回流。数据库完整记录与有预算的模型上下文区分呈现，不静默丢弃归档选择的聊天数据。
3. Desktop内置运行资源、首次向导、后台/托盘/开机启动；Linux CLI安装和Headless。
   当前固定 DSH SDK 的 launch 使用 process.execPath；嵌入 Node 后仍须从脱离源码仓库的安装目录、受限 GUI PATH 实跑 DSH，验证它与插件资源解析完整。备份的 data/engine 含会话存储及临时 profile，不能全目录原样打包：选择性导出须与 SQLite 会话/agent_sessions 一致，排除临时桥接凭据和宿主绝对路径；恢复后真实续聊验证，不能只核对表计数。
   安装产物包含Node与实际生产依赖的版本/校验/许可清单；独立安装测试不挂源码dist/node_modules，也不靠全局node或开发终端PATH。已有CLI start用process.execPath启动Runtime、DSH SDK同样用process.execPath，可复用该入口与单实例/认证ready握手，避免Rust另复制一套Runtime规则。桌面默认关闭窗口保持后台，退出/停止与托盘状态须明确；开机启动是用户可撤销的选项，测试只清理本应用实例。
   当前宿主Node为nvm的v24.20.0 darwin/arm64，otool -L只列系统库；此证据仅属于宿主文件。打包脚本仍需固定分发来源/版本/校验和许可证，并在各目标检查动态库依赖，不能假设任意开发者的Homebrew或自编Node可直接复制成独立产物。宿主全局Node配置不作任务性修改。
4. Docker/Compose持久卷与systemd实际服务路径、健康和生命周期。
5. 可信更新检查/安装/回退、CI产物及文档；签名与发布仅在有授权时执行。
6. 各可用系统真实安装和迁移验证，缺失平台逐项标记，交独立验收。

## 已核对的发布与备份接口（2026-11-03，规划证据）

- 当前tauri.conf.json的bundle.active为false，desktop:build传--no-bundle；现有macOS release编译证据不等于安装包。依[Tauri sidecar文档](https://v2.tauri.app/develop/sidecar/)配置外部可执行文件时，文件名须带目标triple；跨架构不能直接复用宿主二进制。
- [Tauri资源文档](https://v2.tauri.app/develop/resources/)区分目录映射与glob复制行为。嵌入Node依赖/固定插件源码时保持目录层级与ESM解析，原生依赖须在对应目标安装/构建，不从macOS把node_modules整份当Windows/Linux产物。产品资源按实际resource_dir定位，用户数据仍在独立目录。
- 本地@types/node24.10.1/sqlite.d.ts已有backup(DatabaseSync,path,options):Promise<number>；[Node24 SQLite文档](https://nodejs.org/docs/latest-v24.x/api/sqlite.html#sqlitebackupsource-db-path-options)有对应原生备份API。使用一致数据库快照而非复制运行中主文件；对快照清除默认排除的secret、失效运行状态与敏感文件引用，并让可读日记从该快照恢复，防止导出在不同时间点混合数据。
- 默认排除敏感数据时，不能只DELETE行后仍把SQLite空闲页中的旧内容归档；应生成净化数据库或实际清除残留，并用唯一marker核对原始备份字节。用户选择导出范围须同时约束结构化表与DSH会话/可读副本，不能靠另一份历史副本带回已排除内容。
- 恢复不重放已发送/未知社交动作，旧pending/approved审批失效；调度与自动平台动作默认暂停等待重新授权，连接token/PID/锁重建。包含凭据的加密恢复也不自动授予新机器外发权限；这些是迁移语义，需要在预览及实际状态中准确呈现。
- [Tauri Updater](https://v2.tauri.app/plugin/updater/)要求签名验证，可静态JSON或更新服务，公钥可通过Rust配置。正式信任钥/发布源尚未配置，开发验证用独立测试钥和隔离产物，不能把测试私钥提交或成为产品默认信任。安装器签名、公证与更新包校验分别记录。
- 实施固定tauri-plugin-updater 2.14.1。已核对该版Cargo源码：macOS成功安装后旧bundle随临时目录清理，不能据此宣称首次启动失败可回退；产品需额外保留真实旧.app与数据快照。restore_update用于恢复本地清单，但UpdaterBuilder仍要求非空有效endpoint；离线验证复用用户显式保存的HTTPS信任配置，不伪造在线发行。候选schema兼容按签名声明的minSchema范围与真实数据副本预启动判断；当前实际升级成功证据仍属schema6，不宣称跨schema实测。
- 版本回退需与schema迁移一致：更新前停止新任务并保留一致快照，安装/首次启动失败时验证旧程序和数据仍可恢复；不能只换回旧二进制却留下它无法读取的新schema。实际选定Tauri插件版本及Rust最低版本须相符，不凭最新版文档或当前宿主编译成功宣称旧编译器兼容。
- 托盘需要[Tauri tray-icon能力](https://v2.tauri.app/learn/system-tray/)，开机启动可采用[官方autostart插件](https://v2.tauri.app/plugin/autostart/)。只控制BigFatFish自身入口，默认不修改用户开机项；测试显式启用后应恢复本任务设置，不影响其他LaunchAgent或服务。

## 验证范围

S3：发布流程、可执行更新、数据库备份恢复、系统服务。使用隔离数据与临时安装位置；必须验证失败保留原数据，不能只有成功快照。Docker需要真实持久卷重启；systemd需要实际systemd环境，单纯解析unit不是运行通过。桌面直接cargo编译不能替代正式CLI/安装器路径。

实施期间协调阅读发现的具体项，最终验收需核对修订结果：

- 备份白名单包含与所选范围对应的model_routes、已完成观看/任务及请求去重记录，不能只保留活动摘要；计划停用，旧待发/在途操作失效，不重放未知外发。恢复模型/插件配置须遵守原入口的语义约束。
- 主人续聊窗口直接查询最新已完成记录，排除本次request_id，不能先取最早10000条再截取；完整长历史仍保存，有限上下文范围可见，不因总历史超过100条直接禁止续聊。外部会话继续遵守共享记忆撤销边界。
- 更新安装根须为真实独立发行目录，不能把源码仓库替换掉；Desktop首次选择数据目录及维护前也须拒绝数据位于安装包/资源内，含符号链接别名，避免修改签名包或被更新覆盖。已验签字节与实际解包绑定，拒绝软硬链接/路径逃逸/超大展开。
- 旧目录移走、新目录就位及健康确认的各步骤须可恢复；不能仅在两个rename均完成后才设置回退标志。检查实际旧数据兼容，不以空库启动替代；程序和数据回滚均有明确操作与证据。
- 更新测试中`bin/node='old'/'new'`配health回调属于算法回归证据，另需真实portable CLI及原生桌面更新产物的安装/重启证据。元数据声称0.1.1不等同实际安装版本已变化。Windows、签名公证/正式发行不由隔离测试覆盖。

## 风险与授权

打包漏资源、平台路径、后台重复进程、错误schema、归档逃逸、凭据不可迁移、更新供应链与中断回滚。用户每阶段本地commit授权不包含push/release/签名服务；只在具体产物已准备后请求缺少的必要外部授权，不重复请求已有授权。

## Implementation Report

### Summary / Files Changed

implement_p6完整报告已由root读取。P6业务文件冻结，待新独立验收；未操作Git/index，dev基线e9b080b。

- Runtime：maintenance/archive.ts、maintenance/update.ts、ai/chat.ts、lifecycle.ts、douyin/browser.ts。
- CLI：maintenance.ts、update.ts、main.ts。
- Desktop：Rust desktop.rs/updater.rs/main.rs及Cargo/Tauri配置，React Setup.tsx/App/api。
- Packaging：prepare-release.mjs、release-archive.mjs、desktop-update-archive.mjs、smoke-installed-update.mjs。
- Docker/Compose/systemd用户单元、安装脚本/测试镜像、CI及根依赖清单；backup.test.ts、update.test.ts、Rust管理客户端初始化回归。
- 使用文档docs/install-and-migrate.md。治理与全局阶段文档由root维护，Spec009未混入本阶段。

### Important Decisions / 实际问题与修复

一致SQLite快照后白名单逻辑归档，不带活WAL/空闲页/连接token/DSH隐藏历史；凭据强制独立口令加密，恢复新master key。按范围保留模型路由、任务/去重及渠道历史，审批失效、渠道和计划禁用、活动暂停；未完成工作中断或未知，不重放。完整消息保留，主人近期上下文有预算及省略提示；外部受众沿用共享撤销保护。

锁目录固定，恢复/更新有journal，未完成更新阻止普通启动。Portable的Ed25519清单与Desktop官方Minisign/签名版本绑定分开；默认无更新源。签名候选允许前向schema但必须真实数据副本预检，实际仅验证6→6。macOS保留旧.app与数据，首次启动失败后采用显式人工回退。

原生演练定位并修复：

1. updater引入reqwest/rustls-no-provider；管理Client先于UpdaterBuilder创建时panic，导致异步JS无响应。应用入口统一安装同一ring provider；最小Rust回归先复现panic、后通过，临时诊断删除。CSP/同步异步模型未因早期假设修改。
2. 默认Quit没有可靠走停服，改为本应用退出菜单/快捷键并与托盘统一CLI；实际退出后Runtime停止。
3. WebView window.confirm不显示确认且取消操作，P6恢复/更新改应用内确认区，同时中文呈现结果与错误。
4. tar链接与拒绝链接规则冲突，生产归档解引用；Mac AppleDouble误识别.app，预检要求唯一真实.app根目录，生产打包器COPYFILE_DISABLE=1，未放宽安全解包。

### Validation

Risk Level: S3。主要命令：

```sh
npm run typecheck
npm run lint
npm run build:node
npx vitest run tests/integration/backup.test.ts tests/integration/update.test.ts
npx vitest run tests/integration/backup.test.ts -t 'keeps interrupted'
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml management_client_can_initialize_before_first_update_check
npm run release:prepare
node scripts/smoke-installed-update.mjs
node scripts/release-archive.mjs
node scripts/desktop-update-archive.mjs
git diff --check
```

原生在apps/desktop执行实际Tauri CLI：`../../node_modules/.bin/tauri build --bundles app,dmg`；候选使用`../../node_modules/.bin/tauri build --bundles app --config '{"version":"0.1.1"}'`，不是仅修改更新JSON。官方signer以临时钥和`--app-version 0.1.1`签名。

| 路径 | 实际证据 |
| --- | --- |
| 备份/新目录恢复 | 真实DSH聊天→默认无密钥及加密含凭据归档→新目录恢复→真实DSH接续；本机token重建 |
| 长历史 | 10003条历史采用最新100，显示省略9903；当前消息不重复 |
| 拒绝与保留 | 错误口令、路径、schema、非法模型配置拒绝且原数据保持；journal阻止未完成维护启动，回退作废审批并暂停 |
| 实际portable | 脱离仓库的完整产物、内置Node、PATH=/usr/bin:/bin，0.1.0→0.1.1→0.1.0、重启并保持同一鱼；不是仅old/new占位文件回归 |
| Mac安装/操作 | 实际挂载校验DMG并复制~/Applications；向导/模型/DSH、关闭窗口后台、显式退出停服、启动项UI开启及撤销 |
| 原生恢复 | 导出→应用内确认恢复→启动→原会话DSH回复，显示接续最近2条/省略0 |
| 原生升级 | 签名及版本验证→原数据副本预检→安装→重启，新进程package_info实际0.1.1，同一鱼和原会话继续回复 |
| 失败及人工回退 | 测试副本移走Node，界面报告安装不完整，数据库SHA256不变；用快照旧.app及其CLI回退，GUI实际0.1.0且已连接；4条原消息恢复，失败版本6条另存failedData，活动暂停 |
| 路径边界 | 首次向导和维护均拒绝.app内部数据目录的符号链接别名 |
| Linux portable | 官方Linux Node24随包，node用户、受限PATH真实start/doctor/stop |
| Docker/Compose | 非root、认证健康、人格卷持久化；Compose up --build --wait为Healthy，restart后人格保持 |
| systemd | 专用容器真实PID1及user manager，enable --now/restart/认证访问/stop；运行PID519，停止inactive；非仅解析unit |

Linux实际入口：`docker build -f infra/docker/Dockerfile -t bigfatfish:p6-local .`、`docker run --rm bigfatfish:p6-local node scripts/smoke.mjs`；Compose使用独立project bff-p6-check执行up --build --wait、exec doctor --json、restart、down -v。systemd环境由infra/systemd/test.Dockerfile构建，实际操作用户服务。

失败记录保留：回退测试曾遗漏审批新增列，改明确列名后定向通过；早期lifecycle 8例中并发启动遇12秒超时，另7例通过，隔离重跑该失败例通过，未称首次全绿；AppleDouble预检失败保留旧程序/数据，修复后新生产归档实际安装成功。已通过且无变化检查不需重复。

### Last Modification Order

回退暂停/审批失效/journal保护并相关回归 → 中文/确认/TLS修复 → 最后业务修改为原生归档根目录校验 → typecheck/lint/Node build通过 → 最终0.1.0 app/DMG及Mac/Linux portable → 同源码实际0.1.1候选、生产归档/签名、原生升级/续聊/失败启动/人工回退 → 交付app与portable元数据回到0.1.0 → 文档与清理。之后无业务修改。

### Artifacts / Evidence

基于仓库根的实际路径：

- apps/desktop/src-tauri/target/release/bundle/dmg/BigFatFish_0.1.0_aarch64.dmg（root已核对存在，约193MiB）。
- build/artifacts/BigFatFish-0.1.0.app。
- build/artifacts/BigFatFish-0.1.0-darwin-arm64.tar.gz、BigFatFish-0.1.0-linux-arm64.tar.gz。
- build/artifacts/BigFatFish-0.1.0-darwin-arm64.app.tar.gz、真实测试候选BigFatFish-0.1.1-darwin-arm64.app.tar.gz；相邻sha256，测试候选.sig/清单/公钥保留，私钥删除。
- build/p6-updater-test/evidence.json（root已读取，明确implementation checks而非独立验收）、runtime-events.jsonl、systemd-runtime-events.jsonl。
- 保留生产镜像bigfatfish:p6-local，digest sha256:d2fef71c316237754b74112a844a882ff5dcdd0b7093d5025d1b1c6716f623aa。

### Cleanup / Known Limitations

实施者已清理任务应用/Runtime/fixture、鱼数据及回退副本、临时私钥/诊断、测试信任及桌面配置。核对不存在：~/Applications/BigFatFish P6.app、~/Library/LaunchAgents/BigFatFish.plist、~/Library/Application Support/org.bigfatfish.desktop/{desktop,updater}.json及/private/tmp/bff-p6-*。自有Docker/Compose/systemd容器、命名卷和核实归属的匿名卷已清理；仅保留交付镜像/产物/公开证据，未改全局Node/代理/用户真实鱼或无关Docker资源。

Windows未生成/运行MSI/NSIS，CI未执行；Mac ad-hoc不是正式签名/公证；未注销/重启用户电脑，启动项证据仅真实创建与撤销；systemd为真实容器服务，不代表所有发行版；跨schema未实测；正式更新源、平台账号、云Key未提供。无push/发布，无待决定的新产品问题。新独立验收决定PASS/FAIL。

## First Rework Implementation Report

rework_p6完整报告已读取，三项返工及受影响产物完成，业务冻结，等待新的独立验收。无Git/index/分支操作，无P7业务修改。

### Summary / Files / Root Causes

- updater.rs新增prepare_online_update，在返回available或调用download前验证真实Update.download_url必须HTTPS；固定官方2.14.1只warning是根因。保留Policy::none、官方验签/版本绑定，离线仍校验本地字节，不访问下载URL。
- maintenance.ts仅backup/onboard读stdin JSON；config直接查询，未知命令在启动Runtime前拒绝。保留64KiB上限与口令stdin约束。根因是分支判断前无条件等待EOF。
- update.test.ts公共签名单列，POSIX算法与Windows明确拒绝分开；Windows检查原程序/鱼不变，不改生产保护。
- Cargo.toml只增加dev依赖Tauri test feature用于mock Runtime，未升级，本轮Cargo.lock未变；新增maintenance-cli.test.ts，安装指南同步说明。

### Validation

S3。`npm run build:node`、定向eslint（maintenance.ts、update.test.ts、maintenance-cli.test.ts）、`npx vitest run tests/integration/maintenance-cli.test.ts tests/integration/update.test.ts`通过，4 passed/Windows专用1 skipped；Rust `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml updater::tests -- --nocapture`最终2 passed；diff检查通过。

真实插件解析Update的HTTP包分别检查available/install准备路径均UPDATE_HTTPS_REQUIRED，loopback请求数0；HTTPS available及minSchema拒绝保持。CLI真子进程stdin保持打开仍返回，onboard/加密backup export/inspect/错误口令/大小上限通过。未改no-release/redirect路径，未重复原联网更新矩阵。

`npm run release:prepare`、Tauri `--bundles app,dmg`、release-archive/desktop-update-archive重建最终Mac产物；官方Node24.20.0容器内同脚本生成Linux arm64。DMG挂载复制及codesign --verify --deep --strict通过。受限PATH=/usr/bin:/bin，stdin不结束：DMG内置CLI3552ms、Mac portable2931ms、Linux node用户423ms，均exit0/stdinEnded=false。三处maintenance.js与当前dist同hash：306a4e629a0c3706fd7e7a3fde19055719af8f1d75641107473f4b00c6075a1f。

最终app、DMG内程序与Cargo release输出的__TEXT/__text与__TEXT/__cstring一致；完整二进制因ad-hoc签名不同未误判代码差异。更新归档内二进制/CLI一致。

实际失败：Rust首轮mock缺updater配置，补测试上下文后2过，未改生产信任；Linux在Mac bind mount输出cpSync EACCES，改容器内部目录后同源码/脚本完成，未改业务或全局权限。

### Artifacts / Order / Limits

最终0.1.0路径与SHA256：

| 产物 | SHA256 |
| --- | --- |
| build/artifacts/BigFatFish-0.1.0-darwin-arm64.tar.gz | d25121dbd2a8cb264001280871d499f3ac668adcd454659b95347e029020f68b |
| build/artifacts/BigFatFish-0.1.0-linux-arm64.tar.gz | fdd9dbee67ae0c3094ab4b264859c99884c06129afe03d9a1dfff4b4b81f91cd |
| build/artifacts/BigFatFish-0.1.0-darwin-arm64.app.tar.gz | 20247c36d490b53680417c05b8c1a043bb586f676bd9dffbf5dc8544c303d77d |
| apps/desktop/src-tauri/target/release/bundle/dmg/BigFatFish_0.1.0_aarch64.dmg | 54ea92dd4f69dd40099a9e1204c7f9f37d14ef0b05e2060fb0f750cdefe4793f |

独立app仍在build/artifacts/BigFatFish-0.1.0.app。公开证据build/p6-rework/evidence.json及evidence/{mac-app-cli,mac-portable-cli,linux-portable-cli,mac-executable}.json；可复用check-installed-cli.mjs无秘密。旧build/p6-updater-test/evidence.json将旧hash移历史字段，原生演练明确为返工前证据。**0.1.1签名候选未修改，属于历史证据、不含最终修复**。

最终顺序：三项源码/测试/使用文档→Node定向检查→Rust fixture/格式/定向检查→最终Mac/Linux资源和产物→实际产物/字节核对→证据/清理，无后续业务改动。已卸载任务DMG、清理自有Runtime/鱼、Mac解压副本/Linux暂存/构建容器；未改全局CA/代理/Node/其他应用/真实鱼。未重演完整矩阵、原生升级回退或Docker/systemd全流程；Windows/正式签名公证发布/真实云账号/跨schema/注销重启限制保留。
