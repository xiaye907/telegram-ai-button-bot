/**
 * 管理员 REST API
 * 路径: /api/admin/*
 * 需要 Authorization: Bearer <WEBHOOK_SECRET> 头
 */

import { jsonResponse, errorResponse } from '../utils/response.js';
import { banUser, unbanUser, resetUserQuota, setUserPlan, getAllUserIds } from '../services/user.js';
import { getAdminLogs } from '../services/adminLog.js';
import { broadcastMessage } from '../services/telegram.js';

export async function handleAdmin(request, env, ctx) {
  // 鉴权
  const auth = request.headers.get('Authorization');
  if (auth !== `Bearer ${env.WEBHOOK_SECRET}`) {
    return errorResponse('Unauthorized', 401);
  }

  const url = new URL(request.url);
  const path = url.pathname.replace('/api/admin', '');
  const method = request.method;

  try {
    // GET /api/admin/stats
    if (path === '/stats' && method === 'GET') {
      return handleStats(env);
    }

    // GET /api/admin/users
    if (path === '/users' && method === 'GET') {
      return handleListUsers(url, env);
    }

    // POST /api/admin/users/:id/ban
    if (path.match(/^\/users\/\d+\/ban$/) && method === 'POST') {
      const userId = path.split('/')[2];
      const body = await request.json().catch(() => ({}));
      await banUser(userId, body.reason || '管理员操作', env);
      return jsonResponse({ ok: true });
    }

    // POST /api/admin/users/:id/unban
    if (path.match(/^\/users\/\d+\/unban$/) && method === 'POST') {
      const userId = path.split('/')[2];
      await unbanUser(userId, env);
      return jsonResponse({ ok: true });
    }

    // POST /api/admin/users/:id/reset-quota
    if (path.match(/^\/users\/\d+\/reset-quota$/) && method === 'POST') {
      const userId = path.split('/')[2];
      await resetUserQuota(userId, env);
      return jsonResponse({ ok: true });
    }

    // POST /api/admin/users/:id/set-plan
    if (path.match(/^\/users\/\d+\/set-plan$/) && method === 'POST') {
      const userId = path.split('/')[2];
      const body = await request.json();
      await setUserPlan(userId, body.plan, body.days || 30, env);
      return jsonResponse({ ok: true });
    }

    // POST /api/admin/broadcast
    if (path === '/broadcast' && method === 'POST') {
      const body = await request.json();
      const userIds = await getAllUserIds(env, body.target || 'all');
      ctx.waitUntil(broadcastMessage(env.BOT_TOKEN, userIds, body.text));
      // 注：waitUntil 用于广播，广播是批量发送不需要等待完成再返回
      // 这里保留是合理的（广播不影响响应）
      return jsonResponse({ ok: true, recipients: userIds.length });
    }

    // GET /api/admin/logs
    if (path === '/logs' && method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const logs = await getAdminLogs(env, { limit });
      return jsonResponse({ logs });
    }


    // GET /api/admin/ai-cost
    if (path === '/ai-cost' && method === 'GET') {
      const { getAICostStats } = await import('../services/extras.js');
      const days = parseInt(url.searchParams.get('days') || '7');
      const stats = await getAICostStats(env, days);
      return jsonResponse({ stats, days });
    }

    // GET /api/admin/growth
    if (path === '/growth' && method === 'GET') {
      const { getUserGrowthStats } = await import('../services/extras.js');
      const days = parseInt(url.searchParams.get('days') || '14');
      const growth = await getUserGrowthStats(env, days);
      return jsonResponse({ growth, days });
    }

    // GET /api/admin/reports
    if (path === '/reports' && method === 'GET') {
      const { getPendingReports } = await import('../services/extras.js');
      const reports = await getPendingReports(env);
      return jsonResponse({ reports });
    }

    // POST /api/admin/flags/:name
    if (path.startsWith('/flags/') && method === 'POST') {
      const flagName = path.split('/')[2];
      const body = await request.json();
      const { setFeatureFlag } = await import('../services/extras.js');
      await setFeatureFlag(flagName, !!body.enabled, env);
      return jsonResponse({ ok: true, flag: flagName, enabled: !!body.enabled });
    }

    // GET /api/admin/flags
    if (path === '/flags' && method === 'GET') {
      const { listFeatureFlags } = await import('../services/extras.js');
      const flags = await listFeatureFlags(env);
      return jsonResponse({ flags });
    }

    // POST /api/admin/maintenance
    if (path === '/maintenance' && method === 'POST') {
      const body = await request.json();
      const { setMaintenanceMode } = await import('../services/extras.js');
      await setMaintenanceMode(body.enabled, body.reason || '系统维护中', env);
      return jsonResponse({ ok: true, enabled: body.enabled });
    }

    // POST /api/admin/whitelist/:userId
    if (path.startsWith('/whitelist/') && method === 'POST') {
      const userId = path.split('/')[2];
      const body = await request.json();
      const { addToWhitelist, removeFromWhitelist } = await import('../services/extras.js');
      if (body.action === 'remove') { await removeFromWhitelist(userId, env); }
      else { await addToWhitelist(userId, env); }
      return jsonResponse({ ok: true });
    }

    return errorResponse('Not found', 404);
  } catch (err) {
    console.error('[AdminAPI] Error:', err);
    return errorResponse(err.message, 500);
  }
}

async function handleStats(env) {
  const [users, proUsers, gens, todayGens, templates] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as c FROM users').first(),
    env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE plan != 'free'").first(),
    env.DB.prepare('SELECT COUNT(*) as c FROM generations').first(),
    env.DB.prepare('SELECT COUNT(*) as c FROM generations WHERE created_at > unixepoch()-86400').first(),
    env.DB.prepare('SELECT COUNT(*) as c FROM templates WHERE is_public=1').first()
  ]);

  return jsonResponse({
    users: { total: users?.c || 0, pro: proUsers?.c || 0 },
    generations: { total: gens?.c || 0, today: todayGens?.c || 0 },
    publicTemplates: templates?.c || 0,
    timestamp: Date.now()
  });
}

async function handleListUsers(url, env) {
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const search = url.searchParams.get('q') || '';
  const plan = url.searchParams.get('plan') || '';

  let query = 'SELECT id, username, first_name, plan, daily_calls_used, total_calls, is_banned, created_at FROM users WHERE 1=1';
  const params = [];

  if (search) {
    // 只搜索 username 和 first_name，避免三重 LIKE 过复杂
    query += ' AND (username LIKE ? OR first_name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (plan) {
    query += ' AND plan = ?';
    params.push(plan);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const { results } = await env.DB.prepare(query).bind(...params).all();
  return jsonResponse({ users: results, limit, offset });
}
