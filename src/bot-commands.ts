import { normalizeLang, t, type BotLang } from "./bot-i18n";
import { generateApiKey, hashKey, keyPrefix } from "./keys";
import { effectivePlan, getLimits } from "./plans";
import type { Env, PlanType, UserRow } from "./types";
import { getDailyUsage } from "./usage";

type TelegramMessage = {
  chat: { id: number };
  from?: {
    id: number;
    username?: string;
    first_name?: string;
    language_code?: string;
  };
  text?: string;
};

/**
 * Handle an incoming Telegram text message. Returns the reply text,
 * or null if no reply is needed.
 */
export async function handleBotMessage(
  env: Env,
  msg: TelegramMessage
): Promise<string | null> {
  const text = (msg.text ?? "").trim();
  if (!text.startsWith("/")) return null;

  const [cmd, ...args] = text.split(/\s+/);
  const from = msg.from;
  if (!from) return t("en", "sender.unknown");

  const telegramId = String(from.id);
  const cmdNorm = cmd.toLowerCase().replace(/@\w+$/, "");

  if (cmdNorm === "/start") {
    const lang = normalizeLang(from.language_code);
    return handleStart(env, telegramId, from.username, from.first_name, lang);
  }

  const user = await getUser(env.DB, telegramId);
  if (!user) return t(normalizeLang(from.language_code), "not_registered");
  const lang = normalizeLang(user.preferred_lang ?? from.language_code) as BotLang;

  switch (cmdNorm) {
    case "/lang":
      return handleLang(env, telegramId, args[0], lang);
    case "/newkey":
      return handleNewKey(env, telegramId, args.join(" ") || "default", lang);
    case "/keys":
      return handleListKeys(env, telegramId, lang);
    case "/revoke":
      return handleRevokeKey(env, telegramId, args[0], lang);
    case "/replacekey":
      return handleReplaceKey(env, telegramId, args[0], lang);
    case "/plan":
      return handlePlan(env, telegramId, lang);
    case "/usage":
      return handleUsage(env, telegramId, lang);
    case "/redeem":
      return handleRedeem(env, telegramId, args[0], lang);
    case "/subscribe":
      return handleSubscribe(env, telegramId, args[0], lang);
    case "/manage":
      return handleManage(env, telegramId, lang);
    case "/invite":
      return handleInvite(env, telegramId, lang);
    case "/admin":
      return handleAdmin(env, telegramId, args, lang);
    case "/help":
      return helpText(lang);
    default:
      return helpText(lang);
  }
}

// ────────── /start ──────────

