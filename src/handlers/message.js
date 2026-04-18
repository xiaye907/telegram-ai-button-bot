/**
 * 消息处理器
 * 处理用户发送的文本消息和命令
 */

import { sendMessage, sendMessageWithKeyboard } from '../services/telegram.js';
import { generateButtons } from '../services/buttonGenerator.js';
import { getUserQuota, decrementQuota } from '../services/user.js';
import { saveGeneration, getHistory } from '../services/history.js';
import { searchTemplates, getMyTemplates, saveTemplate } from '../services/template.js';
import { buildMainMenu, buildSettingsMenu, buildHistoryMenu, buildTemplateMenu } from '../utils/keyboards.js';
import { t } from '../utils/i18n.js';
import { isAdmin } from '../utils/security.js';

export async function handleMessage(msg, user, env) {
  const chatId = msg.chat.id;
  const text = msg.text || '';
  const lang = user.language_code || 'zh';

  // ── 命令路由 ──────────────────────────────────────────
  if (text.startsWith('/')) {
    return handleCommand(text, chatId, user, env, msg);
  }

  // ── 检查用户状态(等待输入) ──────────────────────────────
  const state = await getState(user.id, env);

  if (state?.action === 'awaiting_template_name') {
    return handleSaveTemplateName(text, chatId, user, state, env);
  }
  if (state?.action === 'awaiting_broadcast') {
    return handleBroadcastContent(text, chatId, user, env);
  }
  if (state?.action === 'awaiting_maintenance_reason') {
    return handleMaintenanceReason(text, chatId, user, env);
  }
  if (state?.action === 'awaiting_ban_target') {
    return handleBanTarget(text, chatId, user, env);
  }

  // ── 普通文本 → AI按钮生成 ───────────────────────────────
  return handleGenerateButtons(text, chatId, user, env, msg);
}

// ─────────────────────────────────────────────────────────
// 命令处理
// ─────────────────────────────────────────────────────────

async function handleCommand(text, chatId, user, env, msg) {
  const cmd = text.split(' ')[0].toLowerCase().replace(`@${env.BOT_USERNAME}`, '');
  const lang = user.language_code;

  switch (cmd) {
    case '/start':
      return handleStart(chatId, user, env);
    case '/help':
      return sendMessage(env.BOT_TOKEN, chatId, t('help_text', lang));
    case '/menu':
      return sendMessageWithKeyboard(env.BOT_TOKEN, chatId, t('menu_title', lang), buildMainMenu(lang));
    case '/quota':
      return handleQuota(chatId, user, env);
    case '/history':
      return handleHistory(chatId, user, env);
    case '/templates':
      return handleTemplates(chatId, user, env);
    case '/settings':
      return sendMessageWithKeyboard(env.BOT_TOKEN, chatId, t('settings_title', lang), buildSettingsMenu(user, lang));
    case '/cancel':
      await clearState(user.id, env);
      return sendMessage(env.BOT_TOKEN, chatId, t('cancelled', lang));
    case '/admin':
      if (isAdmin(user.id, env)) return handleAdminPanel(chatId, user, env);
      return sendMessage(env.BOT_TOKEN, chatId, t('no_permission', lang));
    default:
      return sendMessage(env.BOT_TOKEN, chatId, t('unknown_command', lang));
  }
}

// ─────────────────────────────────────────────────────────
// /start
// ─────────────────────────────────────────────────────────

async function handleStart(chatId, user, env) {
  const lang = user.language_code;
  const welcomeText = t('welcome', lang, { name: user.first_name });
  const keyboard = buildMainMenu(lang);
  return sendMessageWithKeyboard(env.BOT_TOKEN, chatId, welcomeText, keyboard);
}

// ─────────────────────────────────────────────────────────
// 核心功能: AI 生成按钮
// ─────────────────────────────────────────────────────────

