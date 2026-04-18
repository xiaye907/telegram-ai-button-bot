/**
 * 生成历史记录服务
 */

/**
 * 生成 xxxx-xxxx-xxxx-xxxx 格式的任务 ID
 */
function generateTaskId() {
  const seg = () => Math.random().toString(36).slice(2, 6).padEnd(4, '0').slice(0, 4);
  return `${seg()}-${seg()}-${seg()}-${seg()}`;
}

export async function saveGeneration(userId, prompt, result, env) {
  // 如果 result.id 不是任务ID格式，生成一个新的
  const taskId = result.taskId || generateTaskId();
  result.taskId = taskId;

  await env.DB.prepare(`
    INSERT OR IGNORE INTO generations (id, user_id, prompt, ai_engine, buttons_json, tokens_used, created_at)
    VALUES (?, ?, ?, ?, ?, ?, unixepoch())
  `).bind(
    taskId,
    userId,
    prompt,
    result.engine,
    JSON.stringify(result.buttons),
    result.tokensUsed || 0
  ).run();

  return taskId;
}

export async function getGenerationById(id, env) {
  return env.DB.prepare(
    'SELECT * FROM generations WHERE id=?'
  ).bind(id).first();
}

export async function getHistory(userId, env, { limit = 10, offset = 0 } = {}) {
  const { results } = await env.DB.prepare(`
    SELECT * FROM generations WHERE user_id=?
    ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).bind(userId, limit, offset).all();
  return results;
}

export async function deleteHistory(userId, env) {
  await env.DB.prepare(
    'DELETE FROM generations WHERE user_id=?'
  ).bind(userId).run();
}
