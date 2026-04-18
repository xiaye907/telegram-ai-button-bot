/**
 * Telegram 智能按钮生成机器人
 * Cloudflare Workers 主入口
 */

import { handleWebhook } from './handlers/webhook.js';
import { handleAdmin } from './handlers/admin.js';
import { handleScheduled } from './handlers/scheduled.js';
import { jsonResponse, errorResponse } from './utils/response.js';
import { SETUP_HTML } from './setup-page.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // 配置页面（浏览器打开）
      if (path === '/setup' || path === '/setup/') {
        return new Response(SETUP_HTML, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      // Telegram Webhook 入口
      if (path === '/webhook' && request.method === 'POST') {
        const body = await request.json();
        return await handleWebhook(body, env, ctx);
      }

      // 管理员 REST API
      if (path.startsWith('/api/admin')) {
        return await handleAdmin(request, env, ctx);
      }

      // 健康检查
      if (path === '/health') {
        return jsonResponse({ status: 'ok', version: '1.0.0', ts: Date.now() });
      }

      // 根路径重定向到配置页
      if (path === '/') {
        return Response.redirect(url.origin + '/setup', 302);
      }

      return new Response('Not Found', { status: 404 });
    } catch (err) {
      console.error('[Main] Unhandled error:', err);
      return errorResponse(err.message, 500);
    }
  },

  async scheduled(event, env, ctx) {
    await handleScheduled(event, env, ctx);
  }
};
