# 🤖 Telegram 智能按钮生成机器人

基于 **Cloudflare Workers + D1 + KV** 构建的 Telegram 内联键盘按钮生成机器人。
接入 **豆包(Doubao)** AI，自动识别用户意图，生成带颜色和文本的按钮，支持内联转发到任意群组/对话。

---

## ✨ 功能亮点

| 模块 | 功能 |
|------|------|
| 🧠 AI 生成 | 用户描述 → AI 自动识别颜色/文本/布局 → 生成 InlineKeyboard |
| 📤 内联转发 | `@bot 关键词` 触发，将按钮组转发到任意对话/群组 |
| 📦 模板库 | 保存、收藏、公开分享按钮模板 |
| 📊 额度系统 | 免费50次/日，Pro 500次/日，支持套餐升级 |
| 🔧 管理后台 | 用户管理、封禁、广播、统计、AI配置等10大模块 |
| 🤖 AI引擎 | 豆包 AI，快速响应 |
| 🌐 多语言 | 中文/英文，可扩展 |

---

## 🚀 快速部署

### 前置条件

- [Cloudflare 账户](https://cloudflare.com)（免费即可）
- [Node.js](https://nodejs.org) 18+
- Telegram Bot Token（从 [@BotFather](https://t.me/BotFather) 获取）
- 豆包 API Key

### 一键部署（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/你的用户名/tg-button-bot.git
cd tg-button-bot

# 2. 安装依赖
npm install

# 3. 运行初始化向导（自动完成所有配置）
npm run setup
```

向导会引导你完成：登录 Cloudflare → 创建 KV/D1 → 配置密钥 → 部署 → 注册 Webhook

### 手动部署

```bash
# 1. 安装依赖
npm install

# 2. 登录 Cloudflare
npx wrangler login

# 3. 创建 KV 命名空间
npx wrangler kv:namespace create "BOT_KV"
# 将输出的 id 填入 wrangler.toml 的 kv_namespaces.id

# 4. 创建 D1 数据库
npx wrangler d1 create tg-button-bot
# 将输出的 database_id 填入 wrangler.toml 的 d1_databases.database_id

# 5. 执行数据库迁移
npm run db:migrate

# 6. 设置密钥
npx wrangler secret put BOT_TOKEN
npx wrangler secret put WEBHOOK_SECRET
npx wrangler secret put DOUBAO_API_KEY
npx wrangler secret put ADMIN_IDS          # 你的 Telegram ID，多个用逗号分隔
npx wrangler secret put ENCRYPTION_KEY     # 任意32位随机字符串

# 7. 部署
npm run deploy

# 8. 注册 Webhook
curl -X POST https://你的worker名.你的账户.workers.dev/setup-webhook \
  -H "Authorization: Bearer 你的WEBHOOK_SECRET"
```

---

## 📡 GitHub Actions 自动部署

推送到 `main` 分支时自动部署到 Cloudflare Workers。

**配置 GitHub Secrets（仓库 Settings → Secrets）：**

| Secret 名称 | 说明 |
|-------------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token（需要 Workers 编辑权限） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID |

获取 API Token：Cloudflare Dashboard → My Profile → API Tokens → Create Token → `Edit Cloudflare Workers` 模板

---

## 💻 本地开发

```bash
# 复制环境变量文件
cp .env.example .dev.vars
# 编辑 .dev.vars 填入真实值

# 启动本地开发服务器
npm run dev

# 使用 ngrok 暴露本地端口（用于接收 Telegram 消息）
ngrok http 8787
# 然后将 ngrok URL 注册为 Webhook:
curl -X POST https://你的ngrok地址/setup-webhook \
  -H "Authorization: Bearer 你的WEBHOOK_SECRET"
```

---

## 🤖 使用方法

### 用户端

1. 找到你的 Bot，发送 `/start`
2. 直接发送文字描述：
   ```
   帮我做三个按钮：
   - 红色「立即购买」 链接 https://shop.com
   - 蓝色「了解更多」 链接 https://about.com
   - 绿色「联系客服」 链接 https://contact.com
   ```
3. Bot 自动生成带颜色标识的按钮预览
4. 点击「📤 转发到对话」→ 选择目标群组/对话
5. 或在任意对话输入 `@你的bot 关键词` 触发内联模式

### 管理员

发送 `/admin` 进入管理面板，可进行：
- 用户封禁/解封
- 查看系统统计
- 发送全局广播
- 配置 AI 参数
- 查看操作日志

或调用 REST API：
```bash
# 查看统计
curl https://你的worker.workers.dev/api/admin/stats \
  -H "Authorization: Bearer 你的WEBHOOK_SECRET"

# 封禁用户
curl -X POST https://你的worker.workers.dev/api/admin/users/123456/ban \
  -H "Authorization: Bearer 你的WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"reason": "违规"}'
```

---

## 🏗 项目结构

```
tg-button-bot/
├── src/
│   ├── index.js                 # Workers 主入口
│   ├── handlers/
│   │   ├── webhook.js           # Webhook 路由分发
│   │   ├── message.js           # 消息处理（命令+AI生成）
│   │   ├── callback.js          # 按钮点击处理
│   │   ├── inline.js            # 内联查询处理
│   │   ├── admin.js             # 管理员 REST API
│   │   └── scheduled.js         # 定时任务
│   ├── services/
│   │   ├── buttonGenerator.js   # AI按钮生成核心（DeepSeek+豆包）
│   │   ├── telegram.js          # Telegram API 封装
│   │   ├── user.js              # 用户管理+额度
│   │   ├── template.js          # 模板库服务
│   │   ├── history.js           # 生成历史服务
│   │   ├── broadcast.js         # 广播服务
│   │   └── adminLog.js          # 管理员日志
│   └── utils/
│       ├── keyboards.js         # 键盘布局构建
│       ├── i18n.js              # 国际化
│       ├── security.js          # 安全验证
│       └── response.js          # HTTP 响应工具
├── scripts/
│   ├── setup.js                 # 一键初始化向导
│   └── schema.sql               # D1 数据库结构
├── .github/workflows/
│   └── deploy.yml               # GitHub Actions 自动部署
├── wrangler.toml                # Cloudflare Workers 配置
├── package.json
├── .gitignore
└── .env.example                 # 环境变量示例
```

---

## ⚙️ 套餐配置

在 `src/services/user.js` 中修改 `PLAN_LIMITS`：

```js
const PLAN_LIMITS = {
  free: 50,          // 免费用户每日调用次数
  pro: 500,          // Pro 用户每日调用次数
  enterprise: 9999   // 企业用户每日调用次数
};
```

---

## 🔧 AI 引擎配置

在 `src/services/buttonGenerator.js` 中修改模型：

```js
// 豆包模型
model: 'doubao-seed-2-0-pro-260215'   // 或其他豆包模型
```

---

## 📄 License

MIT
