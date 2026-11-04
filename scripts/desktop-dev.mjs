import { fileURLToPath } from 'node:url';
import { startDevelopment } from './desktop-dev-session.mjs';
const controller = new AbortController();
for (const name of ['SIGINT', 'SIGTERM']) process.once(name, () => controller.abort(new Error('DEV_INTERRUPTED')));
const messages = {
  DEV_ALREADY_RUNNING: '此数据目录已有开发会话，请先退出原来的 desktop:dev。',
  DEV_EXTERNAL_RUNTIME: '此数据目录正由其他安装或无法确认归属的后台使用，请先从对应应用正常退出。',
  DEV_EXISTING_RUNTIME_UNVERIFIED: '无法确认已有后台身份，未停止任何外部进程。',
  DEV_NODE_BUILD_FAILED: '后台构建失败，开发服务没有启动。',
  DEV_RELEASE_UNSUPPORTED: '托管开发不支持 --release；发行请使用 desktop:build。',
};
try {
  const session = await startDevelopment({ root: fileURLToPath(new URL('..', import.meta.url)), args: process.argv.slice(2), signal: controller.signal });
  await session.finished;
} catch (error) {
  if (error.message === 'DEV_INTERRUPTED') process.exitCode = 130;
  else { console.error(`[dev] ${messages[error.message] ?? '开发启动或清理失败'} (${String(error.code ?? error.message).match(/^[A-Z][A-Z0-9_]+$/)?.[0] ?? 'DEV_FAILED'})`); process.exitCode = 1; }
}
