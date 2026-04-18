/**
 * Webhook 消息路由器
 */

import { handleMessage } from './message.js';
import { handleCallbackQuery } from './callback.js';
import { handleInlineQuery } from './inline.js';
import { getOrCreateUser } from '../services/user.js';
import { checkMaintenance } from '../services/extras.js';
import { t } from '../utils/i18n.js';
import { sendMessage, answerPreCheckoutQuery } from '../services/telegram.js';

export async function handleWebhook(update, env, ctx) {
  try {
    const tgUser = extractUser(update);
    if (!tgUser) return new Response('OK');

    // 并行获取用户和检查维护模式
    const [user, maintenanceMsg] = await Promise.all([
      getOrCreateUser(tgUser, env),
      checkMaintenance(env, tgUser.id, env.ADMIN_IDS)
    ]);

    // 封禁检查
    if (user.is_banned) {
      const chatId = extractChatId(update);
      if (chatId) await sendMessage(env.BOT_TOKEN, chatId, t('banned', user.language_code));
      return new Response('OK');
    }

    // 维护模式检查
    if (maintenanceMsg) {
      const chatId = extractChatId(update);
      if (chatId) await sendMessage(env.BOT_TOKEN, chatId, maintenanceMsg);
      return new Response('OK');
    }

    // 路由 — 全部直接 await，不用 waitUntil
    if (update.message) {
      if (update.message.successful_payment) {
        const { handleSuccessfulPayment } = await import('../services/extras.js');
        const payload = await handleSuccessfulPayment(update.message.successful_payment, user.id, env);
        const lang = user.language_code || 'zh';
        await sendMessage(env.BOT_TOKEN, update.message.chat.id,
          lang === 'zh'
            ? `✅ 付款成功！${payload.plan} 套餐已激活，有效期 ${payload.days} 天。`
            : `✅ Payment successful! ${payload.plan} plan active for ${payload.days} days.`
        );
      } else {
        await handleMessage(update.message, user, env);
      }
    } else if (update.pre_checkout_query) {
      await answerPreCheckoutQuery(env.BOT_TOKEN, update.pre_checkout_query.id, true);
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, user, env);
    } else if (update.inline_query) {
      await handleInlineQuery(update.inline_query, user, env);
    }

    return new Response('OK');
  } catch (err) {
    console.error('[Webhook] Error:', err);
    return new Response('OK');
  }
}

function extractUser(update) {
  return (
    update.message?.from ||
    update.callback_query?.from ||
    update.inline_query?.from ||
    null
  );
}

function extractChatId(update) {
  return (
    update.message?.chat?.id ||
    update.callback_query?.message?.chat?.id ||
    null
  );
}
