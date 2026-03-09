import type { Context, Next } from "hono";
import { getLimits } from "./plans";
import type { Env, UserContext, UsageDailyRow } from "./types";

type UsageEndpoint = "audit" | "guard" | "diary";

type UsageEnv = { Bindings: Env; Variables: { user: UserContext } };

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getDailyUsage(
  db: D1Database,
  userId: string,
  date: string
): Promise<UsageDailyRow> {
  const row = await db
    .prepare("SELECT * FROM usage_daily WHERE user_id = ? AND date = ?")
    .bind(userId, date)
    .first<UsageDailyRow>();
  return (
    row ?? {
      user_id: userId,
      date,
      audit_count: 0,
      guard_count: 0,
      diary_count: 0,
      total_cost: 0,
    }
  );
}

export async function incrementUsage(
  db: D1Database,
  userId: string,
  date: string,
  endpoint: UsageEndpoint,
  costDelta: number = 0
): Promise<void> {
  const col = `${endpoint}_count`;
  await db
    .prepare(
      `INSERT INTO usage_daily (user_id, date, ${col}, total_cost)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(user_id, date)
       DO UPDATE SET ${col} = ${col} + 1, total_cost = total_cost + ?`
    )
    .bind(userId, date, costDelta, costDelta)
    .run();
}

/** Add audit cost to usage_daily for the day (used from audit handler). */
export async function addDailyCost(
  db: D1Database,
  userId: string,
  date: string,
  cost: number
): Promise<void> {
  if (cost <= 0) return;
  await db
    .prepare(
      `INSERT INTO usage_daily (user_id, date, audit_count, guard_count, diary_count, total_cost)
       VALUES (?, ?, 0, 0, 0, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET total_cost = total_cost + excluded.total_cost`
    )
    .bind(userId, date, cost)
    .run();
}

/**
 * Hono middleware: check daily quota for the given endpoint, reject with 429
 * when exceeded. After the downstream handler succeeds, increment the counter
 * asynchronously via waitUntil.
 *
 * Admin users bypass quota checks.
 */
export function trackUsage(endpoint: UsageEndpoint) {
  return async (c: Context<UsageEnv>, next: Next) => {
    const user: UserContext = c.get("user");

    if (user.isAdmin) {
      await next();
      return;
    }

    const date = todayUTC();
    const quotaUserId = user.quotaUserId ?? user.userId;
    const usage = await getDailyUsage(c.env.DB, quotaUserId, date);
    const limits = getLimits(user.plan);
    const currentCount = usage[`${endpoint}_count` as keyof UsageDailyRow] as number;
    const limit = limits[endpoint];

    if (currentCount >= limit) {
      return c.json(
        {
          error: "Daily quota exceeded",
          plan: user.plan,
          endpoint,
          limit,
          used: currentCount,
          resets_at: `${date}T24:00:00Z`,
        },
        429
      );
    }

    await next();

    c.executionCtx.waitUntil(
      incrementUsage(c.env.DB, quotaUserId, date, endpoint)
    );
  };
}
