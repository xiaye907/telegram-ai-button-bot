-- Telegram 按钮生成机器人 数据库结构
-- 执行: npm run db:migrate

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,           -- Telegram user_id
  username TEXT,
  first_name TEXT,
  language_code TEXT DEFAULT 'zh',
  plan TEXT DEFAULT 'free',         -- free | pro | enterprise
  plan_expires_at INTEGER,          -- Unix 时间戳
  daily_calls_used INTEGER DEFAULT 0,
  daily_calls_reset_at INTEGER,
  total_calls INTEGER DEFAULT 0,
  is_banned INTEGER DEFAULT 0,
  ban_reason TEXT,
  is_admin INTEGER DEFAULT 0,
  preferred_ai TEXT DEFAULT 'deepseek',  -- deepseek | doubao
  preferred_style TEXT DEFAULT 'default',
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- 按钮模板表
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,              -- UUID
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  buttons_json TEXT NOT NULL,       -- JSON 格式的按钮配置
  layout TEXT DEFAULT '1x1',        -- 布局: 1x1 | 2x1 | 2x2 | 3xN
  is_public INTEGER DEFAULT 0,
  is_featured INTEGER DEFAULT 0,
  use_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  tags TEXT,                        -- 逗号分隔的标签
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 生成历史表
CREATE TABLE IF NOT EXISTS generations (
  id TEXT PRIMARY KEY,              -- UUID
  user_id INTEGER NOT NULL,
  prompt TEXT NOT NULL,             -- 用户原始输入
  ai_engine TEXT NOT NULL,          -- deepseek | doubao
  buttons_json TEXT NOT NULL,       -- 生成结果
  tokens_used INTEGER DEFAULT 0,
  response_ms INTEGER DEFAULT 0,    -- 响应耗时(ms)
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 管理员操作日志
CREATE TABLE IF NOT EXISTS admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  action TEXT NOT NULL,             -- ban_user | unban | reset_quota | broadcast 等
  target_id TEXT,
  details TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- 系统公告表
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  target TEXT DEFAULT 'all',        -- all | pro | free
  sent_count INTEGER DEFAULT 0,
  is_sent INTEGER DEFAULT 0,
  created_by INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

-- 订阅/支付记录
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  plan TEXT NOT NULL,
  amount INTEGER,                   -- 单位: 分
  currency TEXT DEFAULT 'USD',
  payment_method TEXT,
  expires_at INTEGER,
  status TEXT DEFAULT 'active',     -- active | expired | cancelled
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 举报记录
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL,
  target_type TEXT NOT NULL,        -- template | user
  target_id TEXT NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending',    -- pending | resolved | dismissed
  resolved_by INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_templates_user ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_public ON templates(is_public, use_count);
CREATE INDEX IF NOT EXISTS idx_generations_user ON generations(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan, is_banned);

-- 系统用户（id=0，用于官方预设模板的 owner）
INSERT OR IGNORE INTO users (id, username, first_name, language_code, plan, is_admin)
VALUES (0, 'system', 'Official', 'zh', 'enterprise', 0);
