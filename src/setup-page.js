export const SETUP_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bot 配置中心</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f2f5;min-height:100vh;padding:20px}
.wrap{max-width:600px;margin:0 auto}
h1{font-size:20px;font-weight:700;color:#1a1a1a;margin-bottom:4px}
.sub{font-size:13px;color:#888;margin-bottom:24px}
.card{background:#fff;border-radius:12px;border:1px solid #e8e8e8;padding:20px;margin-bottom:14px}
.card h2{font-size:14px;font-weight:600;color:#333;margin-bottom:14px;display:flex;align-items:center;gap:6px}
.field{margin-bottom:12px}
label{display:block;font-size:12px;color:#666;font-weight:500;margin-bottom:4px}
input,textarea{width:100%;padding:9px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;color:#1a1a1a;background:#fafafa;outline:none;transition:border .15s,background .15s}
input:focus,textarea:focus{border-color:#2563eb;background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.08)}
input[type=password]{letter-spacing:2px}
input[type=password]::placeholder{letter-spacing:0}
textarea{resize:vertical;min-height:60px;font-size:13px;font-family:monospace}
.hint{font-size:11px;color:#aaa;margin-top:3px}
.hint a{color:#2563eb;text-decoration:none}
.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.btn{display:block;width:100%;padding:12px;border:none;border-radius:9px;font-size:15px;font-weight:600;cursor:pointer;transition:all .15s;margin-bottom:8px}
.btn-blue{background:#2563eb;color:#fff}
.btn-blue:hover{background:#1d4ed8}
.btn-blue:disabled{background:#93c5fd;cursor:not-allowed}
.btn-green{background:#16a34a;color:#fff}
.btn-green:hover{background:#15803d}
.btn-green:disabled{background:#86efac;cursor:not-allowed}
.status{border-radius:8px;padding:12px 14px;font-size:13px;margin-top:10px;display:none}
.status.show{display:block}
.status.ok{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534}
.status.err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}
.status.info{background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af}
.log{background:#1e1e2e;border-radius:8px;padding:12px;font-family:monospace;font-size:12px;line-height:1.7;max-height:200px;overflow-y:auto;margin-top:10px;display:none;color:#cdd6f4}
.log.show{display:block}
.log .ok{color:#a6e3a1}
.log .err{color:#f38ba8}
.log .info{color:#89b4fa}
.progress{height:4px;background:#e5e7eb;border-radius:2px;overflow:hidden;margin-top:10px;display:none}
.progress.show{display:block}
.progress-bar{height:100%;background:#2563eb;border-radius:2px;width:0;transition:width .3s}
.tag{font-size:11px;padding:2px 7px;border-radius:20px;background:#f3f4f6;color:#6b7280;font-weight:400}
.sep{border:none;border-top:1px solid #f0f0f0;margin:12px 0}
.url-result{background:#f8faff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;font-size:13px;color:#1e40af;word-break:break-all;margin-top:8px;display:none}
.url-result.show{display:block}
</style>
</head>
<body>
<div class="wrap">
  <h1>🤖 Bot 配置中心</h1>
  <p class="sub">部署完成后在此页面完成所有配置，无需命令行</p>

  <!-- Worker 地址 -->
  <div class="card">
    <h2>① Worker 地址</h2>
    <div class="field">
      <label>你的 Worker URL</label>
      <input id="worker_url" placeholder="https://tg-button-bot.你的账户.workers.dev" oninput="saveLocal()">
      <div class="hint">部署成功后终端会显示这个地址</div>
    </div>
    <button class="btn btn-blue" onclick="testWorker()">🔍 测试连接</button>
    <div class="status" id="test_status"></div>
  </div>

  <!-- Telegram 配置 -->
  <div class="card">
    <h2>② Telegram Bot</h2>
    <div class="field">
      <label>Bot Token <span class="tag">必填</span></label>
      <input id="bot_token" type="password" placeholder="123456789:AAxxxxxxxxxxxxxx" oninput="saveLocal()">
      <div class="hint">从 <a href="https://t.me/BotFather" target="_blank">@BotFather</a> 获取</div>
    </div>
    <div class="row">
      <div class="field">
        <label>Bot 用户名</label>
        <input id="bot_username" placeholder="mybuttonbot（不含@）" oninput="saveLocal()">
      </div>
      <div class="field">
        <label>管理员 Telegram ID</label>
        <input id="admin_ids" placeholder="123456789" oninput="saveLocal()">
        <div class="hint">从 <a href="https://t.me/userinfobot" target="_blank">@userinfobot</a> 获取</div>
      </div>
    </div>
  </div>

  <!-- AI 配置 -->
  <div class="card">
    <h2>③ AI 引擎 <span class="tag">至少填一个</span></h2>
    <div class="row">
      <div class="field">
        <label>DeepSeek API Key</label>
        <input id="deepseek_key" type="password" placeholder="sk-..." oninput="saveLocal()">
        <div class="hint"><a href="https://platform.deepseek.com/api_keys" target="_blank">→ 获取 Key</a></div>
      </div>
      <div class="field">
        <label>豆包 API Key</label>
        <input id="doubao_key" type="password" placeholder="..." oninput="saveLocal()">
        <div class="hint"><a href="https://console.volcengine.com/ark" target="_blank">→ 获取 Key</a></div>
      </div>
    </div>
  </div>

  <!-- 一键配置 -->
  <div class="card">
    <h2>④ 一键完成配置</h2>
    <p style="font-size:13px;color:#666;margin-bottom:12px">
      点击下方按钮，将自动完成：注册 Webhook + 设置 Bot 命令列表
    </p>
    <div class="progress" id="prog"><div class="progress-bar" id="prog_bar"></div></div>
    <button class="btn btn-green" id="configBtn" onclick="runConfig()">⚡ 一键配置</button>
    <div class="log" id="log"></div>
    <div class="status" id="config_status"></div>
    <div class="url-result" id="url_result"></div>
  </div>

  <!-- 密钥提示 -->
  <div class="card">
    <h2>⑤ 剩余密钥（需命令行设置）</h2>
    <p style="font-size:13px;color:#666;margin-bottom:10px">以下密钥包含敏感信息，需在本地终端设置：</p>
    <div id="cmd_box" style="background:#1e1e2e;border-radius:8px;padding:14px;font-family:monospace;font-size:12px;color:#cdd6f4;line-height:2"></div>
  </div>
</div>

<script>
// ── 本地存储（不含密钥字段）────────────────────────────
const SAFE_FIELDS = ['worker_url','bot_username'];
function saveLocal() {
  SAFE_FIELDS.forEach(id => {
    const v = document.getElementById(id)?.value;
    if (v !== undefined) localStorage.setItem('bot_cfg_' + id, v);
  });
  updateCmdBox();
}
function loadLocal() {
  SAFE_FIELDS.forEach(id => {
    const v = localStorage.getItem('bot_cfg_' + id);
    if (v) document.getElementById(id).value = v;
  });
  updateCmdBox();
}

// ── 状态显示 ──────────────────────────────────────────
function showStatus(id, msg, type='ok') {
  const el = document.getElementById(id);
  el.className = \`status show \${type}\`;
  el.textContent = msg;
}

function addLog(msg, type='info') {
  const el = document.getElementById('log');
  el.classList.add('show');
  const line = document.createElement('div');
  line.className = type;
  line.textContent = \`[\${new Date().toLocaleTimeString()}] \${msg}\`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function setProgress(pct) {
  document.getElementById('prog').classList.add('show');
  document.getElementById('prog_bar').style.width = pct + '%';
}

// ── 测试 Worker 连接 ──────────────────────────────────
async function testWorker() {
  const url = document.getElementById('worker_url').value.trim().replace(/\\/$/, '');
  if (!url) { showStatus('test_status', '请先填写 Worker URL', 'err'); return; }
  showStatus('test_status', '连接中...', 'info');
  try {
    const res = await fetch(url + '/health');
    if (res.ok) {
      const data = await res.json();
      showStatus('test_status', \`✅ 连接成功！Worker 版本: \${data.version || '1.0.0'}\`, 'ok');
    } else {
      showStatus('test_status', \`⚠️ Worker 返回 \${res.status}，请确认 URL 正确\`, 'err');
    }
  } catch (e) {
    showStatus('test_status', '❌ 无法连接，请检查 Worker URL 是否正确', 'err');
  }
}

// ── 一键配置 ──────────────────────────────────────────
async function runConfig() {
  const url       = document.getElementById('worker_url').value.trim().replace(/\\/$/, '');
  const botToken  = document.getElementById('bot_token').value.trim();
  const botUser   = document.getElementById('bot_username').value.trim();
  const adminIds  = document.getElementById('admin_ids').value.trim();
  const deepseek  = document.getElementById('deepseek_key').value.trim();
  const doubao    = document.getElementById('doubao_key').value.trim();

  if (!url)      { showStatus('config_status', '请填写 Worker URL', 'err'); return; }
  if (!botToken) { showStatus('config_status', '请填写 Bot Token', 'err'); return; }
  if (!deepseek && !doubao) { showStatus('config_status', 'DeepSeek 或豆包 Key 至少填一个', 'err'); return; }

  const btn = document.getElementById('configBtn');
  btn.disabled = true;
  btn.textContent = '配置中...';
  document.getElementById('log').innerHTML = '';

  const TG = \`https://api.telegram.org/bot\${botToken}\`;

  // ── Step 1: 验证 Bot Token ───────────────────────────
  setProgress(10);
  addLog('验证 Bot Token...');
  try {
    const r = await fetch(\`\${TG}/getMe\`).then(r => r.json());
    if (!r.ok) throw new Error(r.description || 'Token 无效');
    addLog(\`✓ Bot 验证成功: @\${r.result.username}\`, 'ok');
    if (!botUser) document.getElementById('bot_username').value = r.result.username;
  } catch(e) {
    addLog(\`✗ Bot Token 验证失败: \${e.message}\`, 'err');
    showStatus('config_status', '❌ Bot Token 无效，请检查', 'err');
    btn.disabled = false; btn.textContent = '⚡ 一键配置';
    return;
  }

  // ── Step 2: 注册 Webhook ─────────────────────────────
  setProgress(35);
  addLog('注册 Telegram Webhook...');
  try {
    const webhookUrl = url + '/webhook';
    const r = await fetch(\`\${TG}/setWebhook\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message','callback_query','inline_query','chosen_inline_result','pre_checkout_query'],
        drop_pending_updates: true
      })
    }).then(r => r.json());
    if (!r.ok) throw new Error(r.description);
    addLog(\`✓ Webhook 注册成功: \${webhookUrl}\`, 'ok');
  } catch(e) {
    addLog(\`✗ Webhook 注册失败: \${e.message}\`, 'err');
    showStatus('config_status', \`❌ Webhook 注册失败: \${e.message}\`, 'err');
    btn.disabled = false; btn.textContent = '⚡ 一键配置';
    return;
  }

  // ── Step 3: 设置 Bot 命令 ────────────────────────────
  setProgress(60);
  addLog('设置 Bot 命令列表...');
  try {
    const commands = [
      {command:'start',    description:'启动机器人'},
      {command:'menu',     description:'主菜单'},
      {command:'quota',    description:'查看使用额度'},
      {command:'history',  description:'历史记录'},
      {command:'templates',description:'我的模板'},
      {command:'settings', description:'设置'},
      {command:'help',     description:'帮助'},
      {command:'cancel',   description:'取消当前操作'},
      {command:'admin',    description:'管理员面板'},
    ];
    const r = await fetch(\`\${TG}/setMyCommands\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands })
    }).then(r => r.json());
    if (r.ok) addLog('✓ Bot 命令列表已设置', 'ok');
    else addLog(\`⚠ 命令设置失败: \${r.description}\`, 'err');
  } catch(e) {
    addLog(\`⚠ 命令设置跳过: \${e.message}\`, 'err');
  }

  // ── Step 4: 发送测试消息给管理员 ─────────────────────
  setProgress(85);
  if (adminIds) {
    addLog('发送部署完成通知...');
    try {
      const ids = adminIds.split(',').map(s => s.trim()).filter(Boolean);
      for (const id of ids) {
        await fetch(\`\${TG}/sendMessage\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: id,
            text: \`🎉 <b>Bot 部署完成！</b>\\n\\nWorker: <code>\${url}</code>\\n\\n发送任意文字开始生成按钮，或点击 /menu 打开主菜单。\`,
            parse_mode: 'HTML'
          })
        });
      }
      addLog('✓ 通知已发送到管理员', 'ok');
    } catch(e) {
      addLog(\`⚠ 通知发送失败: \${e.message}\`, 'err');
    }
  }

  setProgress(100);
  addLog('🎉 全部配置完成！', 'ok');
  showStatus('config_status', '✅ 配置完成！现在可以去 Telegram 找你的 Bot 发送 /start 了', 'ok');

  const resultEl = document.getElementById('url_result');
  resultEl.classList.add('show');
  resultEl.innerHTML = \`
    <b>Bot 地址：</b><a href="https://t.me/\${document.getElementById('bot_username').value}" target="_blank">
      https://t.me/\${document.getElementById('bot_username').value}
    </a><br>
    <b>Worker：</b>\${url}
  \`;

  btn.textContent = '✅ 配置完成';
  updateCmdBox();
}

// ── 命令行提示框 ──────────────────────────────────────
function updateCmdBox() {
  const url  = document.getElementById('worker_url').value.trim() || 'https://your-worker.workers.dev';
  const box  = document.getElementById('cmd_box');
  box.innerHTML = [
    '<span style="color:#a6e3a1"># 以下命令在项目目录终端中执行</span>',
    '<span style="color:#89b4fa">npx wrangler secret put</span> BOT_TOKEN',
    '<span style="color:#89b4fa">npx wrangler secret put</span> ADMIN_IDS',
    '<span style="color:#89b4fa">npx wrangler secret put</span> DEEPSEEK_API_KEY',
    '<span style="color:#89b4fa">npx wrangler secret put</span> DOUBAO_API_KEY',
    '<span style="color:#89b4fa">npx wrangler secret put</span> BOT_USERNAME',
    '<span style="color:#89b4fa">npx wrangler secret put</span> ENCRYPTION_KEY',
    '<span style="color:#6c7086"># 设置完后重新部署</span>',
    '<span style="color:#89b4fa">npx wrangler deploy</span>',
  ].join('<br>');
}

// ── 初始化 ────────────────────────────────────────────
loadLocal();
updateCmdBox();

// 预填 Worker URL
if (!document.getElementById('worker_url').value) {
  document.getElementById('worker_url').value = 'https://tg-button-bot.xiaye100108.workers.dev';
  saveLocal();
}
</script>
</body>
</html>
`;
