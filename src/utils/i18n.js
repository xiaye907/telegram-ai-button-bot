/**
 * 国际化工具 (i18n)
 * 支持中文/英文，可扩展更多语言
 */

const messages = {
  zh: {
    // 通用
    welcome: '👋 你好，{name}！\n\n我是智能按钮生成机器人，直接告诉我你想要什么样的按钮，我来帮你生成！\n\n例如: <i>帮我做个红色的「立即购买」按钮，链接到 https://example.com</i>\n\n💡 生成后点击「📤 转发」可将按钮发送到任意对话',
    help_text: '📖 <b>使用帮助</b>\n\n<b>生成按钮:</b>\n直接发送文字描述，例如:\n• 「蓝色的官网入口按钮」\n• 「两行按钮，第一行：联系我们 和 关于我们，第二行：立即购买」\n\n<b>转发按钮:</b>\n生成后点击「📤 转发」选择目标对话\n或在任意对话输入 <code>@你的bot名称</code> 搜索历史按钮\n\n<b>分享按钮:</b>\n点击「🔗 分享」获取分享链接\n格式: <code>@botname xxxx-xxxx-xxxx-xxxx</code>\n\n<b>命令:</b>\n/menu - 主菜单\n/quota - 查看额度\n/history - 历史记录\n/templates - 我的模板\n/settings - 设置\n/cancel - 取消当前操作',
    menu_title: '📋 <b>主菜单</b>',
    settings_title: '⚙️ <b>设置</b>',
    cancelled: '✅ 已取消',
    no_permission: '❌ 无权限',
    unknown_command: '❓ 未知命令，请发送 /help 查看帮助',
    banned: '🚫 您的账户已被封禁',
    generating: '⏳ AI 正在分析您的需求，生成按钮中...',
    generate_failed: '❌ 生成失败，请稍后重试',
    quota_exceeded: '⚠️ 今日额度已用完\n\n升级到 Pro 版可获得 500次/天的额度',
    regenerating: '正在重新生成...',

    // 预览
    preview_ready: '✅ <b>按钮已生成</b>\n\n消息: {text}\n按钮数量: {count}\nAI引擎: {engine}\n\n点击「转发」可将此按钮组发送到任意对话',
    regen_done: '✅ 已重新生成',

    // 额度
    quota_info: '📊 <b>使用额度</b>\n\n套餐: {plan}\n今日已用: {used} 次\n每日上限: {limit} 次\n剩余: {remaining} 次\n下次重置: {resetAt}',
    no_history: '📭 暂无历史记录',
    history_title: '📋 <b>最近生成记录</b>',

    // 模板
    templates_title: '📦 <b>我的模板</b> ({count} 个)',
    enter_template_name: '请输入模板名称:',
    template_saved: '✅ 模板「{name}」已保存',
    template_save_failed: '❌ 保存失败',
    template_deleted: '✅ 模板已删除',
    template_visibility_updated: '✅ 模板可见性已更新',

    // 设置
    setting_saved: '✅ {key} 已设置为: {value}',
    ai_select: '🤖 <b>选择 AI 引擎</b>',
    style_select: '🎨 <b>选择按钮风格</b>',

    // 升级
    upgrade_info: '⭐ <b>升级套餐</b>\n\n<b>Pro 版</b> - 500次/天\n<b>企业版</b> - 无限次\n\n请选择套餐:',

    // 管理员
    admin_panel: '🔧 <b>管理员面板</b>\n\n选择操作：',
    admin_ban_success: '✅ 用户 {id} 已封禁',
    admin_unban_success: '✅ 用户 {id} 已解封',
    admin_quota_reset: '✅ 用户 {id} 额度已重置',
    admin_plan_set: '✅ 用户 {id} 已升级为 {plan} 套餐',
    admin_broadcast_prompt: '📢 请输入广播内容（支持 HTML 格式）：',
    broadcast_scheduled: '✅ 广播已成功发送',

    // 内联
    inline_generated: '已生成',
    inline_buttons: '个按钮',
    inline_default_text: '查看按钮',

    // 按钮文字
    btn_forward: '📤 转发到对话',
    btn_save_tpl: '💾 保存模板',
    btn_edit: '✏️ 编辑',
    btn_regen: '🔄 重新生成',
    btn_back: '🔙 返回',
    btn_upgrade: '⭐ 升级套餐',
    btn_quota_info: '📊 查看额度',
    btn_edit_text: '✏️ 修改文字',
    btn_edit_color: '🎨 修改颜色',
    btn_edit_layout: '📐 修改布局',
    btn_edit_url: '🔗 修改链接',
    edit_which: '请选择要编辑的内容:',
    edit_prompt_text: '请输入新的按钮文字:',
    edit_prompt_color: '请描述新的颜色 (如: 红色、蓝色):',
    edit_prompt_layout: '请选择新的布局 (如: 1×1、2×1、2×2):',
    edit_prompt_url: '请输入新的链接 URL:',

    // 菜单项
    menu_generate: '✨ 生成按钮',
    menu_templates: '📦 模板库',
    menu_history: '📋 历史记录',
    menu_quota: '📊 我的额度',
    menu_settings: '⚙️ 设置',
    menu_help: '❓ 帮助'
  },

  en: {
    welcome: '👋 Hi {name}!\n\nI\'m a smart Telegram button generator. Just tell me what buttons you want!\n\nExample: <i>A red "Buy Now" button linking to https://example.com</i>',
    help_text: '📖 <b>Help</b>\n\nJust send a text description to generate buttons, e.g.:\n• "A blue website button"\n• "Two rows: Contact Us and About Us in row 1, Buy Now in row 2"\n\n<b>Commands:</b>\n/menu /quota /history /templates /settings /cancel',
    menu_title: '📋 <b>Main Menu</b>',
    generating: '⏳ AI is analyzing your request...',
    generate_failed: '❌ Generation failed, please try again',
    quota_exceeded: '⚠️ Daily quota exceeded\n\nUpgrade to Pro for 500 calls/day',
    preview_ready: '✅ <b>Buttons Generated</b>\n\nMessage: {text}\nButtons: {count}\nEngine: {engine}',
    btn_forward: '📤 Forward',
    btn_save_tpl: '💾 Save',
    btn_edit: '✏️ Edit',
    btn_regen: '🔄 Regenerate',
    btn_back: '🔙 Back',
    btn_upgrade: '⭐ Upgrade',
    btn_quota_info: '📊 Quota',
    menu_generate: '✨ Generate',
    menu_templates: '📦 Templates',
    menu_history: '📋 History',
    menu_quota: '📊 Quota',
    menu_settings: '⚙️ Settings',
    menu_help: '❓ Help',
    inline_generated: 'Generated',
    inline_buttons: 'buttons',
    inline_default_text: 'View buttons',
    admin_panel: '🔧 <b>Admin Panel</b>',
    banned: '🚫 Your account has been banned',
    no_permission: '❌ No permission',
    cancelled: '✅ Cancelled',
    unknown_command: '❓ Unknown command, send /help',
    generating2: '⏳ Regenerating...',
    regenerating: 'Regenerating...'
  }
};

/**
 * 翻译函数
 * @param {string} key
 * @param {string} lang
 * @param {object} vars - 模板变量替换
 */
export function t(key, lang = 'zh', vars = {}) {
  const dict = messages[lang] || messages.zh;
  let str = dict[key] || messages.zh[key] || key;

  // 替换模板变量 {name} → value
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }

  return str;
}
