import type { ChannelStatus, QQConfig } from '../../../runtime/src/channels/types';
import type { ManagedQQStatus } from '../../../runtime/src/channels/managed/types';
import type { Bilibili } from '../../../runtime/src/bilibili/service';
import type { Douyin } from '../../../runtime/src/douyin/service';

export type BiliStatus = ReturnType<Bilibili['status']>;
export type DouyinStatus = ReturnType<Douyin['status']>;
type QQMode = NonNullable<QQConfig['mode']>;

export function activeQQMode(channel: ChannelStatus, component?: ManagedQQStatus): QQMode {
  if (!channel.config || channel.config.mode === 'managed') return 'managed';
  if (!channel.config.enabled && component && !['missing', 'ready'].includes(component.phase)) return 'managed';
  return 'external';
}

function transportStatus(channel: ChannelStatus) {
  if (!channel.config?.enabled) return { label: '已停用' };
  const { state, error } = channel.health;
  const labels: Record<string, string> = {
    online: '已连接', stopped: '已停用', connecting: '连接中', reconnecting: '正在重连',
    not_logged_in: '需要登录', error: '连接异常',
  };
  if (state === 'error' || (state === 'not_logged_in' && error === 'HEALTH_CHECK_FAILED')) {
    return { label: '连接异常', error: error ?? 'CONNECTION_INIT_FAILED' };
  }
  return { label: labels[state] ?? '未连接' };
}

export function qqStatus(mode: QQMode, channel: ChannelStatus, component?: ManagedQQStatus): { label: string; error?: string; qr?: string } {
  if (mode === 'external') {
    return channel.config && channel.config.mode !== 'managed' ? transportStatus(channel) : { label: '未连接' };
  }
  if (!component) return { label: '暂时无法获取状态' };
  const { phase, error, loginPhase } = component;
  if (phase === 'error') return { label: '连接异常', error: error ?? component.operationError ?? 'QQ_COMPONENT_UNAVAILABLE' };
  if (phase === 'login') {
    if (loginPhase === 'reconnecting') return { label: '正在恢复登录服务' };
    if (error) return { label: '登录失败', error };
    if (loginPhase === 'qrcode_scanned') return { label: '等待手机确认' };
    if (loginPhase === 'initializing') return { label: '正在启动' };
    if (loginPhase === 'generating_qrcode') return { label: '正在获取二维码' };
    return { label: component.qr ? '等待扫码' : '正在获取二维码', qr: component.qr };
  }
  if (phase === 'online' && channel.config?.mode === 'managed' && component.account?.id === channel.config.accountId) {
    return transportStatus(channel);
  }
  const labels = { missing: '尚未准备', installing: '正在准备组件', ready: '等待登录', starting: '正在启动', online: '已登录', stopping: '正在停止' };
  return { label: labels[phase] };
}

function accountStatus(enabled: boolean, accountState: string) {
  if (!enabled) return '未启用';
  const labels: Record<string, string> = {
    verified: '已连接', unverified: '待验证', 'signed-out': '未登录',
    'login-required': '需要登录', 'account-mismatch': '账号不符', 'expired-or-unavailable': '登录失效或暂不可用',
  };
  return labels[accountState] ?? '未连接';
}

export function biliStatus(status: BiliStatus) {
  const phase = status.connection?.phase;
  if (status.health?.error || phase === 'error') return { label: '连接异常', error: status.health?.error ?? status.connection.error ?? 'BILI_LOGIN_FAILED' };
  if (phase === 'expired') return { label: '二维码已过期' };
  if (phase === 'connecting') return { label: '连接中', connecting: true };
  if (phase === 'login') return { label: status.connection.login?.status === 'scanned' ? '等待手机确认' : '等待扫码', connecting: true };
  return { label: accountStatus(status.enabled, status.accountState), connected: status.enabled && status.accountState === 'verified' };
}

export function douyinStatus(status: DouyinStatus) {
  const phase = status.connection?.phase;
  if (phase === 'error') return { label: '连接异常', error: status.connection.error ?? 'DOUYIN_LOGIN_REQUIRED' };
  if (phase === 'connecting') return { label: '正在打开登录', connecting: true };
  if (phase === 'login') {
    const label = { verification: '等待验证', confirmation: '等待手机确认' }[status.connection.loginState ?? ''] ?? '等待浏览器登录';
    return { label, connecting: true };
  }
  const connected = status.config.enabled && status.accountState === 'verified' && status.browser?.state === 'ready';
  const label = status.config.enabled && status.accountState === 'verified' && !connected ? '未连接' : accountStatus(status.config.enabled, status.accountState);
  return { label, connected };
}