async function handleGenerateButtons(text, chatId, user, env, msg) {
  const lang = user.language_code;

  // 检查额度
  const quota = await getUserQuota(user, env);
  if (quota.remaining <= 0) {
    return sendMessageWithKeyboard(
      env.BOT_TOKEN, chatId,
      t('quota_exceeded', lang),
      {
        inline_keyboard: [[
          { text: t('btn_upgrade', lang), callback_data: 'menu:upgrade' },
          { text: t('btn_quota_info', lang), callback_data: 'menu:quota' }
        ]]
      }
    );
  }

  // 发送初始进度消息
  const progressMsg = await sendMessage(env.BOT_TOKEN, chatId,
    lang === 'zh'
      ? '⏳ 正在理解您的需求...'
      : '⏳ Understanding your request...'
  );
  const pmId = progressMsg?.result?.message_id;

  // 进度更新工具函数
  const updateProgress = async (step, total, text) => {
    if (!pmId) return;
    const bar = '█'.repeat(step) + '░'.repeat(total - step);
    const pct = Math.round((step / total) * 100);
    const { editMessageText } = await import('../services/telegram.js');
    await editMessageText(env.BOT_TOKEN, chatId, pmId,
      `${text}\n\n[${bar}] ${pct}%`
    );
  };

  try {
    await updateProgress(1, 3,
      lang === 'zh' ? '🤖 AI 生成中，请稍候...' : '🤖 AI generating, please wait...'
    );

    // 调用 AI 生成按钮
    const result = await generateButtons(text, user, env);

    await updateProgress(2, 3,
      lang === 'zh' ? '✨ 整理结果...' : '✨ Formatting result...'
    );

    // 扣减额度 & 保存历史
    await Promise.all([
      decrementQuota(user.id, env),
      saveGeneration(user.id, text, result, env)
    ]);

    // 构建预览键盘
    const previewKeyboard = buildPreviewKeyboard(result, lang);
    const caption = t('preview_ready', lang, {
      text: (result.message || text).slice(0, 60),
      count: result.buttons.flat().length,
      engine: result.engine
    });

    // 用最终结果替换进度消息
    const { editMessageKeyboard } = await import('../services/telegram.js');
    await editMessageKeyboard(env.BOT_TOKEN, chatId, pmId, caption, previewKeyboard);

  } catch (err) {
    console.error('[Generate] Error:', err);
    const { editMessageKeyboard } = await import('../services/telegram.js');
    await editMessageKeyboard(env.BOT_TOKEN, chatId, pmId,
      lang === 'zh'
        ? `❌ 生成失败，请稍后重试\n\n原因: ${err.message?.slice(0, 100) || '未知错误'}`
        : `❌ Failed, please retry\n\n${err.message?.slice(0, 100) || 'Unknown error'}`,
      { inline_keyboard: [[{ text: '🔄 重试', callback_data: `regen_text:${encodeURIComponent(text.slice(0,50))}` }]] }
    );
  }
}

// 构建预览键盘：包含生成的按钮 + 操作行
function buildPreviewKeyboard(result, lang) {
  const genId = result.id || result.taskId;
  return {
    inline_keyboard: [
      ...result.buttons,
      [
        { text: t('btn_forward', lang), switch_inline_query: genId },
        { text: t('btn_save_tpl', lang), callback_data: `save:${genId}` }
      ],
      [
        { text: t('btn_edit', lang),  callback_data: `edit:${genId}` },
        { text: t('btn_regen', lang), callback_data: `regen:${genId}` },
        { text: lang === 'zh' ? '🔗 分享' : '🔗 Share', callback_data: `share:${genId}` }
      ]
    ]
  };
}

// ─────────────────────────────────────────────────────────
// /quota
// ─────────────────────────────────────────────────────────

async function handleQuota(chatId, user, env) {
  const lang = user.language_code;
  const quota = await getUserQuota(user, env);

  const text = t('quota_info', lang, {
    plan: user.plan,
    used: quota.used,
    limit: quota.limit,
    remaining: quota.remaining,
    resetAt: quota.resetAt
  });

  const keyboard = {
    inline_keyboard: [[
      { text: t('btn_upgrade', lang), callback_data: 'menu:upgrade' }
    ]]
  };

  return sendMessageWithKeyboard(env.BOT_TOKEN, chatId, text, keyboard);
}

// ─────────────────────────────────────────────────────────
// /history
// ─────────────────────────────────────────────────────────