async function handleStart(
  env: Env,
  telegramId: string,
  username: string | undefined,
  firstName: string | undefined,
  lang: BotLang
): Promise<string> {
  const db = env.DB;

  const existing = await db
    .prepare("SELECT id FROM users WHERE telegram_id = ?")
    .bind(telegramId)
    .first<{ id: string }>();

  if (existing) {
    return t(lang, "start.existing");
  }

  const userId = crypto.randomUUID();
  const displayName = firstName || username || telegramId;

  await db
    .prepare(
      "INSERT INTO users (id, telegram_id, telegram_username, display_name, preferred_lang) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(userId, telegramId, username ?? null, displayName, lang)
    .run();

  const rawKey = generateApiKey();
  const kh = await hashKey(rawKey);
  const kp = keyPrefix(rawKey);
  await db
    .prepare(
      "INSERT INTO api_keys (id, user_id, key_hash, key_prefix, name) VALUES (?, ?, ?, ?, 'default')"
    )
    .bind(crypto.randomUUID(), userId, kh, kp)
    .run();

  return t(lang, "start.welcome", displayName, rawKey);
}

// ────────── /newkey ──────────

async function handleNewKey(
  env: Env,
  telegramId: string,
  name: string,
  lang: BotLang
): Promise<string> {
  const db = env.DB;
  const user = await getUser(db, telegramId);
  if (!user) return t(lang, "not_registered");

  const membership = await getTeamMembership(db, user.id);
  if (membership) {
    return t(lang, "newkey.team_member");
  }

  const plan = effectivePlan(user.plan, user.plan_expires_at);
  const limits = getLimits(plan);

  const countRes = await db
    .prepare("SELECT COUNT(*) as cnt FROM api_keys WHERE user_id = ?")
    .bind(user.id)
    .first<{ cnt: number }>();

  if ((countRes?.cnt ?? 0) >= limits.keys) {
    return t(lang, "newkey.limit", limits.keys, plan);
  }

  const rawKey = generateApiKey();
  const kh = await hashKey(rawKey);
  const kp = keyPrefix(rawKey);
  const keyName = name.slice(0, 50);

  await db
    .prepare(
      "INSERT INTO api_keys (id, user_id, key_hash, key_prefix, name) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(crypto.randomUUID(), user.id, kh, kp, keyName)
    .run();

  return t(lang, "newkey.success", keyName, rawKey);
}

// ────────── /keys ──────────

async function handleListKeys(
  env: Env,
  telegramId: string,
  lang: BotLang
): Promise<string> {
  const db = env.DB;
  const user = await getUser(db, telegramId);
  if (!user) return t(lang, "not_registered");

  const res = await db
    .prepare(
      "SELECT key_prefix, name, last_used_at, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at"
    )
    .bind(user.id)
    .all<{
      key_prefix: string;
      name: string;
      last_used_at: string | null;
      created_at: string;
    }>();

  const keys = res.results ?? [];
  if (keys.length === 0) return t(lang, "keys.empty");

  const lines = keys.map((k, i) => {
    const used = k.last_used_at
      ? t(lang, "keys.used", k.last_used_at.slice(0, 10))
      : t(lang, "keys.never_used");
    return `${i + 1}. ${k.key_prefix}... — "${k.name}" (${used})`;
  });

  return t(lang, "keys.footer", lines.join("\n"));
}

// ────────── /revoke ──────────

async function handleRevokeKey(
  env: Env,
  telegramId: string,
  prefix: string | undefined,
  lang: BotLang
): Promise<string> {
  if (!prefix) return t(lang, "revoke.usage");

  const db = env.DB;
  const user = await getUser(db, telegramId);
  if (!user) return t(lang, "not_registered");

  const countRes = await db
    .prepare("SELECT COUNT(*) as cnt FROM api_keys WHERE user_id = ?")
    .bind(user.id)
    .first<{ cnt: number }>();

  if ((countRes?.cnt ?? 0) <= 1) {
    return t(lang, "revoke.only_one");
  }

  const result = await db
    .prepare(
      "DELETE FROM api_keys WHERE user_id = ? AND key_prefix = ?"
    )
    .bind(user.id, prefix)
    .run();

  if ((result.meta?.changes ?? 0) === 0) {
    return t(lang, "revoke.not_found", prefix);
  }

  return t(lang, "revoke.success", prefix);
}

// ────────── /replacekey ──────────
async function handleReplaceKey(
  env: Env,
  telegramId: string,
  prefix: string | undefined,
  lang: BotLang
): Promise<string> {
  const db = env.DB;
  const user = await getUser(db, telegramId);
  if (!user) return t(lang, "not_registered");

  const keys = await db
    .prepare(
      "SELECT id, key_prefix FROM api_keys WHERE user_id = ? ORDER BY created_at"
    )
    .bind(user.id)
    .all<{ id: string; key_prefix: string }>();

  const list = keys.results ?? [];
  if (list.length === 0) {
    return t(lang, "replacekey.no_keys");
  }

  let toReplace: { id: string; key_prefix: string } | null = null;
  if (prefix) {
    toReplace = list.find((k) => k.key_prefix === prefix) ?? null;
    if (!toReplace) {
      return t(lang, "replacekey.not_found", prefix);
    }
  } else {
    if (list.length === 1) {
      toReplace = list[0];
    } else {
      return t(lang, "replacekey.multiple");
    }
  }

  const rawKey = generateApiKey();
  const kh = await hashKey(rawKey);
  const kp = keyPrefix(rawKey);

  await db.prepare("DELETE FROM api_keys WHERE id = ?").bind(toReplace.id).run();
  await db
    .prepare(
      "INSERT INTO api_keys (id, user_id, key_hash, key_prefix, name) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(crypto.randomUUID(), user.id, kh, kp, "default")
    .run();

  return t(lang, "replacekey.success", rawKey);
}

// ────────── /plan ──────────

async function handlePlan(
  env: Env,
  telegramId: string,
  lang: BotLang
): Promise<string> {
  const db = env.DB;
  const user = await getUser(db, telegramId);
  if (!user) return t(lang, "not_registered");

  const date = new Date().toISOString().slice(0, 10);

  const membership = await getTeamMembership(db, user.id);
  if (membership) {
    const ownerPlan = effectivePlan(membership.plan, membership.plan_expires_at);
    const limits = getLimits(ownerPlan);
    const usage = await getDailyUsage(db, membership.team_owner_id, date);
    const expiry =
      ownerPlan !== "free" && membership.plan_expires_at
        ? t(lang, "plan.expires", membership.plan_expires_at.slice(0, 10))
        : "";
    return t(
      lang,
      "plan.line.team",
      expiry,
      date,
      usage.guard_count,
      limits.guard,
      usage.audit_count,
      limits.audit,
      usage.diary_count,
      limits.diary
    );
  }

  const plan = effectivePlan(user.plan, user.plan_expires_at);
  const limits = getLimits(plan);
  const usage = await getDailyUsage(db, user.id, date);

  const keyCount = await db
    .prepare("SELECT COUNT(*) as cnt FROM api_keys WHERE user_id = ?")
    .bind(user.id)
    .first<{ cnt: number }>();

  const expiry =
    plan !== "free" && user.plan_expires_at
      ? t(lang, "plan.expires", user.plan_expires_at.slice(0, 10))
      : "";

  return t(
    lang,
    "plan.line",
    plan.toUpperCase(),
    expiry,
    date,
    usage.guard_count,
    limits.guard,
    usage.audit_count,
    limits.audit,
    usage.diary_count,
    limits.diary,
    keyCount?.cnt ?? 0,
    limits.keys
  );
}

// ────────── /usage ──────────

async function handleUsage(
  env: Env,
  telegramId: string,
  lang: BotLang
): Promise<string> {
  const db = env.DB;
  const user = await getUser(db, telegramId);
  if (!user) return t(lang, "not_registered");

  const date = new Date().toISOString().slice(0, 10);

  const membership = await getTeamMembership(db, user.id);
  if (membership) {
    const ownerPlan = effectivePlan(membership.plan, membership.plan_expires_at);
    const limits = getLimits(ownerPlan);
    const usage = await getDailyUsage(db, membership.team_owner_id, date);
    return t(
      lang,
      "usage.body.team",
      date,
      usage.guard_count,
      limits.guard,
      usage.audit_count,
      limits.audit,
      usage.diary_count,
      limits.diary,
      usage.total_cost.toFixed(4)
    );
  }

  const plan = effectivePlan(user.plan, user.plan_expires_at);
  const limits = getLimits(plan);
  const usage = await getDailyUsage(db, user.id, date);

  return t(
    lang,
    "usage.body",
    date,
    usage.guard_count,
    limits.guard,
    usage.audit_count,
    limits.audit,
    usage.diary_count,
    limits.diary,
    usage.total_cost.toFixed(4)
  );
}

// ────────── /redeem ──────────

async function handleRedeem(
  env: Env,
  telegramId: string,
  code: string | undefined,
  lang: BotLang
): Promise<string> {
  if (!code) return t(lang, "redeem.usage");

  const db = env.DB;
  const user = await getUser(db, telegramId);
  if (!user) return t(lang, "not_registered");

  const invite = await db
    .prepare("SELECT * FROM invite_codes WHERE code = ?")
    .bind(code)
    .first<{
      code: string;
      plan: PlanType;
      duration_days: number;
      created_by: string | null;
      used_by: string | null;
      expires_at: string | null;
    }>();

  if (!invite) return t(lang, "redeem.invalid");
  if (invite.used_by) return t(lang, "redeem.used");
  if (
    invite.expires_at &&
    new Date(invite.expires_at).getTime() < Date.now()
  ) {
    return t(lang, "redeem.expired");
  }

  // ── Team invite (code prefix "team_") → add to shared pool ──
  if (code.startsWith("team_") && invite.created_by) {
    const owner = await db
      .prepare("SELECT id, plan, plan_expires_at FROM users WHERE id = ?")
      .bind(invite.created_by)
      .first<{ id: string; plan: PlanType; plan_expires_at: string | null }>();

    if (!owner || effectivePlan(owner.plan, owner.plan_expires_at) !== "team") {
      return t(lang, "redeem.team_owner_expired");
    }

    const existing = await getTeamMembership(db, user.id);
    if (existing) {
      return t(lang, "redeem.already_in_team");
    }

    const limits = getLimits("team");
    const memberCount = await db
      .prepare("SELECT COUNT(*) as cnt FROM team_members WHERE team_owner_id = ?")
      .bind(owner.id)
      .first<{ cnt: number }>();

    if ((memberCount?.cnt ?? 0) >= limits.teamMembers) {
      return t(lang, "redeem.team_full");
    }

    await db.batch([
      db
        .prepare("INSERT INTO team_members (team_owner_id, member_user_id) VALUES (?, ?)")
        .bind(owner.id, user.id),
      db
        .prepare("UPDATE invite_codes SET used_by = ?, used_at = CURRENT_TIMESTAMP WHERE code = ?")
        .bind(user.id, code),
    ]);

    return t(lang, "redeem.team_joined");
  }

  // ── Regular invite → upgrade user's own plan ──
  const expiresAt = new Date(
    Date.now() + invite.duration_days * 24 * 60 * 60 * 1000
  ).toISOString();

  await db.batch([
    db
      .prepare(
        "UPDATE users SET plan = ?, plan_expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      )
      .bind(invite.plan, expiresAt, user.id),
    db
      .prepare(
        "UPDATE invite_codes SET used_by = ?, used_at = CURRENT_TIMESTAMP WHERE code = ?"
      )
      .bind(user.id, code),
  ]);

  return t(lang, "redeem.success", invite.plan.toUpperCase(), expiresAt.slice(0, 10));
}

// ────────── /manage ──────────

async function handleManage(
  env: Env,
  telegramId: string,
  lang: BotLang
): Promise<string> {
  const db = env.DB;
  const user = await getUser(db, telegramId);
  if (!user) return t(lang, "not_registered");

  const membership = await getTeamMembership(db, user.id);
  if (membership) {
    return t(lang, "manage.team_member");
  }

  const plan = effectivePlan(user.plan, user.plan_expires_at);
  const periodLine =
    plan !== "free" && user.plan_expires_at
      ? t(lang, "manage.valid_until", user.plan_expires_at.slice(0, 10))
      : t(lang, "manage.free");
  const portalHint = t(lang, "manage.self_hosted_hint");
  return t(lang, "manage.body_self_hosted", plan.toUpperCase(), periodLine, portalHint);
}

// ────────── /invite (Team owners only) ──────────

async function handleInvite(
  env: Env,
  telegramId: string,
  lang: BotLang
): Promise<string> {
  const db = env.DB;
  const user = await getUser(db, telegramId);
  if (!user) return t(lang, "not_registered");

  const plan = effectivePlan(user.plan, user.plan_expires_at);
  if (plan !== "team") {
    return t(lang, "invite.only_team");
  }

  const limits = getLimits("team");
  const memberCount = await db
    .prepare(
      "SELECT COUNT(*) as cnt FROM team_members WHERE team_owner_id = ?"
    )
    .bind(user.id)
    .first<{ cnt: number }>();

  if ((memberCount?.cnt ?? 0) >= limits.teamMembers) {
    return t(lang, "invite.limit", limits.teamMembers);
  }

  const code =
    "team_" +
    Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) =>
      b.toString(16).padStart(2, "0")
    ).join("");

  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  await db
    .prepare(
      "INSERT INTO invite_codes (code, plan, duration_days, created_by, expires_at) VALUES (?, 'team', 30, ?, ?)"
    )
    .bind(code, user.id, expiresAt)
    .run();

  return t(lang, "invite.success", code);
}

// ────────── /subscribe ──────────

async function handleSubscribe(
  env: Env,
  telegramId: string,
  planArg: string | undefined,
  lang: BotLang
): Promise<string> {
  const db = env.DB;
  const user = await getUser(db, telegramId);
  if (!user) return t(lang, "not_registered");

  return t(lang, "subscribe.self_hosted");
}

// ────────── /lang ──────────

async function handleLang(
  env: Env,
  telegramId: string,
  arg: string | undefined,
  _currentLang: BotLang
): Promise<string> {
  const langArg = arg?.toLowerCase();
  if (langArg !== "en" && langArg !== "zh") {
    return t(_currentLang, "lang.usage");
  }
  const db = env.DB;
  const user = await getUser(db, telegramId);
  if (!user) return t(_currentLang, "not_registered");

  await db
    .prepare("UPDATE users SET preferred_lang = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(langArg, user.id)
    .run();

  return langArg === "zh" ? t("zh", "lang.set_zh") : t("en", "lang.set_en");
}

// ────────── /admin ──────────

function isAdmin(env: Env, telegramId: string): boolean {
  return !!(env.TELEGRAM_CHAT_ID && String(telegramId) === String(env.TELEGRAM_CHAT_ID));
}

async function handleAdmin(
  env: Env,
  telegramId: string,
  args: string[],
  lang: BotLang
): Promise<string> {
  if (!isAdmin(env, telegramId)) {
    return t(lang, "admin.not_authorized");
  }

  const sub = args[0]?.toLowerCase();
  if (!sub || sub === "help") {
    return t(lang, "admin.help");
  }

  if (sub === "gen") {
    return handleAdminGen(env, telegramId, args.slice(1), lang);
  }
  if (sub === "list") {
    return handleAdminList(env, telegramId, lang);
  }

  return t(lang, "admin.unknown");
}

async function handleAdminGen(
  env: Env,
  adminTelegramId: string,
  args: string[],
  lang: BotLang
): Promise<string> {
  const count = Math.min(Math.max(1, parseInt(args[0], 10) || 1), 50);
  const plan = (args[1]?.toLowerCase() === "team" ? "team" : "pro") as PlanType;
  const days = Math.min(Math.max(1, parseInt(args[2], 10) || 30), 365);
  const db = env.DB;

  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    let code = "";
    for (let j = 0; j < 10; j++) {
      code =
        "CD" +
        Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) =>
          b.toString(16).padStart(2, "0")
        ).join("");
      const row = await db
        .prepare("SELECT 1 FROM invite_codes WHERE code = ?")
        .bind(code)
        .first();
      if (!row) break;
    }
    await db
      .prepare(
        "INSERT INTO invite_codes (code, plan, duration_days, created_by) VALUES (?, ?, ?, ?)"
      )
      .bind(code, plan, days, adminTelegramId)
      .run();
    codes.push(code);
  }

  return t(lang, "admin.gen_result", codes.length, plan, days, codes.join("\n"));
}

