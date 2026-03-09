/**
 * Bot & Telegram notification strings. Keys are dot-separated; use {0}, {1} for params.
 */
export type BotLang = "en" | "zh";

const STRINGS_EN: Record<string, string> = {
  "sender.unknown": "Cannot identify sender.",
  "start.existing":
    "You already have an account.\n\nUse /keys to see your API keys, or /newkey to create one.\nUse /plan to check your plan and /help to see all commands.",
  "start.welcome":
    "Welcome to ClawDiary, {0}!\n\nYour plan: Free\nYour API Key (save it — shown only once):\n\n`{1}`\n\nSet this as your Bearer token in Agent / Cursor:\nAuthorization: Bearer {1}\n\nUse /help to see all commands.",
  "newkey.limit":
    "Key limit reached ({0} for {1} plan). Upgrade your plan or revoke an existing key.",
  "newkey.success":
    'New API key "{0}" created.\n\n`{1}`\n\nSave it — this is the only time you\'ll see the full key.',
  "keys.empty": "No API keys found. Use /newkey to create one.",
  "keys.used": "last used {0}",
  "keys.never_used": "never used",
  "keys.footer": "Your API keys:\n\n{0}\n\nTo revoke: /revoke <prefix>",
  "revoke.usage": "Usage: /revoke <key_prefix>\n\nUse /keys to see your key prefixes.",
  "revoke.only_one": "Cannot revoke your only API key. Create a new one first with /newkey.",
  "revoke.not_found": 'No key found with prefix "{0}". Use /keys to see your keys.',
  "revoke.success": "Key {0}... revoked.",
  "replacekey.no_keys":
    "You have no API keys. Use /start to register or /newkey to create one.",
  "replacekey.not_found": 'No key found with prefix "{0}". Use /keys to see your key prefixes.',
  "replacekey.multiple":
    "You have more than one key. Use /replacekey <prefix> to replace a specific key.\n\nUse /keys to see your key prefixes.",
  "replacekey.success":
    "Your API key has been replaced. Old key no longer works.\n\nNew key (save it — shown only once):\n\n{0}\n\nSet this as your Bearer token in Agent / Cursor.",
  "plan.line": "Plan: {0}{1}\n\nToday's usage ({2} UTC):\n  Guard: {3} / {4}\n  Audit: {5} / {6}\n  Diary: {7} / {8}\n  API Keys: {9} / {10}\n\nUse /redeem <code> to upgrade your plan.",
  "plan.expires": "\nExpires: {0}",
  "usage.body":
    "Usage for {0} (UTC):\n\nGuard:  {1} / {2}\nAudit:  {3} / {4}\nDiary:  {5} / {6}\nCost:   ${7}",
  "redeem.usage": "Usage: /redeem <invite_code>",
  "redeem.invalid": "Invalid invite code.",
  "redeem.used": "This code has already been used.",
  "redeem.expired": "This code has expired.",
  "redeem.success":
    "Plan upgraded to {0}!\nValid until: {1}\n\nUse /plan to see your new limits.",
  "manage.period_ends":
    "Current period ends: {0} (access until then).",
  "manage.subscription_active":
    "Your subscription is active. Next billing date and invoices: see portal below.",
  "manage.valid_until": "Valid until: {0} (invite or one-time).",
  "manage.free": "You're on the Free plan. Use /subscribe to upgrade.",
  "manage.body": "Plan: {0}\n{1}\n\nManage subscription (cancel, update payment, view invoices):\n{2}",
  "manage.body_self_hosted": "Plan: {0}\n{1}\n\n{2}",
  "manage.self_hosted_hint": "Paid plans and subscription management: use the hosted service at https://clawdiary.org",
  "newkey.team_member":
    "Only the team owner (subscriber) can generate API keys.",
  "redeem.team_owner_expired":
    "The team owner's subscription has expired. Contact your team owner.",
  "redeem.already_in_team":
    "You are already in a team. Leave your current team first.",
  "redeem.team_full":
    "This team has reached its member limit.",
  "redeem.team_joined":
    "You have joined the team! Quota is shared with the team owner.\n\nUse /plan to see the shared limits.",
  "plan.line.team":
    "Plan: TEAM (member){0}\n\nTeam shared usage ({1} UTC):\n  Guard: {2} / {3}\n  Audit: {4} / {5}\n  Diary: {6} / {7}\n\nQuota is shared with the team owner.",
  "usage.body.team":
    "Team shared usage ({0} UTC):\n\nGuard:  {1} / {2}\nAudit:  {3} / {4}\nDiary:  {5} / {6}\nCost:   ${7}\n\nQuota is shared with the team owner.",
  "manage.team_member":
    "You are a team member. Subscription is managed by the team owner.\n\nUse /plan to view shared quota.",
  "invite.only_team":
    "Only Team plan users can generate invite codes. Upgrade to Team first.",
  "invite.limit":
    "Team member limit reached ({0}). Remove a member first.",
  "invite.success":
    "Team invite code (expires in 7 days):\n\n`{0}`\n\nShare this code with your team member. They can use /redeem {0} to join.",
  "subscribe.not_configured":
    "Paddle payments are not configured yet. Please try again later.",
  "subscribe.error": "Server configuration error. Contact support.",
  "subscribe.body":
    "Click below to subscribe to {0} (${1}/month):\n\n{2}\n\nThis link expires in 1 hour.",
  "subscribe.self_hosted":
    "Paid plans are available on the hosted service. Visit https://clawdiary.org or use the Telegram Bot @ClawDiaryBot to subscribe.",
  "admin.not_authorized": "Not authorized.",
  "admin.help":
    "Admin:\n/admin gen <count> [plan] [days] — Generate invite codes (plan: pro|team, default pro 30 days)\n/admin list — List your codes and redemption status",
  "admin.unknown": "Unknown subcommand. Use /admin for usage.",
  "admin.gen_result":
    "Generated {0} invite code(s). Plan: {1}, {2} days.\n\n{3}\n\nUsers redeem with: /redeem <code>",
  "admin.list_empty":
    "No invite codes created by you yet. Use /admin gen <count> [plan] [days].",
  "admin.list_header": "Your invite codes (code | plan | status):\n\n{0}",
  "admin.list_status_redeemed": "Redeemed {0}",
  "admin.list_status_unused": "Unused",
  "not_registered": "You don't have an account yet. Send /start to register.",
  "help.full":
    "ClawDiary Bot Commands:\n\n/start — Register & get your first API key\n/subscribe [pro|team] — Subscribe to a paid plan\n/newkey [name] — Generate a new API key\n/keys — List your API keys\n/replacekey [prefix] — Replace a key (free: rotate your only key)\n/revoke <prefix> — Revoke a key by prefix\n/plan — View plan & today's usage\n/usage — Today's usage details\n/manage — Subscription management link\n/redeem <code> — Redeem an invite code\n/invite — (Team) Generate a team invite\n/lang [en|zh] — Set language\n/help — Show this message",
  "lang.usage": "Usage: /lang [en|zh]",
  "lang.set_en": "Language set to English.",
  "lang.set_zh": "Language set to 中文.",
  "approval.title": "🚨 High‑risk action — approval required",
  "approval.action": "Action: {0}",
  "approval.params": "Params: {0}",
  "approval.note": "Note: {0}",
  "approval.cost": "Est. cost: {0}",
  "approval.approve": "✅ Approve",
  "approval.reject": "❌ Reject",
  "callback.done": "Done",
  "callback.approved": "Approved",
  "callback.rejected": "Rejected",
  "digest.title": "📊 ClawDiary daily digest (UTC)",
  "digest.cost": "💰 Total cost (last 24h): ${0}",
  "digest.blocked": "🛑 Blocked / required approval: {0}",
  "digest.audit": "📝 Audit calls today: {0}",
  "digest.guard": "🛡 Guard calls today: {0}",
  "digest.admin_title": "📊 ClawDiary ADMIN daily digest (UTC)",
  "digest.admin_users": "👥 Total users: {0}",
  "digest.admin_cost": "💰 Platform cost (last 24h): ${0}",
  "digest.admin_blocked": "🛑 Blocked / required approval: {0}",
  "paddle.payment_failed":
    "Your subscription payment failed. Please update your payment method in the checkout page to keep your plan active.",
};

