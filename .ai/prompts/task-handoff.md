# Task Handoff

当前结果：accept_p5_worker_ws完整PASS报告已由root读取入Acceptance，本地返工闭环，无运行中子任务。root正在更新阶段记录并按用户既有授权本地commit；不需重建验收或重复检查。完成Git后进入P6，届时重写本交接。下文保留刚结束验收的范围。

## Role / Goal

Acceptance，EXISTING。新的独立P5 Worker WebSocket返工验收，只读，不改任何文件/Git/index/分支，不创建子Agent。dev HEAD7ceb617，P5未提交。用户每阶段本地commit由root执行，无push/发布。全Goal P0–P7继续，未完成外部项与代码结果分开。

## Required Reads

AGENTS、constitution/mission/tech-stack、.ai/rules全部；Spec007 spec/plan/acceptance/rework、Decision007。Plan末尾Fourth Rework是完整最新报告；Acceptance开头Fourth为旧FAIL：Worker WS真实发出消息。前序HTTP/Worker生命周期/评论/ASR等已确认，不机械重做。

## Current Changes

plugins/douyin/websocket-policy.mjs及.d.mts，browser-host.mjs，apps/runtime/src/douyin/browser.ts，tests/integration/douyin-websocket.test.ts，docs/douyin.md。Chrome启动前建立只拒绝不转发/不记内容的本机代理；manual mapping HTTP/HTTPS direct，other只有该拒绝器，无DIRECT后备，减去loopback隐式旁路。覆盖所有Worker的ws/wss；host清理/IPC拒绝通知。Manager启动忽略非端口通知，close不再等待signalCode非空的已退出host。未改redirects/WriteGate/Python/其他平台。

## Evidence

S3，本轮9项直接测试（WS/生命周期3项+已有HTTP6项）通过。8种Worker×WS/WSS共16尝试，目标TCP/握手/消息均0，HTTP读16次、页面存活、denied准确，write/login仍拒绝。Page门保留；原/tmp/bff-accept-worker-ws.mjs现在Page/Dedicated/Shared全部upgrades/messages为空，denied=true/submitted=false。

生产策略模块+真实Chrome：拒绝器1次CONNECT，独立关闭拒绝器后WS/WSS无直连、目标TCP0；取消监听清理/重启/已SIGKILL host清理过。原douyin-redirect.test.ts的页面/popup/OOPIF、WorkerHTTP、批准/撤销/取消6项通过。真实生产BrowserManager访问官方GitHub镜像proxy.md为200/TLS1.3/正文匹配/拒绝通知0，没忽略证书；googlesource地址超时已如实记录。

build:node、受影响定向eslint、tsconfig.json --noEmit、自有diff过；最后业务改动在上述检查之前，后面只追加异常退出测试并定向验证/type/lint。完整命令及失败夹具处理见Plan。所有Chrome/HTTP/WS/监听器/临时profile含失败遗留清理，原复现与/tmp/bff-ws-*.log保留。

## Acceptance Scope / Constraints

独立判断未知Worker WS拒绝是否真正在外发前生效、无旁路/直连fallback、启动/失败/清理边界和正常HTTP/Worker行为，公开限制是否准确。有具体疑点才最小隔离复现；不要为信心重跑全矩阵或扩张无关协议审计。实际网络计数比Promise/状态更重要，不能把TLS证书错误当WSS拒绝。

代理取舍已明确记录Decision007：仅专用Chrome HTTP/HTTPS直连、不继承系统代理，不改系统其他应用；需系统代理的平台可能不可达，不谎称保持原代理语义。真实平台/账号/云/Windows/Linux图形未验证；DM/分享/上传发布wire未实现而拒绝，代码验收PASS不等于整个阶段完成。没有真实账号或社交写授权，所有测试受控接收器；官方文档公开只读可用但无需重复既有HTTPS证据。

未来Spec008/009、Decision008仍规划（含P6构建资源路径衔接），本轮不扩张。原生Mac/ASR/评论/QQ/B站证据复用，源码不变不重测。

## Expected Output

完整Acceptance Report：PASS/FAIL、Coverage、Risk Level S3/Evidence Reviewed/Checks Performed、Issues/Risks/Rework。FAIL给证据和目标，不修改；清理自己资源。root处理报告后本地提交可验收阶段代码并继续P6。
