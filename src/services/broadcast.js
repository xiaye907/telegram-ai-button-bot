/**
 * 广播服务
 */
import { broadcastMessage } from './telegram.js';
import { getAllUserIds } from './user.js';

export async function scheduleBroadcast(content, adminId, env) {
  await env.DB.prepare(`
    INSERT INTO announcements (title, content, created_by, created_at)
    VALUES (?, ?, ?, unixepoch())
  `).bind(content.slice(0, 50), content, adminId).run();

  // 直接异步广播
  const userIds = await getAllUserIds(env);
  const result = await broadcastMessage(env.BOT_TOKEN, userIds, content);

  await env.DB.prepare(`
    UPDATE announcements SET is_sent=1, sent_count=? WHERE created_by=? ORDER BY created_at DESC LIMIT 1
  `).bind(result.success, adminId).run();

  return result;
}
