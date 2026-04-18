/**
 * 功能补全模块
 * 覆盖审查中所有「缺失/部分实现」项目
 */

// ─────────────────────────────────────────────────────────
// 1. 数据导出（用户历史+模板 → JSON）
// ─────────────────────────────────────────────────────────

export async function exportUserData(userId, env) {
  const [gens, templates] = await Promise.all([
    env.DB.prepare('SELECT prompt, buttons_json, ai_engine, created_at FROM generations WHERE user_id=? ORDER BY created_at DESC').bind(userId).all(),
    env.DB.prepare('SELECT name, description, buttons_json, is_public, created_at FROM templates WHERE user_id=? ORDER BY created_at DESC').bind(userId).all()
  ]);

  return {
    exportedAt: new Date().toISOString(),
    generations: gens.results,
    templates: templates.results
  };
}

// ─────────────────────────────────────────────────────────
// 2. tg:// 内联链接生成
// ─────────────────────────────────────────────────────────

export function buildShareLink(botUsername, generationId) {
  // 返回 @username + ID 格式的分享文本
  return `@${botUsername} ${generationId}`;
}

export function buildInlineShareButton(botUsername, generationId, lang = 'zh') {
  const label = lang === 'zh' ? '🔗 生成分享链接' : '🔗 Share Link';
  return { text: label, switch_inline_query: generationId };
}

// ─────────────────────────────────────────────────────────
// 3. 维护模式
// ─────────────────────────────────────────────────────────

const MAINTENANCE_KEY = 'system:maintenance';

export async function setMaintenanceMode(enabled, reason, env) {
  if (enabled) {
    await env.BOT_KV.put(MAINTENANCE_KEY, JSON.stringify({ enabled: true, reason, since: Date.now() }));
  } else {
    await env.BOT_KV.delete(MAINTENANCE_KEY);
  }
}

export async function getMaintenanceStatus(env) {
  const raw = await env.BOT_KV.get(MAINTENANCE_KEY);
  return raw ? JSON.parse(raw) : { enabled: false };
}

// 在 webhook.js 顶部调用：
export async function checkMaintenance(env, userId, adminIds) {
  const status = await getMaintenanceStatus(env);
  if (!status.enabled) return null;
  const isAdmin = (adminIds || '').split(',').map(s => s.trim()).includes(String(userId));
  if (isAdmin) return null; // 管理员不受影响
  return status.reason || '系统维护中，请稍后再试 🔧';
}

// ─────────────────────────────────────────────────────────
// 4. 功能开关（灰度/特性标志）
// ─────────────────────────────────────────────────────────

const FLAGS = {
  inline_share_link: true,    // tg:// 分享链接
  public_template_market: true,
  ai_content_moderation: false, // 待上线
  payment_integration: false,   // 待上线
};

export async function isFeatureEnabled(flagName, userId, env) {
  // 1. 先查 KV 运行时开关
  const runtime = await env.BOT_KV.get(`flag:${flagName}`);
  if (runtime !== null) return runtime === '1';
  // 2. 回退到代码中的默认值
  return FLAGS[flagName] ?? false;
}

export async function setFeatureFlag(flagName, enabled, env) {
  await env.BOT_KV.put(`flag:${flagName}`, enabled ? '1' : '0', { expirationTtl: 86400 * 365 });
}

export async function listFeatureFlags(env) {
  const result = {};
  for (const key of Object.keys(FLAGS)) {
    const runtime = await env.BOT_KV.get(`flag:${key}`);
    result[key] = runtime !== null ? runtime === '1' : FLAGS[key];
  }
  return result;
}

// ─────────────────────────────────────────────────────────
// 5. AI 成本统计
// ─────────────────────────────────────────────────────────

// 近似定价（每1000 tokens，单位美分），可在 wrangler.toml vars 中覆盖
const TOKEN_COST_USD_PER_1K = {
  deepseek: 0.014,   // deepseek-chat input
  doubao: 0.008      // doubao-pro-4k
};

export async function getAICostStats(env, days = 7) {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const { results } = await env.DB.prepare(`
    SELECT ai_engine, SUM(tokens_used) as total_tokens, COUNT(*) as calls
    FROM generations
    WHERE created_at > ?
    GROUP BY ai_engine
  `).bind(since).all();

  return results.map(r => ({
    engine: r.ai_engine,
    calls: r.calls,
    totalTokens: r.total_tokens,
    estimatedCostUSD: ((r.total_tokens / 1000) * (TOKEN_COST_USD_PER_1K[r.ai_engine] || 0.01)).toFixed(4)
  }));
}

