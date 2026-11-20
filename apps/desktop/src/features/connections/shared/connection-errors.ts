export function connectionErrorCode(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
export function connectionReadMessage(error: unknown, fallback: string) {
  const code = connectionErrorCode(error);
  return /^(Not Found|NOT_FOUND|HTTP_404|404)$/.test(code)
    ? '请重新启动大肥鱼，再重试。'
    : fallback;
}
