# Task Handoff

## Current State

完整P0–P7 Goal仍未全达成。P7原实现、首轮三项返工和新独立复验PASS已本地提交92e9764；其后Docker遗漏Web资源F4已由新实施及新accept_linux_p7独立PASS，root已处理所有报告并收尾提交。当前没有运行中或未处理的子Agent任务。只从实际Git与下列明确剩余条件继续，不重复已过检查。

## Git / Authorization

默认dev。P6 a0e8f61，P7 92e9764；F4最新提交从git log读取，避免为记录自身hash改写提交。用户持续授权每阶段本地commit；无push/PR/merge/正式签名发布授权，远端/PR未刷新核实。不强推或改写历史。

## Evidence / Artifacts

Spec009 Plan/Acceptance/Rework保存两轮P7及F4完整报告。最终Mac app/DMG在apps/desktop/src-tauri/target/release/bundle/{macos,dmg}，build/portable是Mac。build/p7-evidence/rework-final-artifacts.json，DMG sha ef637212287c318a6f0c6dacd29d6fbe427825040c2e73c5283a9931ae57d3de。

最终Linux/arm64归档build/p7-linux/BigFatFish-0.1.0-linux-arm64.tar.gz，sha65bb7de29e911fa0aa4261772e8940d69bf69ce8188c63605f5ad0359225a37b；本地镜像bigfatfish:p7-linux-local，ID7cb15adf9a7944e3303cd4f574d0c34931c90fe8e970bab918b795fed1ab2cbc。linux-artifacts/image/portable/commands.json记录真实UID1000/network=none、SDK/DSH工具/TLS管理及清理。没有重新覆盖Linux x64/裸机/公有VPS。Mac原生已实跑；所有模型/音频为受控fixture，不是云效果。

## Remaining Conditions / Pending User Input

用户明确暂无Windows，先继续其他开发；Mac已解锁，相关原生验证已完成。Windows构建/安装、真实云模型与QQ/B站/抖音账号、正式签名公证/公开发行尚无证据。P5私信/分享/投稿wire未从固定来源可靠确认，仍拒绝提交，是未完成实现；需授权登录环境核对实际协议，不能只用夹具编造支持。

root在本轮发出异步缺项问题：是否已有配置模型/平台的BigFatFish数据目录，只需目录与服务名，不要在聊天发送密钥/Cookie。截至F4收尾尚未收到回复；没有授权读取其他应用凭据或随机选择用户数据。收到配置目录后按对应范围验证，不能推测现成登录/密钥。

## Goal / Stop Boundary

当前可独立执行的已发现缺陷与Mac/Linux新增交付已完成；等待上述外部环境/用户输入。完整Goal不能mark complete。外部等待审计从本轮作为第1个实际无可推进条件回合记录；只有同一阻塞连续3个Goal回合且仍无法有意义推进时才mark blocked，不能提前或反复重复已过测试。未授权push/发布本身不授权执行。

## Constraints

单根npm/普通模块、唯一Runtime、非OS沙箱；保护已有数据和修改。用户要求风险相称验证，已过未变即停；无因不扩大为全矩阵。所有owned临时测试进程/证书/数据已清理，保留最终产物及无秘密证据，不能宽泛删除其他项目容器/临时目录。