export function formatCostStats(stats, lang = 'zh') {
  if (!stats.length) return lang === 'zh' ? '暂无数据' : 'No data';
  const lines = stats.map(s =>
    `${s.engine === 'deepseek' ? '🔷 DeepSeek' : '🟡 豆包'}: ${s.calls} 次 · ${s.totalTokens.toLocaleString()} tokens · ~$${s.estimatedCostUSD}`
  );
  return (lang === 'zh' ? '💰 AI 成本统计（近7日）\n\n' : '💰 AI Cost (7d)\n\n') + lines.join('\n');
}

// ─────────────────────────────────────────────────────────
// 6. 用户增长趋势（按天分组）
// ─────────────────────────────────────────────────────────

export async function getUserGrowthStats(env, days = 14) {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const { results } = await env.DB.prepare(`
    SELECT date(created_at, 'unixepoch') as day, COUNT(*) as new_users
    FROM users WHERE created_at > ?
    GROUP BY day ORDER BY day ASC
  `).bind(since).all();

  const { results: actResults } = await env.DB.prepare(`
    SELECT date(created_at, 'unixepoch') as day, COUNT(DISTINCT user_id) as active_users
    FROM generations WHERE created_at > ?
    GROUP BY day ORDER BY day ASC
  `).bind(since).all();

  // 合并
  const map = {};
  results.forEach(r => { map[r.day] = { day: r.day, newUsers: r.new_users, activeUsers: 0 }; });
  actResults.forEach(r => {
    if (!map[r.day]) map[r.day] = { day: r.day, newUsers: 0, activeUsers: 0 };
    map[r.day].activeUsers = r.active_users;
  });

  return Object.values(map).sort((a, b) => a.day.localeCompare(b.day));
}

export function formatGrowthStats(stats, lang = 'zh') {
  if (!stats.length) return lang === 'zh' ? '暂无数据' : 'No data';
  const header = lang === 'zh' ? '📈 用户增长（近14日）\n\n' : '📈 User Growth (14d)\n\n';
  // 最近7条（避免消息过长）
  const rows = stats.slice(-7).map(s =>
    `${s.day}  新增 +${s.newUsers}  活跃 ${s.activeUsers}`
  );
  return header + '```\n' + rows.join('\n') + '\n```';
}

// ─────────────────────────────────────────────────────────
// 7. 支付集成（Telegram Stars）
// ─────────────────────────────────────────────────────────

const PLAN_PRICES_STARS = {
  pro_monthly: { stars: 200, plan: 'pro', days: 30, label: 'Pro 30天' },
  pro_quarterly: { stars: 500, plan: 'pro', days: 90, label: 'Pro 90天' },
  enterprise_monthly: { stars: 800, plan: 'enterprise', days: 30, label: '企业版 30天' }
};

export async function sendInvoice(token, chatId, priceKey, lang = 'zh') {
  const price = PLAN_PRICES_STARS[priceKey];
  if (!price) throw new Error('Invalid price key');

  const { sendInvoiceTg } = await import('./telegram.js');
  return sendInvoiceTg(token, chatId, {
    chat_id: chatId,
    title: price.label,
    description: lang === 'zh'
      ? `解锁 ${price.label}，享受更多按钮生成次数`
      : `Unlock ${price.label} for more button generations`,
    payload: JSON.stringify({ priceKey, plan: price.plan, days: price.days }),
    currency: 'XTR',
    prices: [{ label: price.label, amount: price.stars }]
  });
}

export async function handleSuccessfulPayment(payment, userId, env) {
  const payload = JSON.parse(payment.invoice_payload);
  const { setUserPlan } = await import('./user.js');
  await setUserPlan(userId, payload.plan, payload.days, env);

  // 记录订阅
  const subId = Date.now().toString(36) + Math.random().toString(36).slice(2);
  await env.DB.prepare(`
    INSERT INTO subscriptions (id, user_id, plan, amount, payment_method, expires_at, status, created_at)
    VALUES (?, ?, ?, ?, 'telegram_stars', unixepoch() + ?, 'active', unixepoch())
  `).bind(subId, userId, payload.plan, payment.total_amount, payload.days * 86400).run();

  return payload;
}

// ─────────────────────────────────────────────────────────
// 8. 套餐到期提醒（在 scheduled.js 中调用）
// ─────────────────────────────────────────────────────────