async function handleHistory(chatId, user, env) {
  const lang = user.language_code;
  const history = await getHistory(user.id, env, { limit: 10 });

  if (!history.length) {
    return sendMessage(env.BOT_TOKEN, chatId, t('no_history', lang));
  }

  const keyboard = buildHistoryMenu(history, lang);
  return sendMessageWithKeyboard(env.BOT_TOKEN, chatId, t('history_title', lang), keyboard);
}

// ─────────────────────────────────────────────────────────
// /templates
// ─────────────────────────────────────────────────────────

async function handleTemplates(chatId, user, env) {
  const lang = user.language_code;
  const templates = await getMyTemplates(user.id, env);

  const keyboard = buildTemplateMenu(templates, lang);
  return sendMessageWithKeyboard(
    env.BOT_TOKEN, chatId,
    t('templates_title', lang, { count: templates.length }),
    keyboard
  );
}

// ─────────────────────────────────────────────────────────
// 保存模板 - 等待用户输入名称
// ─────────────────────────────────────────────────────────

async function handleSaveTemplateName(name, chatId, user, state, env) {
  const lang = user.language_code;
  try {
    await saveTemplate({
      userId: user.id,
      name: name.trim(),
      generationId: state.generationId,
      env
    });
    await clearState(user.id, env);
    return sendMessage(env.BOT_TOKEN, chatId, t('template_saved', lang, { name }));
  } catch (err) {
    return sendMessage(env.BOT_TOKEN, chatId, t('template_save_failed', lang));
  }
}

// ─────────────────────────────────────────────────────────
// 管理员面板入口
// ─────────────────────────────────────────────────────────

async function handleAdminPanel(chatId, user, env) {
  const lang = user.language_code;
  const { buildAdminMenu } = await import('../utils/keyboards.js');
  return sendMessageWithKeyboard(
    env.BOT_TOKEN, chatId,
    t('admin_panel', lang),
    buildAdminMenu(lang)
  );
}

// ─────────────────────────────────────────────────────────
// 维护模式原因输入
// ─────────────────────────────────────────────────────────

async function handleMaintenanceReason(reason, chatId, user, env) {
  if (!isAdmin(user.id, env)) return;
  const { setMaintenanceMode } = await import('../services/extras.js');
  await setMaintenanceMode(true, reason.trim(), env);
  await clearState(user.id, env);
  return sendMessage(env.BOT_TOKEN, chatId, `🔧 维护模式已开启\n\n用户将看到：${reason}`);
}

// ─────────────────────────────────────────────────────────
// 管理员：输入用户ID进行封禁
// ─────────────────────────────────────────────────────────

async function handleBanTarget(targetId, chatId, user, env) {
  if (!isAdmin(user.id, env)) return;
  const lang = user.language_code;
  const { banUser } = await import('../services/user.js');
  const { logAdminAction } = await import('../services/adminLog.js');
  const uid = parseInt(targetId.trim());
  if (isNaN(uid)) return sendMessage(env.BOT_TOKEN, chatId, '❌ 无效的用户 ID');
  await banUser(uid, `管理员 ${user.id} 操作`, env);
  await logAdminAction(user.id, 'ban_user', uid, env);
  await clearState(user.id, env);
  return sendMessage(env.BOT_TOKEN, chatId, `✅ 用户 ${uid} 已封禁`);
}

// ─────────────────────────────────────────────────────────

async function handleBroadcastContent(text, chatId, user, env) {
  if (!isAdmin(user.id, env)) return;
  const lang = user.language_code;
  const { scheduleBroadcast } = await import('../services/broadcast.js');
  await scheduleBroadcast(text, user.id, env);
  await clearState(user.id, env);
  return sendMessage(env.BOT_TOKEN, chatId, t('broadcast_scheduled', lang));
}

// ─────────────────────────────────────────────────────────
// 状态管理 (KV)
// ─────────────────────────────────────────────────────────

async function getState(userId, env) {
  const raw = await env.BOT_KV.get(`state:${userId}`);
  return raw ? JSON.parse(raw) : null;
}

async function clearState(userId, env) {
  await env.BOT_KV.delete(`state:${userId}`);
}

async function deleteMessage(token, chatId, messageId) {
  if (!messageId) return;
  const { deleteMessage: tgDelete } = await import('../services/telegram.js');
  await tgDelete(token, chatId, messageId);
}
