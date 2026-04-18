/**
 * 键盘构建工具
 * 统一管理所有 InlineKeyboardMarkup 构建
 */
import { t } from './i18n.js';

/**
 * 主菜单
 */
export function buildMainMenu(lang) {
  return {
    inline_keyboard: [
      [
        { text: t('menu_generate', lang), callback_data: 'menu:generate' },
        { text: t('menu_templates', lang), callback_data: 'tpl:list' }
      ],
      [
        { text: t('menu_history', lang), callback_data: 'history:list' },
        { text: t('menu_quota', lang), callback_data: 'menu:quota' }
      ],
      [
        { text: t('menu_settings', lang), callback_data: 'menu:settings' },
        { text: t('menu_help', lang), callback_data: 'menu:help' }
      ]
    ]
  };
}

/**
 * 管理员面板菜单（完整版）
 */
export function buildAdminMenu(lang) {
  return {
    inline_keyboard: [
      [
        { text: '📊 数据统计', callback_data: 'admin:stats' },
        { text: '💰 AI成本', callback_data: 'admin:ai_cost' }
      ],
      [
        { text: '📈 增长趋势', callback_data: 'admin:growth' },
        { text: '👥 用户管理', callback_data: 'admin:users' }
      ],
      [
        { text: '📢 广播公告', callback_data: 'admin:broadcast_start' },
        { text: '🚨 举报审核', callback_data: 'admin:reports' }
      ],
      [
        { text: '🗂 模板审核', callback_data: 'admin:templates' },
        { text: '⚙️ 功能开关', callback_data: 'admin:flags' }
      ],
      [
        { text: '🔧 开启维护', callback_data: 'admin:maintenance_on' },
        { text: '✅ 关闭维护', callback_data: 'admin:maintenance_off' }
      ],
      [
        { text: '📋 操作日志', callback_data: 'admin:logs' },
        { text: '💳 订阅管理', callback_data: 'admin:subscriptions' }
      ],
      [
        { text: '🔙 返回主菜单', callback_data: 'menu:main' }
      ]
    ]
  };
}

/**
 * 设置菜单
 */
export function buildSettingsMenu(user, lang) {
  return {
    inline_keyboard: [
      [
        { text: `🌐 语言: ${user.language_code === 'en' ? 'English ✓' : '中文 ✓'}`, callback_data: 'set:lang:zh' }
      ],
      [
        { text: '🎨 按钮风格', callback_data: 'menu:style' }
      ],
      [
        { text: '📤 导出数据', callback_data: 'set:export' },
        { text: '🗑 清空历史', callback_data: 'set:clear_history' }
      ],
      [
        { text: '🔙 返回主菜单', callback_data: 'menu:main' }
      ]
    ]
  };
}

/**
 * AI 选择菜单
 */
export function buildAiMenu(current, lang) {
  return {
    inline_keyboard: [
      [
        {
          text: `🟡 豆包 Doubao ✓`,
          callback_data: 'set:ai:doubao'
        }
      ],
      [
        { text: '🔙 返回', callback_data: 'menu:settings' }
      ]
    ]
  };
}

/**
 * 风格选择菜单
 */
export function buildStyleMenu(current, lang) {
  const styles = [
    { key: 'default', label: '默认' },
    { key: 'minimal', label: '简约' },
    { key: 'emoji', label: '表情丰富' },
    { key: 'formal', label: '正式商务' }
  ];

  return {
    inline_keyboard: [
      ...styles.map(s => ([{
        text: `${s.label}${current === s.key ? ' ✓' : ''}`,
        callback_data: `set:style:${s.key}`
      }])),
      [{ text: '🔙 返回', callback_data: 'menu:settings' }]
    ]
  };
}

/**
 * 升级套餐菜单
 */
export function buildUpgradeMenu(lang) {
  return {
    inline_keyboard: [
      [{ text: '⭐ Pro - 500次/日', callback_data: 'upgrade:pro' }],
      [{ text: '🏢 企业版 - 无限次', callback_data: 'upgrade:enterprise' }],
      [{ text: '🔙 返回', callback_data: 'menu:main' }]
    ]
  };
}

/**
 * 历史记录菜单
 */
export function buildHistoryMenu(history, lang) {
  const rows = history.slice(0, 8).map(gen => ([{
    text: `📋 ${gen.prompt.slice(0, 25)}...`,
    callback_data: `history:view:${gen.id}`
  }]));

  return {
    inline_keyboard: [
      ...rows,
      [
        { text: '🗑 清空历史', callback_data: 'set:clear_history' },
        { text: '🔙 返回', callback_data: 'menu:main' }
      ]
    ]
  };
}

/**
 * 模板列表菜单
 */
export function buildTemplateMenu(templates, lang) {
  const rows = templates.slice(0, 8).map(tpl => ([{
    text: `📦 ${tpl.name.slice(0, 25)}`,
    callback_data: `tpl:use:${tpl.id}`
  }]));

  return {
    inline_keyboard: [
      ...rows,
      [
        { text: '🌐 公共模板库', callback_data: 'tpl:public_list' },
        { text: '🔙 返回', callback_data: 'menu:main' }
      ]
    ]
  };
}

/**
 * 构建生成结果的预览操作键盘
 * （含转发按钮 switch_inline_query、保存、编辑、重生成、分享链接）
 */
export function buildPreviewKeyboard(result, lang) {
  const taskId   = result.taskId || result.id;
  const zh = lang === 'zh';
  return {
    inline_keyboard: [
      ...result.buttons,
      [
        // switch_inline_query 传任务 ID，用户选择对话后直接发送带按钮的消息
        { text: zh ? '📤 转发到对话' : '📤 Forward',    switch_inline_query: taskId },
        { text: zh ? '💾 保存模板'   : '💾 Save',        callback_data: `save:${taskId}` }
      ],
      [
        { text: zh ? '✏️ 编辑'       : '✏️ Edit',        callback_data: `edit:${taskId}` },
        { text: zh ? '🔄 重新生成'   : '🔄 Regen',       callback_data: `regen:${taskId}` },
        { text: zh ? '🔗 分享'       : '🔗 Share',       callback_data: `share:${taskId}` }
      ]
    ]
  };
}