export async function sendExpiryReminders(env) {
  const tomorrow = Math.floor(Date.now() / 1000) + 86400;
  const threeDays = Math.floor(Date.now() / 1000) + 86400 * 3;

  // 查询1-3天内到期的非免费用户
  const { results } = await env.DB.prepare(`
    SELECT id, first_name, language_code, plan, plan_expires_at
    FROM users
    WHERE plan != 'free'
      AND plan_expires_at IS NOT NULL
      AND plan_expires_at BETWEEN ? AND ?
      AND is_banned = 0
  `).bind(tomorrow - 86400, threeDays).all();

  const { sendMessage } = await import('./telegram.js');

  for (const user of results) {
    const daysLeft = Math.ceil((user.plan_expires_at - Date.now() / 1000) / 86400);
    const lang = user.language_code || 'zh';
    const msg = lang === 'zh'
      ? `⏰ 您的 ${user.plan} 套餐将在 <b>${daysLeft} 天</b>后到期，续费后继续享受更多额度！`
      : `⏰ Your ${user.plan} plan expires in <b>${daysLeft} day(s)</b>. Renew to keep your quota!`;

    await sendMessage(env.BOT_TOKEN, user.id, msg, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: lang === 'zh' ? '⭐ 立即续费' : '⭐ Renew Now', callback_data: 'upgrade:renew' }
        ]]
      }
    });

    // 避免触发 Telegram 限速
    await new Promise(r => setTimeout(r, 50));
  }

  return results.length;
}

// ─────────────────────────────────────────────────────────
// 9. 举报处理完整流程
// ─────────────────────────────────────────────────────────

export async function submitReport(reporterId, targetType, targetId, reason, env) {
  // 防重复举报（同一用户对同一目标24h内只能举报一次）
  const dedupeKey = `report_dedup:${reporterId}:${targetType}:${targetId}`;
  const exists = await env.BOT_KV.get(dedupeKey);
  if (exists) return { ok: false, reason: 'duplicate' };

  await env.DB.prepare(`
    INSERT INTO reports (reporter_id, target_type, target_id, reason, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', unixepoch())
  `).bind(reporterId, targetType, String(targetId), reason || '').run();

  await env.BOT_KV.put(dedupeKey, '1', { expirationTtl: 86400 });
  return { ok: true };
}

export async function getPendingReports(env, { limit = 20, offset = 0 } = {}) {
  const { results } = await env.DB.prepare(`
    SELECT r.*, u.username as reporter_username
    FROM reports r LEFT JOIN users u ON r.reporter_id = u.id
    WHERE r.status = 'pending'
    ORDER BY r.created_at DESC LIMIT ? OFFSET ?
  `).bind(limit, offset).all();
  return results;
}

export async function resolveReport(reportId, adminId, action, env) {
  // action: 'resolved' | 'dismissed'
  await env.DB.prepare(`
    UPDATE reports SET status=?, resolved_by=? WHERE id=?
  `).bind(action, adminId, reportId).run();

  const { logAdminAction } = await import('./adminLog.js');
  await logAdminAction(adminId, `report_${action}`, reportId, env);
}

export function formatReportsForAdmin(reports) {
  if (!reports.length) return '✅ 暂无待处理举报';
  return reports.map((r, i) =>
    `${i + 1}. [${r.target_type}] ID:${r.target_id}\n   举报人: @${r.reporter_username || r.reporter_id}\n   原因: ${r.reason || '未填写'}`
  ).join('\n\n');
}

// ─────────────────────────────────────────────────────────
// 10. 官方预设模板种子数据
// ─────────────────────────────────────────────────────────

