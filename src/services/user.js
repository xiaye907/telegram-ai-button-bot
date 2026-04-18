/**
 * 用户服务
 * 用户 CRUD、额度管理、权限
 */

const PLAN_LIMITS = {
  free: 50,
  pro: 500,
  enterprise: 9999
};

/**
 * 获取或创建用户
 */
export async function getOrCreateUser(tgUser, env) {
  // 先从KV缓存读取(5分钟缓存)
  const cacheKey = `user:${tgUser.id}`;
  const cached = await env.BOT_KV.get(cacheKey);
  if (cached) return JSON.parse(cached);

  let user = await env.DB.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(tgUser.id).first();

  if (!user) {
    await env.DB.prepare(`
      INSERT INTO users (id, username, first_name, language_code)
      VALUES (?, ?, ?, ?)
    `).bind(
      tgUser.id,
      tgUser.username || null,
      tgUser.first_name || '',
      tgUser.language_code || 'zh'
    ).run();

    user = await env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(tgUser.id).first();
  } else {
    // 异步更新用户名,不阻塞响应
    env.DB.prepare(`
      UPDATE users SET username=?, first_name=?, updated_at=unixepoch()
      WHERE id=?
    `).bind(tgUser.username || null, tgUser.first_name || '', tgUser.id).run();
  }

  // 写入KV缓存
  await env.BOT_KV.put(cacheKey, JSON.stringify(user), { expirationTtl: 300 });
  return user;
}

/**
 * 获取用户额度信息
 */
export async function getUserQuota(user, env) {
  const limit = PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;
  const now = Math.floor(Date.now() / 1000);

  // 检查是否需要重置(每日)
  const resetAt = user.daily_calls_reset_at || 0;
  const oneDayAgo = now - 86400;

  let used = user.daily_calls_used || 0;
  if (resetAt < oneDayAgo) {
    // 重置
    await env.DB.prepare(`
      UPDATE users SET daily_calls_used=0, daily_calls_reset_at=? WHERE id=?
    `).bind(now, user.id).run();
    used = 0;
  }

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetAt: new Date((resetAt + 86400) * 1000).toLocaleTimeString('zh-CN')
  };
}

/**
 * 扣减额度
 */
export async function decrementQuota(userId, env) {
  await env.DB.prepare(`
    UPDATE users 
    SET daily_calls_used = daily_calls_used + 1,
        total_calls = total_calls + 1,
        updated_at = unixepoch()
    WHERE id = ?
  `).bind(userId).run();
}

/**
 * 封禁用户
 */
export async function banUser(userId, reason, env) {
  await env.DB.prepare(`
    UPDATE users SET is_banned=1, ban_reason=?, updated_at=unixepoch() WHERE id=?
  `).bind(reason, userId).run();
}

/**
 * 解封用户
 */
export async function unbanUser(userId, env) {
  await env.DB.prepare(`
    UPDATE users SET is_banned=0, ban_reason=NULL, updated_at=unixepoch() WHERE id=?
  `).bind(userId).run();
}

/**
 * 重置用户今日额度
 */
export async function resetUserQuota(userId, env) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`
    UPDATE users SET daily_calls_used=0, daily_calls_reset_at=?, updated_at=unixepoch() WHERE id=?
  `).bind(now, userId).run();
}

/**
 * 设置用户套餐
 */
export async function setUserPlan(userId, plan, days, env) {
  const expiresAt = Math.floor(Date.now() / 1000) + days * 86400;
  await env.DB.prepare(`
    UPDATE users SET plan=?, plan_expires_at=?, updated_at=unixepoch() WHERE id=?
  `).bind(plan, expiresAt, userId).run();
}

/**
 * 更新用户偏好设置
 */
export async function updateUserPreference(userId, key, value, env) {
  const allowedKeys = ['preferred_ai', 'preferred_style', 'language_code'];
  if (!allowedKeys.includes(key)) throw new Error('Invalid preference key');

  await env.DB.prepare(`
    UPDATE users SET ${key}=?, updated_at=unixepoch() WHERE id=?
  `).bind(value, userId).run();
}

/**
 * 获取所有用户ID (用于广播)
 */
export async function getAllUserIds(env, filter = 'all') {
  let query = 'SELECT id FROM users WHERE is_banned=0';
  if (filter === 'pro') query += " AND plan IN ('pro','enterprise')";
  if (filter === 'free') query += " AND plan='free'";

  const { results } = await env.DB.prepare(query).all();
  return results.map(r => r.id);
}

/**
 * 检查套餐是否过期
 */
export async function checkAndExpirePlans(env) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`
    UPDATE users SET plan='free', plan_expires_at=NULL
    WHERE plan != 'free' AND plan_expires_at IS NOT NULL AND plan_expires_at < ?
  `).bind(now).run();
}

export function isUserBanned(user) {
  return !!user?.is_banned;
}
