/**
 * Callback Query 处理器
 * 处理所有内联键盘按钮点击事件
 */

import { answerCallback, editMessageKeyboard, sendMessage, sendMessageWithKeyboard } from '../services/telegram.js';
import { getGenerationById, saveGeneration } from '../services/history.js';
import { saveTemplate, deleteTemplate, getPublicTemplates, toggleTemplateLike } from '../services/template.js';
import { generateButtons, editButtons } from '../services/buttonGenerator.js';
import { banUser, unbanUser, resetUserQuota, setUserPlan } from '../services/user.js';
import { buildAdminMenu, buildUpgradeMenu, buildAiMenu, buildStyleMenu } from '../utils/keyboards.js';
import { t } from '../utils/i18n.js';
import { isAdmin } from '../utils/security.js';

export async function handleCallbackQuery(query, user, env) {
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;
  const data = query.data;
  const lang = user.language_code;

  // 先应答，防止按钮转圈
  await answerCallback(env.BOT_TOKEN, query.id);

  const [prefix, ...args] = data.split(':');

  switch (prefix) {
    // ── 主菜单导航 ─────────────────────────────────────────
    case 'menu':
      return handleMenuNav(args[0], chatId, msgId, user, env);

    // ── 保存为模板 ─────────────────────────────────────────
    case 'save':
      return handleSaveTemplate(args[0], chatId, user, env);

    // ── 分享链接 ────────────────────────
    case 'share': {
      const genId = args[0];
      const { buildShareLink } = await import('../services/extras.js');
      const botUsername = env.BOT_USERNAME || 'buttonbot';
      const shareText = buildShareLink(botUsername, genId);
      await sendMessage(
        env.BOT_TOKEN, chatId,
        lang === 'zh'
          ? `🔗 分享链接:\n\n<code>${shareText}</code>\n\n💡 使用方法:\n1. 复制上方链接\n2. 在任意对话中粘贴发送\n3. 点击弹出的按钮组即可转发`
          : `🔗 Share link:\n\n<code>${shareText}</code>\n\n💡 How to use:\n1. Copy the link above\n2. Paste in any chat\n3. Click the popup to forward`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // ── 编辑按钮 ──────────────────────────────────────────
    case 'edit':
      return handleEditFlow(args, chatId, msgId, user, env);

    // ── 重新生成 ──────────────────────────────────────────
    case 'regen':
      return handleRegen(args[0], chatId, msgId, user, env);

    // ── 历史记录操作 ───────────────────────────────────────
    case 'history':
      return handleHistoryAction(args, chatId, msgId, user, env);
    // ── 模板操作 ──────────────────────────────────────────
    case 'tpl':
      return handleTemplateAction(args, chatId, msgId, user, env);

    // ── 设置 ──────────────────────────────────────────────
    case 'set':
      return handleSettings(args, chatId, msgId, user, env);

    // ── 管理员操作 ────────────────────────────────────────
    case 'admin':
      if (!isAdmin(user.id, env)) {
        return answerCallback(env.BOT_TOKEN, query.id, t('no_permission', lang), true);
      }
      return handleAdminAction(args, chatId, msgId, query, user, env);

    // ── 升级套餐 → 直接发起 Stars 支付 ─────────────────────
    case 'upgrade': {
      const plan = args[0]; // pro | enterprise | renew
      if (plan === 'pro' || plan === 'enterprise') {
        const priceKey = plan === 'pro' ? 'pro_monthly' : 'enterprise_monthly';
        const { sendInvoice } = await import('../services/extras.js');
        await sendInvoice(env.BOT_TOKEN, chatId, priceKey, lang);
      } else {
        // 未指定套餐 → 显示选择菜单
        return sendMessageWithKeyboard(
          env.BOT_TOKEN, chatId,
          t('upgrade_info', lang),
          buildUpgradeMenu(lang)
        );
      }
      return;
    }

    default:
      console.warn('[Callback] Unknown action:', data);
  }
}

// ─────────────────────────────────────────────────────────
// 菜单导航
// ─────────────────────────────────────────────────────────

async function handleMenuNav(page, chatId, msgId, user, env) {
  const lang = user.language_code;

  const pages = {
    main: { text: t('menu_title', lang), kb: (await import('../utils/keyboards.js')).buildMainMenu(lang) },
    quota: { text: await buildQuotaText(user, lang, env), kb: buildBackKeyboard(lang) },
    upgrade: { text: t('upgrade_info', lang), kb: buildUpgradeMenu(lang) },
    ai: { text: t('ai_select', lang), kb: buildAiMenu(user.preferred_ai, lang) },
    style: { text: t('style_select', lang), kb: buildStyleMenu(user.preferred_style, lang) },
    settings: { text: t('settings_title', lang), kb: (await import('../utils/keyboards.js')).buildSettingsMenu(user, lang) },
    help: { text: t('help_text', lang), kb: buildBackKeyboard(lang) },
    generate: null  // 提示用户直接输入文字
  };

  const p = pages[page];
  if (p === undefined) return;  // 完全未知的 page
  if (p === null) {
    // generate: 引导用户直接输入
    return editMessageKeyboard(env.BOT_TOKEN, chatId, msgId,
      lang === 'zh' ? '✨ 直接发送文字描述，AI 会自动为你生成按钮！\n\n例如：「红色立即购买按钮，链接 https://example.com」' : '✨ Just send a text description and AI will generate buttons for you!\n\nExample: "Red Buy Now button linking to https://example.com"',
      buildBackKeyboard(lang)
    );
  }
  return editMessageKeyboard(env.BOT_TOKEN, chatId, msgId, p.text, p.kb);
}

// ─────────────────────────────────────────────────────────
// 保存模板流程
// ─────────────────────────────────────────────────────────

async function handleSaveTemplate(genId, chatId, user, env) {
  const lang = user.language_code;
  // 设置等待状态
  await env.BOT_KV.put(
    `state:${user.id}`,
    JSON.stringify({ action: 'awaiting_template_name', generationId: genId }),
    { expirationTtl: 300 }
  );
  return sendMessage(env.BOT_TOKEN, chatId, t('enter_template_name', lang));
}

// ─────────────────────────────────────────────────────────
// 编辑按钮流程
// ─────────────────────────────────────────────────────────

async function handleEditFlow(args, chatId, msgId, user, env) {
  const [action, genId, param] = args;
  const lang = user.language_code;

  switch (action) {
    case undefined:
    case 'show': {
      // 显示编辑选项菜单
      const keyboard = {
        inline_keyboard: [
          [
            { text: t('btn_edit_text', lang), callback_data: `edit:text:${genId}` },
            { text: t('btn_edit_color', lang), callback_data: `edit:color:${genId}` }
          ],
          [
            { text: t('btn_edit_layout', lang), callback_data: `edit:layout:${genId}` },
            { text: t('btn_edit_url', lang), callback_data: `edit:url:${genId}` }
          ],
          [{ text: t('btn_back', lang), callback_data: `menu:main` }]
        ]
      };
      return editMessageKeyboard(env.BOT_TOKEN, chatId, msgId, t('edit_which', lang), keyboard);
    }
    case 'text':
    case 'color':
    case 'layout':
    case 'url': {
      await env.BOT_KV.put(
        `state:${user.id}`,
        JSON.stringify({ action: `awaiting_edit_${action}`, generationId: genId }),
        { expirationTtl: 300 }
      );
      return sendMessage(env.BOT_TOKEN, chatId, t(`edit_prompt_${action}`, lang));
    }
  }
}

// ─────────────────────────────────────────────────────────
// 重新生成
// ─────────────────────────────────────────────────────────

async function handleRegen(genId, chatId, msgId, user, env) {
  const lang = user.language_code;
  const gen = await getGenerationById(genId, env);
  if (!gen || gen.user_id !== user.id) return;

  await answerCallback(env.BOT_TOKEN, '', t('regenerating', lang));

  const result = await generateButtons(gen.prompt, user, env);
  await saveGeneration(user.id, gen.prompt, result, env);

  const { buildPreviewKeyboard } = await import('../utils/keyboards.js');
  return editMessageKeyboard(
    env.BOT_TOKEN, chatId, msgId,
    t('regen_done', lang),
    buildPreviewKeyboard(result, lang)
  );
}

// ─────────────────────────────────────────────────────────
// 历史记录操作
// ─────────────────────────────────────────────────────────

async function handleHistoryAction(args, chatId, msgId, user, env) {
  const [action, genId] = args;
  const lang = user.language_code;

  if (action === 'list' || !action) {
    const { getHistory } = await import('../services/history.js');
    const history = await getHistory(user.id, env, { limit: 10 });
    if (!history.length) return sendMessage(env.BOT_TOKEN, chatId, t('no_history', lang));
    const { buildHistoryMenu } = await import('../utils/keyboards.js');
    return sendMessageWithKeyboard(env.BOT_TOKEN, chatId, t('history_title', lang), buildHistoryMenu(history, lang));
  }

  if (action === 'view') {
    const gen = await getGenerationById(genId, env);
    if (!gen || gen.user_id !== user.id) return;

    const buttons = JSON.parse(gen.buttons_json);
    const keyboard = {
      inline_keyboard: [
        ...buttons,
        [
          { text: t('btn_forward', lang), switch_inline_query: gen.id },
          { text: t('btn_save_tpl', lang), callback_data: `save:${genId}` },
          { text: t('btn_regen', lang), callback_data: `regen:${genId}` }
        ]
      ]
    };
    return editMessageKeyboard(env.BOT_TOKEN, chatId, msgId, `📋 ${gen.prompt}`, keyboard);
  }
}

// ─────────────────────────────────────────────────────────
// 模板操作
// ─────────────────────────────────────────────────────────

async function handleTemplateAction(args, chatId, msgId, user, env) {
  const [action, tplId] = args;
  const lang = user.language_code;

  switch (action) {
    case 'list':
    case undefined: {
      const { getMyTemplates } = await import('../services/template.js');
      const { buildTemplateMenu } = await import('../utils/keyboards.js');
      const templates = await getMyTemplates(user.id, env);
      return sendMessageWithKeyboard(env.BOT_TOKEN, chatId,
        t('templates_title', lang, { count: templates.length }),
        buildTemplateMenu(templates, lang)
      );
    }
    case 'public_list': {
      const { getPublicTemplates } = await import('../services/template.js');
      const templates = await getPublicTemplates(env, { limit: 20 });
      const keyboard = {
        inline_keyboard: [
          ...templates.slice(0, 8).map(tpl => ([{
            text: `⭐ ${tpl.name.slice(0, 25)}  ❤️${tpl.like_count}`,
            callback_data: `tpl:use:${tpl.id}`
          }])),
          [{ text: t('btn_back', lang), callback_data: 'menu:main' }]
        ]
      };
      return sendMessageWithKeyboard(env.BOT_TOKEN, chatId,
        lang === 'zh' ? `🌐 公共模板库 (${templates.length} 个)` : `🌐 Public Templates (${templates.length})`,
        keyboard
      );
    }
    case 'use': {
      const tpl = await getTemplateById(tplId, env);
      if (!tpl) return;
      const keyboard = {
        inline_keyboard: [
          ...JSON.parse(tpl.buttons_json),
          [{ text: t('btn_forward', lang), switch_inline_query: tpl.id }]
        ]
      };
      return sendMessageWithKeyboard(env.BOT_TOKEN, chatId, `📦 ${tpl.name}`, keyboard);
    }
    case 'delete': {
      await deleteTemplate(tplId, user.id, env);
      return sendMessage(env.BOT_TOKEN, chatId, t('template_deleted', lang));
    }
    case 'like': {
      await toggleTemplateLike(tplId, user.id, env);
      return;
    }
    case 'public': {
      // 公开/取消公开模板
      const { toggleTemplatePublic } = await import('../services/template.js');
      await toggleTemplatePublic(tplId, user.id, env);
      return sendMessage(env.BOT_TOKEN, chatId, t('template_visibility_updated', lang));
    }
  }
}

// ─────────────────────────────────────────────────────────
// 设置
// ─────────────────────────────────────────────────────────

async function handleSettings(args, chatId, msgId, user, env) {
  const [key, value] = args;
  const lang = user.language_code;
  const { updateUserPreference } = await import('../services/user.js');

  switch (key) {
    case 'ai':
      await updateUserPreference(user.id, 'preferred_ai', value, env);
      return sendMessage(env.BOT_TOKEN, chatId, t('setting_saved', lang, { key: 'AI引擎', value }));
    case 'lang':
      await updateUserPreference(user.id, 'language_code', value, env);
      return sendMessage(env.BOT_TOKEN, chatId, t('setting_saved', value, { key: '语言', value }));
    case 'style':
      await updateUserPreference(user.id, 'preferred_style', value, env);
      return sendMessage(env.BOT_TOKEN, chatId, t('setting_saved', lang, { key: '风格', value }));

    case 'export': {
      const { exportUserData } = await import('../services/extras.js');
      const { sendDocument } = await import('../services/telegram.js');
      const data = await exportUserData(user.id, env);
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      await sendDocument(env.BOT_TOKEN, chatId, blob, 'my_data.json',
        lang === 'zh' ? '📦 您的数据导出文件' : '📦 Your data export'
      );
      return;
    }

    case 'clear_history': {
      // 二次确认
      return sendMessageWithKeyboard(env.BOT_TOKEN, chatId,
        lang === 'zh' ? '⚠️ 确认清空所有历史记录？此操作不可撤销。' : '⚠️ Clear all history? This cannot be undone.',
        { inline_keyboard: [[
          { text: lang === 'zh' ? '✅ 确认清空' : '✅ Confirm', callback_data: 'set:clear_history_confirm' },
          { text: lang === 'zh' ? '❌ 取消' : '❌ Cancel', callback_data: 'menu:main' }
        ]]}
      );
    }

    case 'clear_history_confirm': {
      const { deleteHistory } = await import('../services/history.js');
      await deleteHistory(user.id, env);
      return sendMessage(env.BOT_TOKEN, chatId, lang === 'zh' ? '✅ 历史记录已清空' : '✅ History cleared');
    }
  }
}

// ─────────────────────────────────────────────────────────
// 管理员操作
// ─────────────────────────────────────────────────────────

async function handleAdminAction(args, chatId, msgId, query, user, env) {
  const [action, targetId, param] = args;
  const lang = user.language_code;
  const { logAdminAction } = await import('../services/adminLog.js');

  switch (action) {
    case 'panel':
      return editMessageKeyboard(
        env.BOT_TOKEN, chatId, msgId,
        t('admin_panel', lang),
        buildAdminMenu(lang)
      );

    case 'users': {
      // 显示最近用户列表
      const { results } = await env.DB.prepare(
        'SELECT id, username, first_name, plan, daily_calls_used, is_banned FROM users ORDER BY created_at DESC LIMIT 10'
      ).all();
      const lines = results.map(u =>
        `${u.is_banned ? '🚫' : '👤'} ${u.first_name || '?'} (@${u.username || u.id}) · ${u.plan} · ${u.daily_calls_used}次`
      ).join('\n');
      const keyboard = {
        inline_keyboard: [
          [{ text: '🔍 搜索用户', callback_data: 'admin:users_search' }],
          [{ text: '🔙 返回', callback_data: 'admin:panel' }]
        ]
      };
      return sendMessageWithKeyboard(env.BOT_TOKEN, chatId, `👥 最近注册用户\n\n${lines || '暂无用户'}`, keyboard);
    }

    case 'logs': {
      const { getAdminLogs } = await import('../services/adminLog.js');
      const logs = await getAdminLogs(env, { limit: 10 });
      const lines = logs.map(l =>
        `[${new Date(l.created_at * 1000).toLocaleDateString('zh-CN')}] ${l.action} → ${l.target_id || '-'}`
      ).join('\n');
      return sendMessage(env.BOT_TOKEN, chatId,
        `📋 操作日志（最近10条）\n\n${lines || '暂无记录'}`
      );
    }

    case 'templates': {
      // 待审核的公开模板
      const { results } = await env.DB.prepare(
        'SELECT t.id, t.name, t.use_count, u.username FROM templates t LEFT JOIN users u ON t.user_id=u.id WHERE t.is_public=1 ORDER BY t.created_at DESC LIMIT 10'
      ).all();
      const lines = results.map(t => `📦 ${t.name} (@${t.username || '?'}) · ${t.use_count}次使用`).join('\n');
      const keyboard = {
        inline_keyboard: [
          [{ text: '🔙 返回', callback_data: 'admin:panel' }]
        ]
      };
      return sendMessageWithKeyboard(env.BOT_TOKEN, chatId, `🗂 公开模板列表\n\n${lines || '暂无模板'}`, keyboard);
    }

    case 'subscriptions': {
      const { results } = await env.DB.prepare(
        `SELECT s.*, u.username FROM subscriptions s LEFT JOIN users u ON s.user_id=u.id WHERE s.status='active' ORDER BY s.created_at DESC LIMIT 10`
      ).all();
      const lines = results.map(s =>
        `💳 @${s.username || s.user_id} · ${s.plan} · 到期 ${new Date(s.expires_at * 1000).toLocaleDateString('zh-CN')}`
      ).join('\n');
      return sendMessage(env.BOT_TOKEN, chatId, `💰 活跃订阅（最近10条）\n\n${lines || '暂无订阅'}`);
    }

    case 'ban':
      await banUser(targetId, '管理员操作', env);
      await logAdminAction(user.id, 'ban_user', targetId, env);
      return sendMessage(env.BOT_TOKEN, chatId, t('admin_ban_success', lang, { id: targetId }));

    case 'unban':
      await unbanUser(targetId, env);
      await logAdminAction(user.id, 'unban_user', targetId, env);
      return sendMessage(env.BOT_TOKEN, chatId, t('admin_unban_success', lang, { id: targetId }));

    case 'reset_quota':
      await resetUserQuota(targetId, env);
      await logAdminAction(user.id, 'reset_quota', targetId, env);
      return sendMessage(env.BOT_TOKEN, chatId, t('admin_quota_reset', lang, { id: targetId }));

    case 'set_pro':
      await setUserPlan(targetId, 'pro', 30, env);
      await logAdminAction(user.id, 'set_pro', targetId, env);
      return sendMessage(env.BOT_TOKEN, chatId, t('admin_plan_set', lang, { id: targetId, plan: 'Pro' }));

    case 'broadcast_start':
      await env.BOT_KV.put(
        `state:${user.id}`,
        JSON.stringify({ action: 'awaiting_broadcast' }),
        { expirationTtl: 600 }
      );
      return sendMessage(env.BOT_TOKEN, chatId, t('admin_broadcast_prompt', lang));

    case 'stats':
      const stats = await getSystemStats(env);
      return sendMessage(env.BOT_TOKEN, chatId, formatStats(stats, lang));

    case 'ai_cost': {
      const { getAICostStats, formatCostStats } = await import('../services/extras.js');
      const costStats = await getAICostStats(env, 7);
      return sendMessage(env.BOT_TOKEN, chatId, formatCostStats(costStats, lang));
    }

    case 'growth': {
      const { getUserGrowthStats, formatGrowthStats } = await import('../services/extras.js');
      const growth = await getUserGrowthStats(env, 14);
      return sendMessage(env.BOT_TOKEN, chatId, formatGrowthStats(growth, lang), { parse_mode: 'HTML' });
    }

    case 'reports': {
      const { getPendingReports, formatReportsForAdmin } = await import('../services/extras.js');
      const reports = await getPendingReports(env);
      const text = formatReportsForAdmin(reports);
      const keyboard = reports.length ? {
        inline_keyboard: reports.slice(0, 5).map(r => ([
          { text: `✅ #${r.id} 通过`, callback_data: `admin:report_resolve:${r.id}` },
          { text: `❌ 驳回`, callback_data: `admin:report_dismiss:${r.id}` }
        ]))
      } : undefined;
      return sendMessageWithKeyboard(env.BOT_TOKEN, chatId, text, keyboard || { inline_keyboard: [] });
    }

    case 'report_resolve': {
      const { resolveReport } = await import('../services/extras.js');
      await resolveReport(targetId, user.id, 'resolved', env);
      return sendMessage(env.BOT_TOKEN, chatId, `✅ 举报 #${targetId} 已处理`);
    }

    case 'report_dismiss': {
      const { resolveReport } = await import('../services/extras.js');
      await resolveReport(targetId, user.id, 'dismissed', env);
      return sendMessage(env.BOT_TOKEN, chatId, `✅ 举报 #${targetId} 已驳回`);
    }

    case 'maintenance_on': {
      const { setMaintenanceMode } = await import('../services/extras.js');
      await env.BOT_KV.put(`state:${user.id}`, JSON.stringify({ action: 'awaiting_maintenance_reason' }), { expirationTtl: 300 });
      return sendMessage(env.BOT_TOKEN, chatId, '请输入维护原因（将显示给用户）：');
    }

    case 'maintenance_off': {
      const { setMaintenanceMode } = await import('../services/extras.js');
      await setMaintenanceMode(false, '', env);
      await logAdminAction(user.id, 'maintenance_off', '', env);
      return sendMessage(env.BOT_TOKEN, chatId, '✅ 维护模式已关闭，Bot 恢复正常服务');
    }

    case 'flags': {
      const { listFeatureFlags } = await import('../services/extras.js');
      const flags = await listFeatureFlags(env);
      const lines = Object.entries(flags).map(([k, v]) => `${v ? '🟢' : '🔴'} ${k}`).join('\n');
      const keyboard = {
        inline_keyboard: Object.entries(flags).map(([k, v]) => ([{
          text: `${v ? '关闭' : '开启'} ${k}`,
          callback_data: `admin:flag_toggle:${k}`
        }]))
      };
      return sendMessageWithKeyboard(env.BOT_TOKEN, chatId, `⚙️ 功能开关\n\n${lines}`, keyboard);
    }

    case 'flag_toggle': {
      const { listFeatureFlags, setFeatureFlag } = await import('../services/extras.js');
      const flags = await listFeatureFlags(env);
      const current = flags[targetId] ?? false;
      await setFeatureFlag(targetId, !current, env);
      await logAdminAction(user.id, 'flag_toggle', targetId, env, String(!current));
      return sendMessage(env.BOT_TOKEN, chatId, `✅ 功能 ${targetId} 已${!current ? '开启' : '关闭'}`);
    }

    case 'whitelist_add': {
      const { addToWhitelist } = await import('../services/extras.js');
      await addToWhitelist(targetId, env);
      await logAdminAction(user.id, 'whitelist_add', targetId, env);
      return sendMessage(env.BOT_TOKEN, chatId, `✅ 用户 ${targetId} 已加入白名单`);
    }

    case 'whitelist_remove': {
      const { removeFromWhitelist } = await import('../services/extras.js');
      await removeFromWhitelist(targetId, env);
      await logAdminAction(user.id, 'whitelist_remove', targetId, env);
      return sendMessage(env.BOT_TOKEN, chatId, `✅ 用户 ${targetId} 已移出白名单`);
    }
  }
}

// ─────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────

async function buildQuotaText(user, lang, env) {
  const { getUserQuota } = await import('../services/user.js');
  const quota = await getUserQuota(user, env);
  return t('quota_info', lang, {
    plan: user.plan,
    used: quota.used,
    limit: quota.limit,
    remaining: quota.remaining
  });
}

function buildBackKeyboard(lang) {
  return {
    inline_keyboard: [[{ text: t('btn_back', lang), callback_data: 'menu:main' }]]
  };
}

async function getSystemStats(env) {
  const [totalUsers, totalGens, todayGens] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as c FROM users').first(),
    env.DB.prepare('SELECT COUNT(*) as c FROM generations').first(),
    env.DB.prepare(
      'SELECT COUNT(*) as c FROM generations WHERE created_at > unixepoch() - 86400'
    ).first()
  ]);
  return {
    totalUsers: totalUsers?.c || 0,
    totalGens: totalGens?.c || 0,
    todayGens: todayGens?.c || 0
  };
}

function formatStats(stats, lang) {
  return `📊 系统统计\n\n👥 总用户: ${stats.totalUsers}\n🔧 总生成: ${stats.totalGens}\n📈 今日生成: ${stats.todayGens}`;
}

async function getTemplateById(id, env) {
  return env.DB.prepare('SELECT * FROM templates WHERE id = ?').bind(id).first();
}