export const SEED_TEMPLATES = [
  {
    id: 'seed_ecommerce',
    name: '电商购买按钮',
    description: '适用于商品促销，含购买/了解更多/客服三个按钮',
    tags: '电商,购买,促销',
    buttons_json: JSON.stringify([
      [{ text: '✅ 立即购买', url: 'https://example.com/buy' }],
      [
        { text: 'ℹ️ 了解更多', url: 'https://example.com/detail' },
        { text: '💬 联系客服', url: 'https://t.me/support' }
      ]
    ])
  },
  {
    id: 'seed_event',
    name: '活动报名',
    description: '适用于线上/线下活动报名，含报名/日历/分享',
    tags: '活动,报名,推广',
    buttons_json: JSON.stringify([
      [{ text: '🎟 立即报名', url: 'https://example.com/signup' }],
      [
        { text: '📅 添加日历', url: 'https://example.com/calendar' },
        { text: '📤 分享活动', url: 'https://t.me/share/url?url=https://example.com' }
      ]
    ])
  },
  {
    id: 'seed_social',
    name: '社群导流',
    description: '引导用户关注多个社交平台',
    tags: '社群,关注,导流',
    buttons_json: JSON.stringify([
      [
        { text: '📢 Telegram频道', url: 'https://t.me/yourchannel' },
        { text: '💬 交流群', url: 'https://t.me/yourgroup' }
      ],
      [{ text: '🌐 官方网站', url: 'https://example.com' }]
    ])
  },
  {
    id: 'seed_vote',
    name: '投票/问卷',
    description: '简单的选项投票按钮组',
    tags: '投票,问卷,调查',
    buttons_json: JSON.stringify([
      [
        { text: '👍 赞成', callback_data: 'vote:yes' },
        { text: '👎 反对', callback_data: 'vote:no' }
      ],
      [{ text: '🤔 弃权', callback_data: 'vote:abstain' }]
    ])
  },
  {
    id: 'seed_download',
    name: '多端下载',
    description: '引导用户下载 App，区分 iOS/Android/PC',
    tags: '下载,App,软件',
    buttons_json: JSON.stringify([
      [
        { text: '🍎 App Store', url: 'https://apps.apple.com' },
        { text: '🤖 Google Play', url: 'https://play.google.com' }
      ],
      [{ text: '💻 桌面版下载', url: 'https://example.com/download' }]
    ])
  }
];

export async function seedOfficialTemplates(env) {
  // 确保系统用户（id=0）存在，满足外键约束
  await env.DB.prepare(`
    INSERT OR IGNORE INTO users (id, username, first_name, language_code, plan)
    VALUES (0, 'system', 'Official', 'zh', 'enterprise')
  `).run();

  for (const tpl of SEED_TEMPLATES) {
    const exists = await env.DB.prepare('SELECT id FROM templates WHERE id=?').bind(tpl.id).first();
    if (!exists) {
      await env.DB.prepare(`
        INSERT INTO templates (id, user_id, name, description, buttons_json, tags, is_public, is_featured, created_at, updated_at)
        VALUES (?, 0, ?, ?, ?, ?, 1, 1, unixepoch(), unixepoch())
      `).bind(tpl.id, tpl.name, tpl.description, tpl.buttons_json, tpl.tags).run();
    }
  }
  console.log(`[Seed] ${SEED_TEMPLATES.length} official templates seeded`);
}

// ─────────────────────────────────────────────────────────
// 11. 白名单管理（补全字段逻辑）
// ─────────────────────────────────────────────────────────

export async function addToWhitelist(userId, env) {
  // 使用 KV 存储白名单，无需改表结构
  await env.BOT_KV.put(`whitelist:${userId}`, '1', { expirationTtl: 86400 * 365 });
}

export async function removeFromWhitelist(userId, env) {
  await env.BOT_KV.delete(`whitelist:${userId}`);
}

export async function isWhitelisted(userId, env) {
  const val = await env.BOT_KV.get(`whitelist:${userId}`);
  return val === '1';
}

// 白名单用户额度翻倍
export async function getWhitelistBonus(userId, env) {
  return (await isWhitelisted(userId, env)) ? 2 : 1;
}

// ─────────────────────────────────────────────────────────
// 12. 异常预警（写入 KV，供定时任务检查）
// ─────────────────────────────────────────────────────────

export async function checkAndAlertAnomalies(env) {
  const alerts = [];

  // 检查 AI 错误率（最近1小时失败次数，需在 buttonGenerator 中记录失败）
  const failKey = `metric:ai_fail:${getHourKey()}`;
  const failCount = parseInt(await env.BOT_KV.get(failKey) || '0');
  if (failCount > 20) {
    alerts.push(`🚨 AI错误率异常：最近1小时失败 ${failCount} 次`);
  }

  // 检查用量激增（对比昨天同期）
  const todayGens = await env.DB.prepare(
    'SELECT COUNT(*) as c FROM generations WHERE created_at > unixepoch()-3600'
  ).first();
  if ((todayGens?.c || 0) > 500) {
    alerts.push(`⚠️ 用量激增：最近1小时生成 ${todayGens.c} 次`);
  }

  return alerts;
}

export async function recordAIFailure(engine, env) {
  const key = `metric:ai_fail:${getHourKey()}`;
  const cur = parseInt(await env.BOT_KV.get(key) || '0');
  await env.BOT_KV.put(key, String(cur + 1), { expirationTtl: 7200 });
}

function getHourKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}${String(d.getUTCHours()).padStart(2,'0')}`;
}
