# Decision：原版 QQ 组件由大肥鱼管理

## Context
用户要求内置 NapCat 和图形化配置，减少 QQ 页面的手填参数。NapCat 使用受限许可；官方 macOS 安装器会修改系统 QQ 并共用账号数据。

## Decision
- 用户明确选择管理原版 NapCat，由大肥鱼实现界面和适配，不修改或公开发布其源码。
- 用户明确选择 Mac/Linux 通过 Docker 独立运行，Windows 适配独立原生组件。首次使用按需安装固定官方产物，不更改日常 QQ 和系统安全设置。
- 地址/端口/凭据自动管理，机器人账号在登录后自动读取；主人与允许群仍需明确授权。保留已有外部 OneBot 服务入口。
- 生命周期归属 Runtime，Desktop/Web 共用认证 API。此决策更新 Decision005 中「仅外部独立安装」的限制，其身份、记忆、审批和未知发送结果规则不变。

## Reason
用户获得应用内准备、扫码和配置体验，同时隔离上游组件、日常 QQ 数据和本项目核心权限逻辑。

## Alternatives
不使用修改版源码、不直接套用 NapCat Desktop，不执行修改系统 QQ 的 macOS 安装流程。

## Consequences
Mac/Linux 需要可用的本机 Docker；Windows 独立组件需适配原生启动。上游原版仍受自己的许可证约束，不归入大肥鱼 MIT。未完成真实账号或 Windows 验证时明确记录，不能以模拟协议通过代替。
