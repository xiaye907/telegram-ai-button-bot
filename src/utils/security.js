/**
 * 安全工具函数
 * Webhook 验证、管理员鉴权
 */

/**
 * 验证 Telegram Webhook 请求的 secret token
 */
export function verifyWebhookSecret(request, secret) {
  if (!secret) return true; // 未设置时跳过验证(开发模式)
  const token = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  return token === secret;
}

/**
 * 判断用户是否为管理员
 */
export function isAdmin(userId, env) {
  const adminIds = (env.ADMIN_IDS || '').split(',').map(s => s.trim());
  return adminIds.includes(String(userId));
}

/**
 * 简单内容过滤(关键词屏蔽)
 */
export function containsBannedWords(text, env) {
  const banned = (env.BANNED_WORDS || '').split(',').map(s => s.trim().toLowerCase());
  const lower = text.toLowerCase();
  return banned.some(w => w && lower.includes(w));
}

/**
 * 验证 URL 是否安全
 */
export function isSafeUrl(url) {
  try {
    const u = new URL(url);
    return ['http:', 'https:'].includes(u.protocol);
  } catch {
    return false;
  }
}
