# Spec062：NapCat 源码内置

状态：已完成（隔离 worktree 交付，未应用原工作区）。用户已明确选择“源码纳入仓库，由我们维护”。S3：第三方代码、组件分发、构建与进程启动。

## 目标

将 NapCat 4.18.42 固定源码纳入 BigFatFish 的第三方目录，提供可重复构建入口，托管 QQ 使用这份本地构建产物。修复失效的组件准备来源，并保持扫码、配置、账号范围和 OneBot 行为。不能仅改下载 URL 或留下一份未被应用使用的源码。

## 来源与许可

上游 NapNeko/NapCatQQ 已结束维护；使用归档 XingYunStar/NapCatQQ 的原 commit 9335843246e3b7a17944861f3ac8731a259732c2。原始源码完整保留许可证与版权；不改成 MIT。Limited Redistribution License 禁止商业使用并限制公开修改版。本轮原始源码原样保存，自有构建/适配位于第三方树之外；不能声称获得任意公开维护权。QQ 客户端及上游预编译原生模块与可修改 TypeScript 源码须明确区分。

## 范围

- 原样 vendor 固定源码、锁文件和必要原生资源，记录来源/commit/文件清单或摘要；保留模块边界，不将上游 workspace 变成大肥鱼业务分包。
- 根目录提供本地源码构建与完整性校验入口；真实执行构建，不把成功下载当成构建成功。
- 打包和开发入口能使用本地构建 NapCat；Mac/Linux 保留 Docker 隔离，Windows 保留独立进程树。QQ 客户端/Node 引导资源仍可使用校验后的归档原版，不能继续依赖失效的上游链接。
- 采用归档 Windows 包时保持已有 SHA256 77397ac38d66f46383e48f08f35d5f9d37ec575c22069f62d6c600e73b4521ed。归档 Docker tar 有 amd64/arm64 两份，需要固定来源和各自 SHA；先复用已验证本地镜像，不依赖已下线仓库。
- 本地编译组件必须真正进入安装/启动路径；配置和 QQ 数据仍在用户数据目录，不覆盖用户配置。缺失/校验失败给出明确错误，不静默退回过时远端逻辑。
- 保持现有轻量 CI 边界，不新增自动发布。同步 QQ/上游/工程文档。

## 实施与验证边界

开发在隔离 worktree 完成：/Users/yang/project/BigFatFish-napcat-20261120-s9kv_ghl/workspace。原工作区 /Users/yang/project/BigFatFish 的 tracked 项目文件和 TARGET 保持不变；首次测试曾写入原 node_modules 的 ignored Vitest 缓存，之后已改用独立依赖副本，例外见实施记录，最终交付可应用的完整补丁与实际修改副本。未授权 commit/push。

绑定目标为 apps/runtime/src/channels/managed/platform.ts；四角色固定见事务根 roles.json。修改前记录基线真实行为，使用同一输入运行修改版，再对修改版的独立副本执行 ROLLBACK.sh、同命令复测，确认原始哈希一致。VERIFICATION.txt 记录字面 stdout/stderr/exit，DIFF.patch 能重建修改副本。额外源码和构建记录扩展该事务，不替代四角色。

## 验收标准

- [x] 固定来源的源码可在仓库中维护，原许可、来源和完整性可查。
- [x] 本地真实源码构建完成，Runtime/开发/发行使用该产物。
- [x] 安装/启动、双架构镜像来源及 Windows 归档校验有定向验证；不启动真实 QQ 或发送消息。
- [x] 四角色齐全，BASELINE/MODIFIED/ROLLBACK 同输入实测、回滚 hash 相同；原 tracked 项目文件和 TARGET 未改变，缓存例外已记录。
- [x] 新独立验收完成，Windows 原生/真实账号等未验证范围明确。

## 非目标

不更换 QQ 框架，不改人格/记忆/回复策略，不操作真实账号或数据库，不以 vendoring 宣称腾讯闭源客户端已变成自研实现，不提交或发布。

## 完成记录

真实源码构建与定向验证通过。首次独立验收发现 Git 检出改写 vendor BAT 的 R1，已在根属性边界修复，干净检出的 1111 文件全部一致；[新独立验收 PASS](acceptance-r1.md)。完整补丁已从基线实际重建，最终文档快照的 hash 见事务根 VERIFICATION.txt。未启动真实 QQ、Windows 原生或生成安装包；未 commit/push。
