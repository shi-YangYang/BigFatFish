# 安装、运行与迁移

## 产物与平台

本地开发可运行 `npm run desktop:build` 生成 macOS `.app`/`.dmg` 或 Windows MSI/NSIS；首次构建需要 Node 24.20.0、Rust 1.90+ 和 Tauri 对应系统构建工具。安装后的用户不需要 Node/npm/Rust。Windows 产物必须在 Windows 原生构建依赖，不能复制 macOS 的 node_modules。

当前本机已生成本地 ad-hoc 签名、未正式签名/公证的 macOS arm64 安装产物，Windows 尚无实机验收。未发布任何正式下载链接。安装器平台签名、公证和更新签名是不同的操作。CI 上传的是构建附件，未自动创建发行版。

`npm run release:prepare` 在 `build/portable` 准备当前系统独立发行目录。Node 24.20.0 来自 nodejs.org 官方发行，固定平台 SHA-256 已写入构建脚本；`NODE-LICENSE`、根 `LICENSE`、`release.json` 中依赖版本/许可清单及各依赖原许可随包携带。生产依赖由根 lockfile 在目标系统重新安装。`node scripts/release-archive.mjs` 生成 `build/artifacts/*.tar.gz` 与校验文件。不要把运行数据放进安装目录。

## 桌面首次运行

macOS 将 `.app` 放入用户 Applications，Windows 运行对应安装器。首次可使用默认数据目录，按需设置鱼的名字、关闭窗口后是否后台运行；之后在「设置 → 模型」填写模型地址、名称及自己的密钥。保存后会选择首个模型作为默认聊天模型。

默认关闭窗口保留 Runtime，菜单栏托盘提供打开、暂停自动活动、退出并停止服务。设置中可以启用/撤销登录启动，默认关闭。已有同数据目录的 Runtime 会复用，停止通过认证接口完成。开机项只管理本应用。

「备份」可选择导出内容，输入完整文件路径后导出、检查和恢复；导出和恢复会停止当前 Runtime，检查不停止服务。操作后从「设置」保存设置可重新启动。「更新」默认显示尚未配置可信更新源，不会访问虚构的发行地址。

## CLI 与 Linux 无界面运行

本地已生成Linux arm64和x64独立归档，分别为`build/artifacts/BigFatFish-0.1.0-linux-arm64.tar.gz`和`build/artifacts/BigFatFish-0.1.0-linux-x64.tar.gz`，旁有SHA256校验文件。选择与目标系统架构一致的包。两者均有非root容器运行证据；x64在arm64 Mac的Docker amd64模拟环境验证，尚无原生x64 VPS实测。当前没有正式发布下载地址。

解压独立发行目录到 `~/.local/opt/bigfatfish`，入口为 `bin/bigfatfish` 和 `bin/bigfatfishd`，二者使用随包 Node，不依赖系统 Node 或开发 shell PATH。Windows portable 入口为对应 `.cmd`。

```sh
~/.local/opt/bigfatfish/bin/bigfatfish start
~/.local/opt/bigfatfish/bin/bigfatfish status --json
~/.local/opt/bigfatfish/bin/bigfatfish doctor
printf '%s' '{"name":"栗子鱼"}' | ~/.local/opt/bigfatfish/bin/bigfatfish onboard
~/.local/opt/bigfatfish/bin/bigfatfish config
~/.local/opt/bigfatfish/bin/bigfatfish stop
```

`onboard` 接受标准输入 JSON，可带 `name` 和完整 `model` 配置（字段见 [模型指南](ai-core.md)）；写入 Runtime 后持久保存。`config` 展示非敏感模型、人格与路由，无需标准输入或按 Ctrl-D。`doctor` 检查真实 Node 和认证 Runtime 状态，服务未运行会返回非零。`bigfatfishd` 为前台进程，接受 SIGTERM 优雅停止。

### systemd

仓库 `infra/systemd/install.sh` 安装用户单元，前提是独立发行已位于上述目录。不要以 root 运行该安装脚本。

```sh
sh infra/systemd/install.sh
systemctl --user status bigfatfish
journalctl --user -u bigfatfish -f
systemctl --user restart bigfatfish
systemctl --user disable --now bigfatfish
rm ~/.config/systemd/user/bigfatfish.service
systemctl --user daemon-reload
```

可在 `~/.config/bigfatfish/service.env` 设置 `BIGFATFISH_DATA_DIR=/绝对路径`，不要在 unit 中硬编码密钥。用户目录需属于运行用户，数据权限默认700/600。服务停止超时45秒，整组子进程由 systemd 管理。VPS 若要退出登录仍运行，需要管理员明确启用该用户的 linger；不自动修改宿主策略。测试环境可使用 `infra/systemd/test.Dockerfile`（先构建 `bigfatfish:p6-local`），该专用容器运行真实 systemd 及用户会话，不能视为所有发行版实机验证。

