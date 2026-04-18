/**
 * 按钮生成核心服务
 * 对接 DeepSeek 和 豆包(Doubao) API
 */

const DOUBAO_BASE = 'https://ark.cn-beijing.volces.com/api/v3';

/**
 * 生成 xxxx-xxxx-xxxx-xxxx 格式任务 ID
 */
function generateTaskId() {
  const seg = () => Math.random().toString(36).slice(2, 6).padEnd(4, '0').slice(0, 4);
  return `${seg()}-${seg()}-${seg()}-${seg()}`;
}

/**
 * 主生成函数
 */
export async function generateButtons(prompt, user, env) {
  const engine = user.preferred_ai || 'doubao';
  const style  = user.preferred_style || 'default';
  const lang   = user.language_code || 'zh';

  // KV 缓存
  const cacheKey = `gen_cache:${hashString(prompt + engine)}`;
  const cached = await env.BOT_KV.get(cacheKey);
  if (cached) {
    const result = JSON.parse(cached);
    result.fromCache = true;
    return result;
  }

  const systemPrompt = buildSystemPrompt(lang, style);
  const userPrompt   = `请根据以下描述生成 Telegram 按钮:\n\n${prompt}`;

  let aiResult;
  let tokensUsed = 0;

  try {
    aiResult = await callDoubao(systemPrompt, userPrompt, env);
    tokensUsed = aiResult.tokensUsed || 0;
  } catch (err) {
    console.error(`[ButtonGen] Doubao failed:`, err.message);
    await recordAIFailure('doubao', env);
    throw new Error('AI生成失败,请稍后重试');
  }

  const parsed = parseAIResponse(aiResult.content, prompt);
  const taskId = generateTaskId();

  const result = {
    id:         taskId,
    taskId:     taskId,
    buttons:    parsed.buttons,
    message:    parsed.message,
    engine:     aiResult.engine,
    tokensUsed,
    createdAt:  Date.now()
  };

  await env.BOT_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 300 });
  return result;
}

// ── 豆包 ────────────────────────────────────────────────

async function callDoubao(system, userMsg, env) {
  const res = await fetch(`${DOUBAO_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.DOUBAO_API_KEY}`
    },
    body: JSON.stringify({
      model: 'doubao-seed-2-0-pro-260215',
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: userMsg }
      ],
      temperature: 0.3,
      max_tokens: 800,
      stream: false
    })
  });
  if (!res.ok) throw new Error(`Doubao API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return {
    engine:     'doubao',
    content:    data.choices[0].message.content,
    tokensUsed: data.usage?.total_tokens || 0
  };
}

// ── System Prompt ────────────────────────────────────────

function buildSystemPrompt(lang, style) {
  const isZh = lang !== 'en';
  const outputLang = isZh ? '中文（默认）' : 'English';
  return `你是一个 Telegram 内联键盘按钮生成专家。
用户描述他们想要的按钮，你需要分析并生成符合 Telegram Bot API 格式的 InlineKeyboardMarkup。

## 输出格式（严格 JSON，不要包含任何其他文字）
{
  "message": "消息正文内容",
  "buttons": [
    [{"text": "按钮文字", "url": "https://...", "style": "primary", "icon_custom_emoji_id": "5368324170671202286"}],
    [{"text": "按钮2", "url": "...", "style": "danger"}]
  ]
}

## 规则
1. buttons 是二维数组，每行是一个子数组，代表键盘一行
2. **智能选择按钮颜色** - 根据按钮用途自动选择合适的 style：
   - "danger" = 红色 → 删除、取消、拒绝、关闭、停止等负面/警告操作
   - "success" = 绿色 → 确认、购买、提交、同意、开始等正面/成功操作
   - "primary" = 蓝色 → 链接、查看、了解更多、普通操作
   - 不指定 style → 使用默认样式（中性操作）
3. **智能添加 emoji** - 根据按钮含义选择合适的 icon_custom_emoji_id：
   - 👍 = "5368324170671202286" → 赞同、好评
   - ❤️ = "5368324170671202287" → 喜欢、收藏
   - 🔥 = "5368324170671202288" → 热门、火爆
   - 🎉 = "5368324170671202289" → 庆祝、活动
   - ⭐ = "5368324170671202290" → 重要、推荐
   - 只在能增强按钮表达力时添加，不要滥用
4. URL 必须是合法 https:// 格式，用户未提供时用 https://example.com 占位
5. 按钮文字简洁有力，最多 15 个字
6. message 是消息正文，根据按钮内容生成有意义的说明文字
7. 最多 4 行，每行最多 4 个按钮
8. 所有文字默认使用${outputLang}，除非用户特别要求其他语言
9. 当前风格：${style || 'default'}

## 示例
用户："帮我做三个按钮：立即购买、了解详情、取消订单"
你应该生成：
{
  "message": "请选择操作",
  "buttons": [
    [{"text": "立即购买", "url": "https://example.com/buy", "style": "success"}],
    [{"text": "了解详情", "url": "https://example.com/info", "style": "primary"}],
    [{"text": "取消订单", "url": "https://example.com/cancel", "style": "danger"}]
  ]
}`;
}

// ── 解析 AI 返回 ─────────────────────────────────────────

function parseAIResponse(content, fallbackPrompt) {
  try {
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(cleaned);
    if (!Array.isArray(data.buttons) || !data.buttons.length) throw new Error('Invalid buttons');
    data.buttons = data.buttons
      .map(row => (Array.isArray(row) ? row : [row]).map(btn => {
        const button = {
          text: String(btn.text || '按钮').slice(0, 64),
          ...(btn.url ? { url: btn.url } : { callback_data: btn.callback_data || 'noop' })
        };
        // 添加按钮样式
        if (btn.style && ['danger', 'success', 'primary'].includes(btn.style)) {
          button.style = btn.style;
        }
        // 添加自定义 emoji
        if (btn.icon_custom_emoji_id) {
          button.icon_custom_emoji_id = btn.icon_custom_emoji_id;
        }
        return button;
      }))
      .filter(row => row.length > 0)
      .slice(0, 8);
    return { buttons: data.buttons, message: data.message || fallbackPrompt };
  } catch {
    return {
      buttons: [[{ text: fallbackPrompt.slice(0, 30), url: 'https://example.com', style: 'primary' }]],
      message: fallbackPrompt
    };
  }
}

// ── 编辑已有按钮 ─────────────────────────────────────────

export async function editButtons(genId, editInstruction, user, env) {
  const { getGenerationById } = await import('./history.js');
  const gen = await getGenerationById(genId, env);
  if (!gen) throw new Error('Generation not found');
  const prompt = `原按钮配置:\n${gen.buttons_json}\n\n用户要求修改:\n${editInstruction}`;
  return generateButtons(prompt, user, env);
}

// ── 工具函数 ─────────────────────────────────────────────

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
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
