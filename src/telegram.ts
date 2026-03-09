import { t, type BotLang } from "./bot-i18n";

const TELEGRAM_API = "https://api.telegram.org/bot";

export type ApprovalForTelegram = {
  id: string;
  agent_id: string;
  requested_action: string;
  risk_level: string;
  params?: string;
  thought?: string;
  cost_estimate?: string;
};

/**
 * Send a plain text message to a Telegram chat.
 * No parse_mode so special chars in /keys, /plan etc. (e.g. <prefix>) don't break sending.
 */
export async function sendMessage(
  token: string,
  chatId: string,
  text: string
): Promise<boolean> {
  const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });
  return res.ok;
}

/**
 * Send an approval request with inline keyboard buttons.
 */
export async function sendApprovalRequest(
  token: string,
  chatId: string,
  approval: ApprovalForTelegram,
  lang: BotLang = "en"
): Promise<boolean> {
  const lines = [
    t(lang, "approval.title"),
    "",
    t(lang, "approval.action", approval.requested_action),
    approval.params ? t(lang, "approval.params", approval.params) : "",
    approval.thought ? t(lang, "approval.note", approval.thought) : "",
    approval.cost_estimate ? t(lang, "approval.cost", approval.cost_estimate) : "",
  ].filter(Boolean);

  const text = lines.join("\n");

  const body = {
    chat_id: chatId,
    text,
    reply_markup: {
      inline_keyboard: [
        [
          { text: t(lang, "approval.approve"), callback_data: `approve:${approval.id}` },
          { text: t(lang, "approval.reject"), callback_data: `reject:${approval.id}` },
        ],
      ],
    },
  };

  const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

/**
 * Acknowledge a Telegram inline keyboard button press.
 */
export async function answerCallbackQuery(
  token: string,
  callbackQueryId: string,
  text?: string,
  lang: BotLang = "en"
): Promise<void> {
  const displayText = text ?? t(lang, "callback.done");
  await fetch(`${TELEGRAM_API}${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: displayText,
    }),
  });
}

/**
 * Per-user daily digest sent to paid plan users.
 */
export async function sendDailySummary(
  token: string,
  chatId: string,
  stats: {
    totalCost: number;
    blockedCount: number;
    auditCount?: number;
    guardCount?: number;
  },
  lang: BotLang = "en"
): Promise<boolean> {
  const lines = [
    t(lang, "digest.title"),
    "",
    t(lang, "digest.cost", stats.totalCost.toFixed(2)),
    t(lang, "digest.blocked", stats.blockedCount),
    stats.auditCount != null ? t(lang, "digest.audit", stats.auditCount) : "",
    stats.guardCount != null ? t(lang, "digest.guard", stats.guardCount) : "",
  ].filter(Boolean);

  const text = lines.join("\n");

  const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  return res.ok;
}

/**
 * Platform-wide admin summary sent to the hardcoded admin chat.
 */
export async function sendAdminDailySummary(
  token: string,
  chatId: string,
  stats: { totalCost: number; blockedCount: number; totalUsers: number },
  lang: BotLang = "en"
): Promise<boolean> {
  const text = [
    t(lang, "digest.admin_title"),
    "",
    t(lang, "digest.admin_users", stats.totalUsers),
    t(lang, "digest.admin_cost", stats.totalCost.toFixed(2)),
    t(lang, "digest.admin_blocked", stats.blockedCount),
  ].join("\n");

  const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  return res.ok;
}