### Docker Compose

```sh
docker compose -f infra/docker/compose.yaml up -d --build
docker compose -f infra/docker/compose.yaml exec bigfatfish node dist/cli/src/main.js doctor
docker compose -f infra/docker/compose.yaml exec bigfatfish node dist/cli/src/main.js config
docker compose -f infra/docker/compose.yaml stop
```

镜像以 node 用户运行，卷保存 `/home/node/.local/share/bigfatfish`，健康检查调用认证 CLI。管理 API 不发布端口，只能在容器内访问 loopback；需要远程操作时通过 SSH 执行 Docker CLI。重新构建/替换容器保留卷，`down -v` 会删除数据，普通升级不要使用它。导出备份应另起临时容器挂载已停止服务的同一卷，避免 PID1 停止导致 `docker exec backup` 被容器终止。

镜像构建包含 `dist/web`、插件 SDK、示例和三个平台安装产物。默认命令仍只启动 Runtime；HTTPS 控制台须按 [Web 管理说明](developer.md#启用-https-控制台) 显式配置并单独启动网关，Compose 不会自动发布 Web 端口。

## 可选能力依赖

基础聊天所需 DSH/桥接插件/QQ/B站/抖音宿主源码均随包提供。B站画面需要 ffmpeg；抖音需要实际 Chrome/Chromium 和 Python 环境，安装方式见 [B站](bilibili.md) 与 [抖音](douyin.md)。在 GUI 中使用绝对可执行路径，不依赖终端的 nvm/venv。缺失这些依赖只影响相应能力，不应阻止基础聊天。抖音私信、分享、上传仍属于未实现发送协议，不因安装包提供资源而变为可用。

## 备份、恢复与凭据

CLI 接受标准输入 JSON，避免在命令参数和 shell history 中放口令。以下不含秘密的示例使用完整路径：

```sh
printf '%s' '{"file":"/安全位置/fish.bff"}' | bigfatfish backup export
printf '%s' '{"file":"/安全位置/fish.bff"}' | bigfatfish backup inspect
printf '%s' '{"file":"/安全位置/fish.bff"}' | bigfatfish backup restore --data-dir '/新的鱼目录'
bigfatfish start --data-dir '/新的鱼目录'
```

导出会先停止并排空 Runtime，持有不随目录替换移动的 `runtime/instance.sqlite` 独占锁，使用 node:sqlite backup 一致快照，再从白名单表生成逻辑归档。归档有格式/schema版本、固定文件清单、SHA-256；不包含可执行 SQL、SQLite 空闲页、临时桥接凭据、Cookie 文件、日志或旧连接 token/PID。当前逻辑归档支持 schema6，其他 schema 明确拒绝；不推测未知 schema 的兼容性。

`scopes` 可选择 `persona`、`models`、`sessions`、`memories`、`life`、`plugins`，默认全选。选择会话需同时选择人格及模型（外键与历史归属）。模型包含合法默认路由；生活包含日记、经历、观看/活动历史、去重映射和已禁用的计划；会话包含渠道映射与送达历史，未完成外发标记为未知而不重放。审批不迁移。

默认清除模型/平台 secret。加密可给 `password`（12～1024字符），采用独立随机盐、scrypt、AES-256-GCM；`credentials:true` 强制加密，并先用原 master.key 解密，再以归档口令加密，恢复后重新生成 master.key 和本机密文。可迁移模型密钥及 SQLite 平台凭据；浏览器登录状态不迁移。加密归档仍应安全保管。

恢复先验证版本、大小（上限128MiB）、精确逻辑路径、哈希、结构、表列、外键和配置语义，再在暂存目录创建数据库。替换仅移动 `config/data`，锁目录保持原位；原数据保留在 `rollback-<id>`，失败恢复原目录，进程中断的 journal 在下次 Runtime 启动时恢复。连接凭据重新生成；所有渠道禁用，自动活动暂停、计划禁用，旧审批失效，待处理任务中断/未知。

DSH 缓存不原样迁移，避免旧共享记忆和机器路径经隐藏副本返回。完整消息保留在 SQLite；owner 会话首次接续以当前人格、当前授权记忆和最近历史重建 DSH，按模型上下文预算限额，界面显示接续/省略/片段条数，此后正常 resume。外部渠道会话保留可查看记录，但以新授权上下文重新开始，不恢复可能已撤销共享范围的旧助手上下文。

## 更新与失败恢复

CLI portable 更新需 `bigfatfish update trust` 从标准输入接收 `{source,publicKey}`，其中 source 为 HTTPS 签名清单地址，publicKey 为 Ed25519 PEM 公钥。`update check` 实际查询，未配置返回 unconfigured，204/404返回 no-release；离线与下载/签名错误返回失败。`update install` 下载、验签并验证sha256/大小/平台/schema，再安全解包；拒绝软硬链接和路径逃逸，总展开上限2GiB。安装前后使用原数据副本启动候选程序，探测副本禁用渠道和自动活动。

安装过程保留程序与数据，拒绝同版本和降级包；`update rollback` 在停服后恢复二者。回退会作废旧审批、暂停自动活动、禁用平台和计划，防止旧任务再次外发。中断后可从 `.bigfatfish-previous/bin/bigfatfish update rollback --data-dir ...` 执行恢复；若处于 journal 未提交状态，不继续新更新。Windows portable 更新明确拒绝，使用原生安装器。`update install-file` 可从标准输入接收 `{file,manifest}` 安装已下载的包，仍需提前配置同一公钥且严格验签。首次下载到生产更新源前应由用户核对发行者公钥。

桌面使用 Tauri 官方 updater 的 Minisign 公钥与 HTTPS manifest（含目标 `schema` 和支持原数据的 `minSchema`，本阶段实际版本为6），与 portable 的 Ed25519 清单是不同格式。在线清单和实际更新包地址都必须使用 HTTPS，不跟随重定向；不安全的包地址在显示可用更新或下载前拒绝。还可在界面提供本地清单及更新包路径，离线模式直接读取本地字节并验证官方签名及版本绑定，不会访问清单中的下载地址。先在「设置 → 关于 → 软件更新」设置来源和公钥；官方插件验证签名及签名版本后才安装。候选目标 schema 可高于当前6，但最低支持版本不能高于当前数据；声明的 schema 必须与签名包内 metadata 一致。macOS 以原数据副本实际启动验证兼容；本阶段没有虚构新业务 schema，实际升级演练仅验证6→6，未来跨 schema 仍须由候选实际迁移通过。安装前保留原始config/data至 `runtime/desktop-update-snapshot`。安装后保留维护标记，只有新程序自身版本匹配才能清除并启动；安装失败原数据保留。必要时重新安装上一版桌面，然后以其内置CLI执行 `update desktop-rollback` 恢复数据，失败版本数据保留在 `rollback-<id>`；macOS 旧程序实体保留在快照的 `BigFatFish-previous.app`，退出新程序后可用该副本替换安装目录，再执行其内置 CLI 的 `update desktop-rollback`。Windows 实际安装/回退仍未验证。

macOS新程序启动失败时，按以下顺序人工回退（没有后台自动回退守护）：

1. 退出新应用；安装损坏无法退出时，在活动监视器结束本应用，确认其Runtime已停止。
2. 将当前失败的 `.app` 移到另一位置保留，不覆盖旧程序快照。
3. 将数据目录 `runtime/desktop-update-snapshot/BigFatFish-previous.app` 复制回原安装位置，并使用原应用名称。
4. 运行旧应用内 `Contents/Resources/runtime/bin/node`，参数为其 `dist/cli/src/main.js update desktop-rollback --data-dir 数据目录`；再打开旧应用。回退后的新版本数据保留在返回的 `failedData` 目录，旧审批失效、自动活动暂停。

已在本机验证缺少候选内置Node导致启动失败时数据库保持不变，再从保留的旧.app和原数据快照恢复。正式签名/公证与Windows实机验收仍是外部条件。

正式更新发行需要离线保管签名私钥。`scripts/release-archive.mjs` 仅在显式设置 `BFF_RELEASE_PRIVATE_KEY` 和 `BFF_RELEASE_URL` 时生成portable签名清单，不上传、不发布。macOS构建后运行 `node scripts/desktop-update-archive.mjs`，生成只有一层 `.app` 根目录的更新归档与校验文件，明确禁用AppleDouble元数据。然后使用 `npx tauri signer sign -f /安全位置/私钥 --app-version 版本号 更新归档` 签名；清单版本须与实际应用及签名版本一致。Tauri安装器/更新包使用其官方signer；未提供正式钥时只交付本地未签名产物。不要提交临时私钥、测试信任配置或真实账号凭据。

卸载程序不会自动删除用户数据。重新安装或更换安装目录后仍使用原数据目录；跨机器迁移用逻辑备份。保留的回滚目录和更新快照可能含原始秘密，只在确认恢复/升级稳定后由用户清理。

## P7 Web 与插件资源

发行目录现在包含Web前端、三个平台的独立安装产物、普通SDK源码及独立示例。远程管理默认关闭，认证HTTPS部署、网关单独启停、恢复后插件重新授权及外部目录开发步骤见 [开发与Web管理](developer.md)。schema继续为6，保留P6归档格式；认证会话与Web配置不进入逻辑备份。