const STRINGS_ZH: Record<string, string> = {
  "sender.unknown": "无法识别发送者。",
  "start.existing":
    "您已有账户。\n\n使用 /keys 查看 API 密钥，或 /newkey 创建新密钥。\n使用 /plan 查看套餐，/help 查看全部命令。",
  "start.welcome":
    "欢迎使用 ClawDiary，{0}！\n\n当前套餐：免费\n您的 API Key（请妥善保存，仅显示一次）：\n\n`{1}`\n\n在 Agent / Cursor 中设置为 Bearer 令牌：\nAuthorization: Bearer {1}\n\n使用 /help 查看全部命令。",
  "newkey.limit": "已达密钥数量上限（{1} 套餐为 {0} 个）。请升级套餐或撤销现有密钥。",
  "newkey.success":
    '已创建新 API 密钥 "{0}"。\n\n`{1}`\n\n请保存，完整密钥仅显示一次。',
  "keys.empty": "暂无 API 密钥。请使用 /newkey 创建。",
  "keys.used": "最后使用 {0}",
  "keys.never_used": "从未使用",
  "keys.footer": "您的 API 密钥：\n\n{0}\n\n撤销密钥：/revoke <前缀>",
  "revoke.usage": "用法：/revoke <密钥前缀>\n\n使用 /keys 查看密钥前缀。",
  "revoke.only_one": "不能撤销唯一的 API 密钥。请先用 /newkey 创建新密钥。",
  "revoke.not_found": "未找到前缀为「{0}」的密钥。请用 /keys 查看。",
  "revoke.success": "密钥 {0}... 已撤销。",
  "replacekey.no_keys": "您还没有 API 密钥。请用 /start 注册或 /newkey 创建。",
  "replacekey.not_found": "未找到前缀为「{0}」的密钥。请用 /keys 查看前缀。",
  "replacekey.multiple":
    "您有多个密钥。请用 /replacekey <前缀> 指定要替换的密钥。\n\n使用 /keys 查看密钥前缀。",
  "replacekey.success":
    "API 密钥已替换，旧密钥已失效。\n\n新密钥（请保存，仅显示一次）：\n\n{0}\n\n在 Agent / Cursor 中设置为 Bearer 令牌。",
  "plan.line":
    "套餐：{0}{1}\n\n今日用量（{2} UTC）：\n  Guard：{3} / {4}\n  Audit：{5} / {6}\n  Diary：{7} / {8}\n  API 密钥：{9} / {10}\n\n使用 /redeem <兑换码> 升级套餐。",
  "plan.expires": "\n到期：{0}",
  "usage.body":
    "{0} 用量（UTC）：\n\nGuard：{1} / {2}\nAudit：{3} / {4}\nDiary：{5} / {6}\n费用：${7}",
  "redeem.usage": "用法：/redeem <邀请码>",
  "redeem.invalid": "无效的邀请码。",
  "redeem.used": "该邀请码已被使用。",
  "redeem.expired": "该邀请码已过期。",
  "redeem.success": "已升级至 {0}！\n有效期至：{1}\n\n使用 /plan 查看新额度。",
  "manage.period_ends": "当前周期截止：{0}（在此之前可继续使用）。",
  "manage.subscription_active":
    "订阅有效。下次账单与发票请见下方门户。",
  "manage.valid_until": "有效期至：{0}（邀请或一次性）。",
  "manage.free": "您当前为免费套餐。使用 /subscribe 升级。",
  "manage.body": "套餐：{0}\n{1}\n\n管理订阅（取消、更新支付、查看发票）：\n{2}",
  "manage.body_self_hosted": "套餐：{0}\n{1}\n\n{2}",
  "manage.self_hosted_hint": "付费套餐与订阅管理请使用托管服务：https://clawdiary.org",
  "newkey.team_member": "仅团队订阅方可生成 API 密钥。",
  "redeem.team_owner_expired": "团队订阅方的订阅已过期，请联系订阅方。",
  "redeem.already_in_team": "您已在团队中，请先退出当前团队。",
  "redeem.team_full": "该团队已达成员上限。",
  "redeem.team_joined":
    "已加入团队！额度与团队订阅方共享。\n\n使用 /plan 查看共享额度。",
  "plan.line.team":
    "套餐：TEAM（成员）{0}\n\n团队共享用量（{1} UTC）：\n  Guard：{2} / {3}\n  Audit：{4} / {5}\n  Diary：{6} / {7}\n\n额度与团队订阅方共享。",
  "usage.body.team":
    "团队共享用量（{0} UTC）：\n\nGuard：{1} / {2}\nAudit：{3} / {4}\nDiary：{5} / {6}\n费用：${7}\n\n额度与团队订阅方共享。",
  "manage.team_member":
    "您是团队成员，订阅由团队订阅方管理。\n\n使用 /plan 查看共享额度。",
  "invite.only_team": "仅 Team 套餐用户可生成邀请码。请先升级至 Team。",
  "invite.limit": "团队成员已达上限（{0}）。请先移除成员。",
  "invite.success":
    "团队邀请码（7 天内有效）：\n\n`{0}`\n\n将此码分享给成员，对方可使用 /redeem {0} 加入。",
  "subscribe.not_configured": "支付尚未配置，请稍后再试。",
  "subscribe.error": "服务器配置错误，请联系支持。",
  "subscribe.body":
    "点击下方链接订阅 {0}（${1}/月）：\n\n{2}\n\n链接 1 小时内有效。",
  "subscribe.self_hosted":
    "付费套餐请使用托管服务。访问 https://clawdiary.org 或通过 Telegram 机器人 @ClawDiaryBot 订阅。",
  "admin.not_authorized": "未授权。",
  "admin.help":
    "管理：\n/admin gen <数量> [plan] [天数] — 生成邀请码（plan: pro|team，默认 pro 30 天）\n/admin list — 列出邀请码及兑换状态",
  "admin.unknown": "未知子命令。使用 /admin 查看用法。",
  "admin.gen_result":
    "已生成 {0} 个邀请码。套餐：{1}，{2} 天。\n\n{3}\n\n用户使用 /redeem <码> 兑换。",
  "admin.list_empty": "您尚未创建邀请码。使用 /admin gen <数量> [plan] [天数]。",
  "admin.list_header": "您的邀请码（码 | 套餐 | 状态）：\n\n{0}",
  "admin.list_status_redeemed": "已兑换 {0}",
  "admin.list_status_unused": "未使用",
  "not_registered": "您尚未注册。请发送 /start 注册。",
  "help.full":
    "ClawDiary 机器人命令：\n\n/start — 注册并获取首个 API 密钥\n/subscribe [pro|team] — 订阅付费套餐\n/newkey [名称] — 生成新 API 密钥\n/keys — 列出 API 密钥\n/replacekey [前缀] — 替换密钥（免费用户可轮换唯一密钥）\n/revoke <前缀> — 撤销密钥\n/plan — 查看套餐与今日用量\n/usage — 今日用量详情\n/manage — 订阅管理链接\n/redeem <码> — 兑换邀请码\n/invite —（Team）生成团队邀请\n/lang [en|zh] — 设置语言\n/help — 显示本帮助",
  "lang.usage": "用法：/lang [en|zh]",
  "lang.set_en": "语言已设为 English。",
  "lang.set_zh": "语言已设为 中文。",
  "approval.title": "🚨 高风险操作 — 需审批",
  "approval.action": "操作：{0}",
  "approval.params": "参数：{0}",
  "approval.note": "说明：{0}",
  "approval.cost": "预估费用：{0}",
  "approval.approve": "✅ 批准",
  "approval.reject": "❌ 拒绝",
  "callback.done": "完成",
  "callback.approved": "已批准",
  "callback.rejected": "已拒绝",
  "digest.title": "📊 ClawDiary 每日摘要（UTC）",
  "digest.cost": "💰 过去 24 小时总费用：${0}",
  "digest.blocked": "🛑 已拦截/需审批：{0}",
  "digest.audit": "📝 今日 Audit 调用：{0}",
  "digest.guard": "🛡 今日 Guard 调用：{0}",
  "digest.admin_title": "📊 ClawDiary 管理端每日摘要（UTC）",
  "digest.admin_users": "👥 总用户数：{0}",
  "digest.admin_cost": "💰 平台过去 24 小时费用：${0}",
  "digest.admin_blocked": "🛑 已拦截/需审批：{0}",
  "paddle.payment_failed":
    "订阅扣款失败。请在结账页更新支付方式以保持套餐有效。",
};

const MAP: Record<BotLang, Record<string, string>> = {
  en: STRINGS_EN,
  zh: STRINGS_ZH,
};

/**
 * Normalize Telegram language_code or preferred_lang to BotLang.
 * e.g. "zh-hans", "zh" -> "zh"; anything else -> "en".
 */
export function normalizeLang(lang: string | undefined | null): BotLang {
  if (lang == null || lang === "") return "en";
  const lower = lang.toLowerCase();
  if (lower.startsWith("zh")) return "zh";
  return "en";
}

/**
 * Get translated string for key; replace {0}, {1}, ... with params.
 * Falls back to English if key or lang is missing.
 */
export function t(
  lang: BotLang,
  key: string,
  ...params: (string | number)[]
): string {
  const table = MAP[lang] ?? STRINGS_EN;
  let s = table[key] ?? STRINGS_EN[key] ?? key;
  for (let i = 0; i < params.length; i++) {
    s = s.replace(new RegExp(`\\{${i}\\}`, "g"), String(params[i]));
  }
  return s;
}
