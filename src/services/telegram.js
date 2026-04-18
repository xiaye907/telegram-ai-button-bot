/**
 * Telegram Bot API 封装
 * 所有与 Telegram 通信的函数集中在此
 */

const TG_BASE = 'https://api.telegram.org/bot';

/**
 * 通用 API 调用
 */
async function tgApi(token, method, body = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10秒超时

  try {
    const res = await fetch(`${TG_BASE}${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timeout);
    const data = await res.json();
    if (!data.ok) {
      console.error(`[TG API] ${method} failed:`, data.description);
    }
    return data;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      console.error(`[TG API] ${method} timeout`);
    }
    throw err;
  }
}

/**
 * 发送普通消息
 */
export async function sendMessage(token, chatId, text, extra = {}) {
  return tgApi(token, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...extra
  });
}

/**
 * 发送带内联键盘的消息
 */
export async function sendMessageWithKeyboard(token, chatId, text, keyboard, extra = {}) {
  return tgApi(token, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup: keyboard,
    ...extra
  });
}

/**
 * 编辑消息文本+键盘
 */
export async function editMessageKeyboard(token, chatId, msgId, text, keyboard) {
  return tgApi(token, 'editMessageText', {
    chat_id: chatId,
    message_id: msgId,
    text,
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

/**
 * 仅编辑文本（无键盘）
 */
export async function editMessageText(token, chatId, msgId, text) {
  return tgApi(token, 'editMessageText', {
    chat_id: chatId,
    message_id: msgId,
    text,
    parse_mode: 'HTML'
  });
}

/**
 * 仅编辑键盘
 */
export async function editReplyMarkup(token, chatId, msgId, keyboard) {
  return tgApi(token, 'editMessageReplyMarkup', {
    chat_id: chatId,
    message_id: msgId,
    reply_markup: keyboard
  });
}

/**
 * 删除消息
 */
export async function deleteMessage(token, chatId, msgId) {
  return tgApi(token, 'deleteMessage', {
    chat_id: chatId,
    message_id: msgId
  });
}

/**
 * 回应 Callback Query
 */
export async function answerCallback(token, queryId, text = '', showAlert = false) {
  return tgApi(token, 'answerCallbackQuery', {
    callback_query_id: queryId,
    text,
    show_alert: showAlert
  });
}

/**
 * 回应 Inline Query
 */
export async function answerInlineQuery(token, queryId, results, extra = {}) {
  return tgApi(token, 'answerInlineQuery', {
    inline_query_id: queryId,
    results,
    cache_time: extra.cache_time || 300,
    is_personal: extra.is_personal !== false,
    next_offset: extra.next_offset || ''
  });
}

/**
 * 向多个用户广播消息 (带速率限制)
 */
export async function broadcastMessage(token, userIds, text, keyboard = null, delayMs = 50) {
  const results = { success: 0, failed: 0, errors: [] };

  for (const userId of userIds) {
    try {
      const body = { chat_id: userId, text, parse_mode: 'HTML' };
      if (keyboard) body.reply_markup = keyboard;
      const res = await tgApi(token, 'sendMessage', body);
      if (res.ok) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push({ userId, error: res.description });
      }
    } catch (err) {
      results.failed++;
      results.errors.push({ userId, error: err.message });
    }
    // 遵守 Telegram 速率限制: 30msg/s (全局), 1msg/s (每个群)
    await new Promise(r => setTimeout(r, delayMs));
  }

  return results;
}

/**
 * 设置 Bot 命令列表
 */
export async function setMyCommands(token, commands, languageCode = '') {
  return tgApi(token, 'setMyCommands', {
    commands,
    language_code: languageCode
  });
}

/**
 * 发送文件（document）
 */
export async function sendDocument(token, chatId, fileBlob, filename, caption = '') {
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('document', fileBlob, filename);
  if (caption) { form.append('caption', caption); form.append('parse_mode', 'HTML'); }
  const res = await fetch(`${TG_BASE}${token}/sendDocument`, { method: 'POST', body: form });
  return res.json();
}

/**
 * 发送 Telegram Stars 发票
 */
export async function sendInvoiceTg(token, chatId, payload) {
  return tgApi(token, 'sendInvoice', payload);
}

/**
 * 应答支付预检
 */
export async function answerPreCheckoutQuery(token, queryId, ok = true, errorMessage = '') {
  const body = { pre_checkout_query_id: queryId, ok };
  if (!ok && errorMessage) body.error_message = errorMessage;
  return tgApi(token, 'answerPreCheckoutQuery', body);
}


/**
 * 获取 Bot 信息
 */
export async function getMe(token) {
  const res = await fetch(`${TG_BASE}${token}/getMe`);
  return res.json();
}
