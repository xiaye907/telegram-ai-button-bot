/**
 * 管理员操作日志
 */
export async function logAdminAction(adminId, action, targetId, env, details = '') {
  await env.DB.prepare(`
    INSERT INTO admin_logs (admin_id, action, target_id, details, created_at)
    VALUES (?, ?, ?, ?, unixepoch())
  `).bind(adminId, action, String(targetId), details).run();
}

export async function getAdminLogs(env, { limit = 50, offset = 0 } = {}) {
  const { results } = await env.DB.prepare(`
    SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).bind(limit, offset).all();
  return results;
}
