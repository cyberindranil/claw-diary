import type { Context, Next } from "hono";
import { extractBearerToken, hashKey } from "./keys";
import { effectivePlan } from "./plans";
import type { Env, PlanType, UserContext } from "./types";

type AuthEnv = { Bindings: Env; Variables: { user: UserContext } };

/**
 * Multi-tenant auth middleware.
 * 1. Hash the Bearer token and look up api_keys + users.
 * 2. Fallback: compare raw token against env.API_KEY (admin backdoor).
 * 3. Reject if neither matches.
 */
export function requireAuth() {
  return async (c: Context<AuthEnv>, next: Next) => {
    const token = extractBearerToken(c.req.header("Authorization"));
    if (!token) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const user = await resolveUser(c.env.DB, token);
    if (user) {
      c.set("user", user);
      c.executionCtx.waitUntil(touchKeyUsage(c.env.DB, token));
      return next();
    }

    if (c.env.API_KEY && token === c.env.API_KEY) {
      c.set("user", {
        userId: "__admin__",
        plan: "team" as PlanType,
        telegramId: c.env.TELEGRAM_CHAT_ID ?? "",
        isAdmin: true,
      });
      return next();
    }

    return c.json({ error: "Invalid API key" }, 401);
  };
}

/**
 * Optional auth: sets user context if a valid key is provided, but
 * does not block the request when the header is absent.
 */
export function optionalAuth() {
  return async (c: Context<AuthEnv>, next: Next) => {
    const token = extractBearerToken(c.req.header("Authorization"));
    if (token) {
      const user = await resolveUser(c.env.DB, token);
      if (user) {
        c.set("user", user);
      } else if (c.env.API_KEY && token === c.env.API_KEY) {
        c.set("user", {
          userId: "__admin__",
          plan: "team" as PlanType,
          telegramId: c.env.TELEGRAM_CHAT_ID ?? "",
          isAdmin: true,
        });
      }
    }
    return next();
  };
}

async function resolveUser(
  db: D1Database,
  rawToken: string
): Promise<UserContext | null> {
  const kh = await hashKey(rawToken);
  const row = await db
    .prepare(
      `SELECT ak.user_id, u.plan, u.telegram_id, u.plan_expires_at, u.preferred_lang
       FROM api_keys ak
       JOIN users u ON ak.user_id = u.id
       WHERE ak.key_hash = ?`
    )
    .bind(kh)
    .first<{
      user_id: string;
      plan: PlanType;
      telegram_id: string;
      plan_expires_at: string | null;
      preferred_lang: string | null;
    }>();

  if (!row) return null;

  // Check if this user belongs to a team (shared pool & subscription sync)
  const team = await db
    .prepare(
      `SELECT tm.team_owner_id, o.plan, o.plan_expires_at
       FROM team_members tm
       JOIN users o ON tm.team_owner_id = o.id
       WHERE tm.member_user_id = ?`
    )
    .bind(row.user_id)
    .first<{ team_owner_id: string; plan: PlanType; plan_expires_at: string | null }>();

  if (team) {
    return {
      userId: row.user_id,
      plan: effectivePlan(team.plan, team.plan_expires_at),
      telegramId: row.telegram_id,
      preferredLang: row.preferred_lang ?? undefined,
      isAdmin: false,
      quotaUserId: team.team_owner_id,
    };
  }

  return {
    userId: row.user_id,
    plan: effectivePlan(row.plan, row.plan_expires_at),
    telegramId: row.telegram_id,
    preferredLang: row.preferred_lang ?? undefined,
    isAdmin: false,
  };
}

async function touchKeyUsage(db: D1Database, rawToken: string): Promise<void> {
  const kh = await hashKey(rawToken);
  await db
    .prepare("UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE key_hash = ?")
    .bind(kh)
    .run();
}
