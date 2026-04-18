/**
 * Inline Query 处理器
 * - 支持任务ID直接查询（xxxx-xxxx-xxxx-xxxx）
 * - 空查询返回最近历史
 * - 关键词在内存中过滤，不走数据库 LIKE
 * - KV 预缓存用户历史，首次加载后极速响应
 */

import { answerInlineQuery } from '../services/telegram.js';
import { getGenerationById, getHistory } from '../services/history.js';
import { t } from '../utils/i18n.js';

const TASK_ID_RE = /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i;
const CACHE_TTL  = 120; // 秒，历史缓存有效期

export async function handleInlineQuery(query, user, env) {
  const queryText = query.query.trim();
  const lang      = user.language_code || 'zh';
  const offset    = parseInt(query.offset || '0');

  // 立即响应空结果,避免超时
  const respondQuickly = async (results) => {
    try {
      await answerInlineQuery(env.BOT_TOKEN, query.id, results, {
        cache_time:  5,
        is_personal: true,
        next_offset: results.length >= 15 ? String(offset + 15) : ''
      });
    } catch (err) {
      console.error('[Inline] Response error:', err);
    }
  };

  try {
    let results = [];

    // ── 支持 @botusername ID 格式解析 ─────────────────
    let taskId = queryText;
    const atMatch = queryText.match(/@\w+\s+([a-z0-9-]+)/i);
    if (atMatch) {
      taskId = atMatch[1];
    }

    if (TASK_ID_RE.test(taskId)) {
      // ── 精确任务 ID 查询 ─────────────────────────────
      const gen = await Promise.race([
        getGenerationById(taskId, env),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]);

      if (gen && gen.user_id === user.id) {
        results = [buildResult(gen, lang)];
      } else {
        results = [buildNotFound(taskId, lang)];
      }
      return respondQuickly(results);
    }

    // ── 读取历史（优先从 KV 缓存）────────────────────
    const cacheKey = `inline_history:${user.id}`;
    let history = null;

    const cached = await env.BOT_KV.get(cacheKey);
    if (cached) {
      history = JSON.parse(cached);
    } else {
      // 限时获取历史,避免超时
      history = await Promise.race([
        getHistory(user.id, env, { limit: 50 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]).catch(() => []);

      // 异步写缓存
      if (history.length > 0) {
        env.BOT_KV.put(cacheKey, JSON.stringify(history), { expirationTtl: CACHE_TTL });
      }
    }

    if (!queryText) {
      // 空查询 → 最近15条
      results = history.slice(offset, offset + 15).map(g => buildResult(g, lang));
    } else {
      // 关键词过滤
      const kw = queryText.toLowerCase().slice(0, 40);
      const filtered = history
        .filter(g => g.prompt && g.prompt.toLowerCase().includes(kw))
        .slice(offset, offset + 15);
      results = filtered.map(g => buildResult(g, lang));
    }

    // 如果没有结果，给出引导提示
    if (!results.length && offset === 0) {
      results = [buildGuide(queryText, lang)];
    }

    await respondQuickly(results);

  } catch (err) {
    console.error('[Inline] Error:', err);
    await answerInlineQuery(env.BOT_TOKEN, query.id, [], { cache_time: 1 }).catch(() => {});
  }
}

// ── 构建单条内联结果 ──────────────────────────────────

function buildResult(gen, lang) {
  const buttons  = safeParseJSON(gen.buttons_json, []);
  const btnCount = buttons.flat().length;
  const taskId   = gen.id;
  const zh       = lang === 'zh';

  // 清理文本,确保UTF-8兼容
  const cleanPrompt = sanitizeText(gen.prompt || '');

  return {
    type:  'article',
    id:    `gen_${taskId}`,
    title: truncate(cleanPrompt, 60) || '(无标题)',
    description: zh
      ? `🆔 ${taskId}  ·  共 ${btnCount} 个按钮`
      : `🆔 ${taskId}  ·  ${btnCount} buttons`,
    input_message_content: {
      message_text: cleanPrompt ? `📋 <b>${cleanPrompt}</b>` : (zh ? '📋 按钮组' : '📋 Button Set'),
      parse_mode: 'HTML'
    },
    reply_markup: {
      inline_keyboard: buttons.length
        ? buttons
        : [[{ text: zh ? '🔗 查看原始内容' : '🔗 View', url: 'https://t.me' }]]
    }
  };
}

// ── 任务ID未找到时的提示 ────────────────────────────

function buildNotFound(taskId, lang) {
  const zh = lang === 'zh';
  return {
    type:  'article',
    id:    'not_found',
    title: zh ? '未找到该任务' : 'Task not found',
    description: zh
      ? `找不到任务 ${taskId}，可能已过期或不属于你`
      : `Task ${taskId} not found or not yours`,
    input_message_content: {
      message_text: zh
        ? `❌ 任务 <code>${taskId}</code> 未找到`
        : `❌ Task <code>${taskId}</code> not found`,
      parse_mode: 'HTML'
    }
  };
}

// ── 无结果时的引导提示 ──────────────────────────────

function buildGuide(kw, lang) {
  const zh = lang === 'zh';
  return {
    type:  'article',
    id:    'guide',
    title: zh ? `没有找到「${kw}」相关按钮` : `No results for "${kw}"`,
    description: zh
      ? '回到机器人生成更多按钮，再来这里转发'
      : 'Generate more buttons in the bot, then forward here',
    input_message_content: {
      message_text: zh
        ? '💡 在机器人对话中发送文字即可生成按钮，生成后点「📤 转发」选择目标对话。'
        : '💡 Send text to the bot to generate buttons, then click "📤 Forward".',
      parse_mode: 'HTML'
    }
  };
}

// ── 工具函数 ────────────────────────────────────────

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length <= maxLen ? str : str.slice(0, maxLen - 1) + '…';
}

function sanitizeText(text) {
  if (!text) return '';
  // 移除非UTF-8字符和控制字符
  return text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '')
             .replace(/[\uD800-\uDFFF]/g, '');
}
