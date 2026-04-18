/**
 * Cron 定时任务处理器
 * 每日零点执行
 */
import { checkAndExpirePlans } from '../services/user.js';
import {
  sendExpiryReminders,
  checkAndAlertAnomalies,
  seedOfficialTemplates,
  getUserGrowthStats
} from '../services/extras.js';
import { sendMessage } from '../services/telegram.js';

export async function handleScheduled(event, env, ctx) {
  console.log('[Scheduled] Running daily tasks...');

  try {
    // 1. 检查并过期套餐
    await checkAndExpirePlans(env);
    console.log('[Scheduled] Plan expiry check done');

    // 2. 清理7天前的生成历史(免费用户)
    await env.DB.prepare(`
      DELETE FROM generations
      WHERE created_at < unixepoch() - 604800
        AND user_id IN (SELECT id FROM users WHERE plan='free')
    `).run();
    console.log('[Scheduled] Old history cleaned');

    // 3. 统计日报写入KV (供管理员查询)
    const stats = await collectDailyStats(env);
    await env.BOT_KV.put(
      `stats:daily:${getDateStr()}`,
      JSON.stringify(stats),
      { expirationTtl: 86400 * 30 }
    );
    console.log('[Scheduled] Daily stats saved:', stats);

    // 4. 发送套餐到期提醒
    const reminded = await sendExpiryReminders(env);
    console.log(`[Scheduled] Expiry reminders sent: ${reminded}`);

    // 5. 异常预警 → 通知管理员
    const alerts = await checkAndAlertAnomalies(env);
    if (alerts.length > 0) {
      const adminIds = (env.ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
      for (const adminId of adminIds) {
        await sendMessage(env.BOT_TOKEN, adminId, alerts.join('\n'));
      }
      console.log('[Scheduled] Anomaly alerts sent:', alerts);
    }

    // 6. 确保官方模板已初始化
    await seedOfficialTemplates(env);

    // 7. 缓存用户增长趋势（供管理员面板快速读取）
    const growth = await getUserGrowthStats(env, 14);
    await env.BOT_KV.put('stats:growth:14d', JSON.stringify(growth), { expirationTtl: 86400 });

  } catch (err) {
    console.error('[Scheduled] Error:', err);
  }
}

async function collectDailyStats(env) {
  const [users, gens, activeUsers] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as c FROM users').first(),
    env.DB.prepare('SELECT COUNT(*) as c FROM generations WHERE created_at > unixepoch()-86400').first(),
    env.DB.prepare('SELECT COUNT(DISTINCT user_id) as c FROM generations WHERE created_at > unixepoch()-86400').first()
  ]);

  return {
    date: getDateStr(),
    totalUsers: users?.c || 0,
    dailyGenerations: gens?.c || 0,
    dailyActiveUsers: activeUsers?.c || 0,
    collectedAt: Date.now()
  };
}

function getDateStr() {
  return new Date().toISOString().slice(0, 10);
}