async function handleAdminList(
  env: Env,
  adminTelegramId: string,
  lang: BotLang
): Promise<string> {
  const db = env.DB;
  const rows = await db
    .prepare(
      "SELECT code, plan, duration_days, used_by, used_at, created_at FROM invite_codes WHERE created_by = ? ORDER BY created_at DESC LIMIT 50"
    )
    .bind(adminTelegramId)
    .all<{
      code: string;
      plan: string;
      duration_days: number;
      used_by: string | null;
      used_at: string | null;
      created_at: string;
    }>();

  const list = rows.results ?? [];
  if (list.length === 0) {
    return t(lang, "admin.list_empty");
  }

  const lines = list.map((r) => {
    const status = r.used_by
      ? t(lang, "admin.list_status_redeemed", r.used_at ? r.used_at.slice(0, 10) : "")
      : t(lang, "admin.list_status_unused");
    return `${r.code} | ${r.plan} ${r.duration_days}d | ${status}`;
  });

  return t(lang, "admin.list_header", lines.join("\n"));
}

// ────────── Helpers ──────────

type TeamOwnerInfo = {
  team_owner_id: string;
  plan: PlanType;
  plan_expires_at: string | null;
};

async function getTeamMembership(
  db: D1Database,
  userId: string
): Promise<TeamOwnerInfo | null> {
  return db
    .prepare(
      `SELECT tm.team_owner_id, o.plan, o.plan_expires_at
       FROM team_members tm
       JOIN users o ON tm.team_owner_id = o.id
       WHERE tm.member_user_id = ?`
    )
    .bind(userId)
    .first<TeamOwnerInfo>();
}

async function getUser(
  db: D1Database,
  telegramId: string
): Promise<UserRow | null> {
  return db
    .prepare("SELECT * FROM users WHERE telegram_id = ?")
    .bind(telegramId)
    .first<UserRow>();
}

function helpText(lang: BotLang): string {
  return t(lang, "help.full");
}
