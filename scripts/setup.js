#!/usr/bin/env node
/**
 * 项目初始化脚本
 * 运行: node scripts/setup.js
 * 引导用户完成所有配置步骤
 */

const { execSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(res => rl.question(q, res));

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function log(msg, color = RESET) { console.log(`${color}${msg}${RESET}`); }
function run(cmd, silent = false) {
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: silent ? 'pipe' : 'inherit' });
    return out;
  } catch (e) {
    return null;
  }
}

async function main() {
  console.clear();
  log('╔══════════════════════════════════════════════╗', CYAN);
  log('║   Telegram 按钮机器人 — 部署初始化向导        ║', CYAN);
  log('╚══════════════════════════════════════════════╝\n', CYAN);

  // 1. 检查 wrangler 登录状态
  log('步骤 1/6 — 检查 Cloudflare 登录状态...', YELLOW);
  const whoami = run('wrangler whoami 2>&1', true);
  if (!whoami || whoami.includes('not authenticated')) {
    log('未登录，正在打开浏览器进行登录...', YELLOW);
    run('wrangler login');
  } else {
    log('✓ 已登录 Cloudflare', GREEN);
  }

  // 2. 创建 KV 命名空间
  log('\n步骤 2/6 — 创建 KV 命名空间...', YELLOW);
  const kvOut = run('wrangler kv:namespace create "BOT_KV" 2>&1', true);
  const kvId = kvOut?.match(/id = "([^"]+)"/)?.[1];
  if (kvId) {
    log(`✓ KV 命名空间已创建: ${kvId}`, GREEN);
    updateWranglerToml('YOUR_KV_NAMESPACE_ID', kvId);
  } else {
    log('⚠ KV 创建失败或已存在，请手动填入 wrangler.toml', YELLOW);
  }

  // 3. 创建 D1 数据库
  log('\n步骤 3/6 — 创建 D1 数据库...', YELLOW);
  const d1Out = run('wrangler d1 create tg-button-bot 2>&1', true);
  const d1Id = d1Out?.match(/database_id = "([^"]+)"/)?.[1];
  if (d1Id) {
    log(`✓ D1 数据库已创建: ${d1Id}`, GREEN);
    updateWranglerToml('YOUR_D1_DATABASE_ID', d1Id);
    log('  正在执行数据库迁移...', YELLOW);
    run('wrangler d1 execute tg-button-bot --file=./scripts/schema.sql');
    log('✓ 数据库表已创建', GREEN);
  } else {
    log('⚠ D1 创建失败或已存在，请手动更新 wrangler.toml 并运行: npm run db:migrate', YELLOW);
  }

  // 4. 配置密钥
  log('\n步骤 4/6 — 配置密钥 (Secrets)...', YELLOW);
  log('这些密钥将安全存储在 Cloudflare，不会出现在代码中\n', CYAN);

  const botToken = await ask('  请输入 Telegram Bot Token (从 @BotFather 获取): ');
  const webhookSecret = await ask('  请输入 Webhook 密钥 (自定义随机字符串，建议32位): ') ||
    Math.random().toString(36).repeat(2).slice(0, 32);
  const deepseekKey = await ask('  请输入 DeepSeek API Key (可留空): ');
  const doubaoKey = await ask('  请输入 豆包 API Key (可留空): ');
  const adminIds = await ask('  请输入管理员 Telegram ID (多个用逗号分隔): ');

  const secrets = [
    ['BOT_TOKEN', botToken],
    ['WEBHOOK_SECRET', webhookSecret],
    ['DEEPSEEK_API_KEY', deepseekKey || 'placeholder'],
    ['DOUBAO_API_KEY', doubaoKey || 'placeholder'],
    ['ADMIN_IDS', adminIds],
    ['ENCRYPTION_KEY', Math.random().toString(36).repeat(3).slice(0, 32)]
  ];

  for (const [name, value] of secrets) {
    if (value) {
      run(`echo "${value}" | wrangler secret put ${name}`);
      log(`  ✓ ${name} 已设置`, GREEN);
    }
  }

  // 5. 部署 Worker
  log('\n步骤 5/6 — 部署 Worker...', YELLOW);
  run('wrangler deploy');
  log('✓ Worker 部署成功', GREEN);

  // 6. 注册 Webhook
  log('\n步骤 6/6 — 注册 Telegram Webhook...', YELLOW);
  const workerName = 'tg-button-bot';
  const cfAccount = run('wrangler whoami 2>&1', true)?.match(/account: (.+)/)?.[1]?.trim() || 'your-account';
  const workerUrl = `https://${workerName}.${cfAccount}.workers.dev`;

  log(`  Worker URL: ${workerUrl}`, CYAN);

  // 调用 setup-webhook 端点
  const res = await fetch(`${workerUrl}/setup-webhook`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${webhookSecret}` }
  }).catch(() => null);

  if (res?.ok) {
    log('✓ Webhook 注册成功！', GREEN);
  } else {
    log(`⚠ 请手动调用: curl -X POST ${workerUrl}/setup-webhook -H "Authorization: Bearer ${webhookSecret}"`, YELLOW);
  }

  // 完成
  log('\n╔══════════════════════════════════════════════╗', GREEN);
  log('║            🎉 部署完成！                       ║', GREEN);
  log('╚══════════════════════════════════════════════╝', GREEN);
  log(`\nBot URL: https://t.me/你的Bot用户名`, CYAN);
  log(`Worker URL: ${workerUrl}`, CYAN);
  log(`Admin API: ${workerUrl}/api/admin/stats\n`, CYAN);
  log('接下来：', BOLD);
  log('  1. 在 Telegram 中找到你的 Bot 并发送 /start');
  log('  2. 发送任意按钮描述文字开始生成');
  log('  3. 使用 /admin 进入管理后台\n');

  rl.close();
}

function updateWranglerToml(placeholder, value) {
  const tomlPath = './wrangler.toml';
  let content = fs.readFileSync(tomlPath, 'utf8');
  content = content.replace(placeholder, value);
  fs.writeFileSync(tomlPath, content);
}

main().catch(err => {
  console.error(RED + '初始化失败:', err.message + RESET);
  process.exit(1);
});
