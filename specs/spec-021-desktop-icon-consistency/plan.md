# Plan

## 范围与顺序
1. 核实当前 ICNS 与 PNG 及 Tauri 开发图标选择，确认用户认可的现有图像。
2. 在原生图标来源/平台配置层统一 macOS 开发和 bundle 图标，保留其他平台与页面资源。
3. 定向检查资源透明边界和来源；只在实际改变原生生成链时运行必要的编译/开发启动，不运行业务全套测试。
4. 新独立 Agent 检查规格、diff、资源与实际证据；协调者汇总并本地 commit，不 push。

## 风险与验证
按局部图标资源 S1；开发模式直接嵌入 ICNS，协调者通过一次实际开发启动确认嵌入生效，不运行完整业务检查。现有 ICNS 实际为满幅方形，直接提取系统渲染的正确圆角图标并替换 ICNS；临时 bundle 的文件图标导出用于检查双重内缩风险。原生 UI 验证由协调者负责，实施 Agent 不操作用户桌面和原有进程。

## Implementation Report

### Summary / Root Cause
实施 Agent：`/root/implement_icon_consistency`，2026-11-04。原生图标资源层修复，保留角色与所有运行逻辑。

锁定的 `tauri-codegen 2.7.4/src/context.rs:228` 在 macOS 开发模式优先读取配置中的 ICNS；`tauri 2.12.5/src/app.rs:2731` 将其通过 `NSImage` 直接设置为 application icon。原源文件、debug App 和 release App 的 ICNS 字节相同，SHA-256 均为 `b10cd0d717b773e1874093b0e9e2bb2cff1c9ff1c848fce76ec583e4a529ba43`，实际解出的图像为铺满画布的方形，不是 PNG 被错误选中。macOS 26.4 的系统文件图标处理给现有 bundle 加上了用户认可的圆角、边距和高光；开发模式直接设置原始图像，因此表现不同。[Apple WWDC25 官方说明](https://developer.apple.com/videos/play/wwdc2025/220/) 也描述了既有 Mac 图标的自动形状适配。

### Files Changed / Important Decisions
- 新增 `apps/desktop/src-tauri/icons/macos-icon.png`：通过 `NSWorkspace.shared.icon(forFile:)` 从用户认可的现有 debug App 导出 1024×1024 系统图像，未裁切或重绘角色。保持透明边缘、圆角和现有高光，作为固定 macOS 源图，避免依赖用户机器是否自动修饰图标。
- 更新同目录 `icon.icns`，只从上述 PNG 重新编码。开发和 bundle 继续引用同一文件，无须新增覆盖配置、原生依赖或启动脚本。
- 保留全部通用 PNG、ICO、页面头像、产品标识和原生生命周期；不将 macOS 已内缩的源图用于其他平台。

首次系统图像导出使用 `NSWorkspace` 读取现有 debug bundle 的绝对路径，`NSBitmapImageRep` 按 1024×1024 RGBA 输出；临时脚本与图像留在 `build/icon-consistency/`。固定源图已入库，后续重新生成无需再次调用系统或构建 App：

```bash
npx --no-install tauri icon apps/desktop/src-tauri/icons/macos-icon.png --output build/macos-icons
cp build/macos-icons/icon.icns apps/desktop/src-tauri/icons/icon.icns
```

只复制 ICNS；该命令的其他平台输出不用于覆盖既有素材。新增 PNG SHA-256：`cbda6e79429cb855f14933001d40d297f9152a2bfbde04d36fb2fb147335af94`；ICNS：`1a87f8523ae5e1f0ee3d4576f35a5ab9310a9b4cf10a887e324d902474ac1c1d`。

### Validation
- Risk Level：S1，局部原生图标资源。实施者未运行业务测试、typecheck、lint 或完整构建。
- 目视已解出的旧 ICNS 为满幅方形，系统导出图与用户参考一致。旧 512px 图四角 alpha=255、可见范围覆盖整幅；新 1024px 图四角 alpha=0，alpha>127 的可见主体边界为 `[100,100,923,923]`（含端点），边距约 9.8%。
- 在忽略的 `build/icon-consistency/BigFatFishCandidate.app` 放入现有 Info.plist、原生可执行文件与新 ICNS，仅由 `NSWorkspace` 读取文件图标，未运行应用。再次导出的边界与新源图完全相同：alpha>127 为 `[100,100,923,923]`，alpha>0（含阴影）为 `[67,76,956,963]`；两图目视一致，没有二次缩小。初次缺少 executable 的临时 bundle 出现系统禁止标记，补齐原有 executable 后重新读取得到上述有效证据；未改正式 bundle。
- 证据：`build/icon-consistency/{macos-icon,candidate-system-icon,icns-512}.png`、`geometry.jsonl`；图标编码命令成功，diff 检查通过。
- 协调者一次实际 `npm run desktop:dev -- --no-watch --config '{"identifier":"org.bigfatfish.iconcheck"}'` 通过：临时 identifier 与 `BIGFATFISH_DATA_DIR=$PWD/build/icon-consistency/dev-data` 隔离用户设置；Vite 正常启动，Cargo dev 编译 18.44 秒完成，可执行文件实际运行（PID43371）。`dev-launch.log`、`dev-evidence.json` 记录新 ICNS 全部 1,587,263 字节在该开发可执行文件偏移 14,367,091 处匹配，结合已核实的 Tauri 图标加载路径确认新图嵌入生效。验证后停止自己启动的开发命令。
- CUA 可读取原 debug App，但无法绑定 Dock 或未打包的开发可执行文件；未获得实际 dev Dock 截图，不把资产图或编译通过描述为已完成 Dock 目视。资源直接匹配、实际启动及临时 bundle 的系统渲染共同覆盖本次局部资源修复；无须重复业务测试或发行构建。

### Known Limitations / Remaining Questions
无实施待确认项。旧安装包未自动替换，本轮未重打 DMG；未来正常开发编译/打包会读入新 ICNS。Windows/Linux 素材未变，不扩展实机验证。系统缓存未清理，用户数据与原有 Runtime 未触碰。
