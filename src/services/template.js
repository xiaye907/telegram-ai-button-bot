/**
 * 模板服务
 */

export async function searchTemplates(query, userId, env, { limit = 20, offset = 0 } = {}) {
  const safe = query.replace(/[%_\[\]^]/g, '').slice(0, 40).trim();
  if (!safe) {
    const { results } = await env.DB.prepare(`
      SELECT * FROM templates WHERE (is_public=1 OR user_id=?)
      ORDER BY use_count DESC LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all();
    return results;
  }
  const pat = `%${safe}%`;
  const { results } = await env.DB.prepare(`
    SELECT * FROM templates
    WHERE (is_public=1 OR user_id=?) AND name LIKE ?
    ORDER BY use_count DESC LIMIT ? OFFSET ?
  `).bind(userId, pat, limit, offset).all();
  return results;
}


export async function getMyTemplates(userId, env) {
  const { results } = await env.DB.prepare(`
    SELECT * FROM templates WHERE user_id=? ORDER BY updated_at DESC
  `).bind(userId).all();
  return results;
}

export async function getPublicTemplates(env, { limit = 20, offset = 0, tag = '' } = {}) {
  let query = 'SELECT * FROM templates WHERE is_public=1';
  const params = [];
  if (tag) { query += ' AND tags LIKE ?'; params.push(`%${tag}%`); }
  query += ' ORDER BY use_count DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results;
}

export async function saveTemplate({ userId, name, generationId, env }) {
  const { getGenerationById } = await import('./history.js');
  const gen = await getGenerationById(generationId, env);
  if (!gen || gen.user_id !== userId) throw new Error('Generation not found');

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
  await env.DB.prepare(`
    INSERT OR IGNORE INTO templates (id, user_id, name, buttons_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, unixepoch(), unixepoch())
  `).bind(id, userId, name, gen.buttons_json).run();
  return id;
}

export async function deleteTemplate(id, userId, env) {
  await env.DB.prepare(
    'DELETE FROM templates WHERE id=? AND user_id=?'
  ).bind(id, userId).run();
}

export async function toggleTemplateLike(tplId, userId, env) {
  const key = `like:${userId}:${tplId}`;
  const liked = await env.BOT_KV.get(key);
  if (liked) {
    await env.BOT_KV.delete(key);
    await env.DB.prepare(
      'UPDATE templates SET like_count=MAX(0,like_count-1) WHERE id=?'
    ).bind(tplId).run();
  } else {
    await env.BOT_KV.put(key, '1', { expirationTtl: 86400 * 365 });
    await env.DB.prepare(
      'UPDATE templates SET like_count=like_count+1 WHERE id=?'
    ).bind(tplId).run();
  }
}

export async function toggleTemplatePublic(id, userId, env) {
  await env.DB.prepare(`
    UPDATE templates SET is_public = CASE WHEN is_public=1 THEN 0 ELSE 1 END
    WHERE id=? AND user_id=?
  `).bind(id, userId).run();
}

export async function incrementTemplateUseCount(id, env) {
  await env.DB.prepare(
    'UPDATE templates SET use_count=use_count+1 WHERE id=?'
  ).bind(id).run();
}
