# NapCat 来源与授权

`napcat/` 原样保存 NapCat 4.18.42 的源码和上游附带资源，来自 [XingYunStar/NapCatQQ 归档](https://github.com/XingYunStar/NapCatQQ/tree/9335843246e3b7a17944861f3ac8731a259732c2)，原项目为 NapNeko/NapCatQQ，固定 commit `9335843246e3b7a17944861f3ac8731a259732c2`。文件清单和逐文件 SHA256 位于 `napcat-source.json`；可运行 `npm run napcat:verify` 核对。

版权与许可证保持原文：根 [Limited Redistribution License](napcat/LICENSE) 限制商业使用及修改版公开发布；[DPAPI](napcat/packages/napcat-dpapi/LICENSE) 和 [WebUI](napcat/packages/napcat-webui-frontend/LICENSE) 保留各自许可证。它们不因纳入本仓库而改为 BigFatFish 的 MIT。使用、修改或再分发前须逐项遵守相关许可；本仓库并未取得额外授权。

TypeScript/JavaScript、WebUI 和内置插件由本地构建。`napcat-native/` 的 `.node`、DLL，以及 shell-loader 的 EXE/DLL 是上游已编译资源，并非本项目从源码编译的原生模块。QQ 客户端与引导 Node 来自校验后的平台归档，也不是自研源码。

自有构建和适配位于 `scripts/` 与 Runtime 中；构建在 `build/napcat-work/` 的副本内进行，不修改此原始树。上游的 workspace 只用于第三方构建，不成为大肥鱼业务分包。构建方式、运行隔离和验证范围见 [QQ 指南](../docs/qq.md#内置组件的固定来源与验证)。

在许可允许的范围内维护或升级源码时，必须同时记录真实来源/版本，并更新 `napcat-source.json` 的文件清单与摘要；未记录的字节改动会被 `napcat:verify` 拒绝。清单、构建脚本和依赖锁变化都会使构建缓存失效。原版版权及各模块许可不能删除，本次保存/构建/适配不表示拥有任意公开发布修改版的权利。
