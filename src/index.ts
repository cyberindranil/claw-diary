import { Hono } from "hono";
import { cors } from "hono/cors";
import { marked } from "marked";
import { AGENT_DEPLOY_MD } from "./agent-deploy-doc";
import { optionalAuth, requireAuth } from "./auth";
import { normalizeLang, t } from "./bot-i18n";
import { handleBotMessage } from "./bot-commands";
import { classify } from "./classifier";
import { GuardSession } from "./guard-session";
import { getLimits } from "./plans";
import * as telegram from "./telegram";
import type { AuditBody, DiaryCreateBody, Env, GuardBody, UserContext } from "./types";
import { getOpenApiSpec } from "./openapi";
import { renderDocsHtml } from "./ui";
import { addDailyCost, getDailyUsage, trackUsage } from "./usage";

type AppEnv = { Bindings: Env; Variables: { user: UserContext } };

const app = new Hono<AppEnv>();

app.use("*", cors());

function generateId(): string {
  return crypto.randomUUID();
}

function toISO8601UTC(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  if (
    /^\d{4}-\d{2}-\d{2}T.*Z$/i.test(value) ||
    /^\d{4}-\d{2}-\d{2}T.*[+-]\d{2}:\d{2}$/.test(value)
  )
    return value;
  const s = value.replace(" ", "T").trim();
  return s.endsWith("Z") ? s : s + "Z";
}

// ---------- POST /v1/audit ----------
app.post("/v1/audit", requireAuth(), trackUsage("audit"), async (c) => {
  let body: AuditBody;
  try {
    body = await c.req.json<AuditBody>();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const user: UserContext = c.get("user");
  const agentId = (body.agent_id ?? "").slice(0, 200);
  const sessionId = (body.session_id ?? "").slice(0, 200) || null;
  const actionType = (body.action_type ?? "tool_call").slice(0, 100);
  const cost = typeof body.cost === "number" ? body.cost : 0;
  const payload =
    typeof body.payload === "string"
      ? body.payload
      : JSON.stringify(body.payload ?? {});

  const id = generateId();
  const db = c.env.DB;
  const date = new Date().toISOString().slice(0, 10);
  c.executionCtx.waitUntil(
    db
      .prepare(
        "INSERT INTO logs (id, user_id, agent_id, session_id, action_type, cost, payload) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(id, user.userId, agentId, sessionId, actionType, cost, payload)
      .run()
  );
  if (cost > 0) {
    const quotaUserId = user.quotaUserId ?? user.userId;
    c.executionCtx.waitUntil(addDailyCost(db, quotaUserId, date, cost));
  }
  return c.json({ ok: true });
});

// ---------- POST /v1/guard ----------
app.post("/v1/guard", requireAuth(), trackUsage("guard"), async (c) => {
  let body: GuardBody;
  try {
    body = await c.req.json<GuardBody>();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const user: UserContext = c.get("user");
  const agentId = (body.agent_id ?? "").slice(0, 200);
  const actionType = (body.action_type ?? "").slice(0, 100);
  const command = (body.command ?? "").slice(0, 2000);
  const thought = (body.thought ?? "").slice(0, 500);
  const paramsStr = body.params
    ? JSON.stringify(body.params).slice(0, 1000)
    : "";

  const result = classify(actionType, command);
  const db = c.env.DB;

  if (result.approved && result.logOnly) {
    const id = generateId();
    const payload = JSON.stringify({
      action_type: actionType,
      command,
      thought,
      params: body.params,
    });
    c.executionCtx.waitUntil(
      db
        .prepare(
          "INSERT INTO logs (id, user_id, agent_id, session_id, action_type, cost, payload) VALUES (?, ?, ?, ?, ?, 0, ?)"
        )
        .bind(id, user.userId, agentId, null, "tool_call", payload)
        .run()
    );
    return c.json({ approved: true });
  }

  if ("needsApproval" in result && result.needsApproval) {
    const approvalId = generateId();
    const requestedAction = actionType || command || "unknown";
    await db
      .prepare(
        "INSERT INTO approvals (id, user_id, agent_id, requested_action, risk_level, status) VALUES (?, ?, ?, ?, ?, 'PENDING')"
      )
      .bind(
        approvalId,
        user.userId,
        agentId,
        requestedAction.slice(0, 500),
        result.risk
      )
      .run();

    const token = c.env.TELEGRAM_BOT_TOKEN;
    const limits = getLimits(user.plan);

    // Route notification to user's own TG (paid plans) or admin fallback
    const notifyTarget = limits.telegramNotify
      ? user.telegramId
      : c.env.TELEGRAM_CHAT_ID;

    if (token && notifyTarget) {
      const lang = normalizeLang(user.preferredLang);
      c.executionCtx.waitUntil(
        telegram.sendApprovalRequest(token, notifyTarget, {
          id: approvalId,
          agent_id: agentId,
          requested_action: requestedAction,
          risk_level: result.risk,
          params: paramsStr || undefined,
          thought: thought || undefined,
        }, lang)
      );
    }

    const stub = c.env.GUARD_SESSION.get(
      c.env.GUARD_SESSION.idFromName(approvalId)
    );
    const doRes = await stub.fetch("https://do/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "wait" }),
    });
    const doResult = (await doRes.json()) as { approved: boolean };

    const status = doResult.approved ? "APPROVED" : "REJECTED";
    const resolvedAt = new Date().toISOString();
    await db
      .prepare(
        "UPDATE approvals SET status = ?, resolved_at = ? WHERE id = ?"
      )
      .bind(status, resolvedAt, approvalId)
      .run();

    return c.json({ approved: doResult.approved });
  }

  return c.json({ approved: true });
});

// ---------- POST /v1/diary ----------
const MAX_OWNER_ID = 200;
const MAX_LOBSTER_ID = 200;
const MAX_CONTENT = 64 * 1024;

app.post("/v1/diary", requireAuth(), trackUsage("diary"), async (c) => {
  let body: DiaryCreateBody;
  try {
    body = await c.req.json<DiaryCreateBody>();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const user: UserContext = c.get("user");
  const ownerId = (body.owner_id ?? "").trim().slice(0, MAX_OWNER_ID);
  const lobsterId = (body.lobster_id ?? "").trim().slice(0, MAX_LOBSTER_ID);
  const content = (body.content ?? "").slice(0, MAX_CONTENT);
  if (!ownerId || !lobsterId || !content) {
    return c.json(
      {
        error: "owner_id, lobster_id and content are required and non-empty",
      },
      400
    );
  }
  const id = generateId();
  const db = c.env.DB;
  await db
    .prepare(
      "INSERT INTO diary_entries (id, user_id, owner_id, lobster_id, content) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(id, user.userId, ownerId, lobsterId, content)
    .run();
  const row = await db
    .prepare(
      "SELECT id, owner_id, lobster_id, content, created_at FROM diary_entries WHERE id = ?"
    )
    .bind(id)
    .first<{
      id: string;
      owner_id: string;
      lobster_id: string;
      content: string;
      created_at: string;
    }>();
  return c.json({
    id: row!.id,
    owner_id: row!.owner_id,
    lobster_id: row!.lobster_id,
    content: row!.content,
    created_at: toISO8601UTC(row!.created_at),
  });
});

// ---------- GET /v1/diary ----------
app.get("/v1/diary", requireAuth(), async (c) => {
  const user: UserContext = c.get("user");
  const ownerId = (c.req.query("owner_id") ?? "").trim().slice(0, MAX_OWNER_ID);
  if (!ownerId) {
    return c.json({ error: "owner_id is required" }, 400);
  }
  const since = c.req.query("since");
  const limit = Math.min(
    Math.max(1, parseInt(c.req.query("limit") ?? "50", 10) || 50),
    100
  );
  const db = c.env.DB;
  let stmt;
  if (since) {
    stmt = db
      .prepare(
        "SELECT id, owner_id, lobster_id, content, created_at FROM diary_entries WHERE user_id = ? AND owner_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT ?"
      )
      .bind(user.userId, ownerId, since, limit);
  } else {
    stmt = db
      .prepare(
        "SELECT id, owner_id, lobster_id, content, created_at FROM diary_entries WHERE user_id = ? AND owner_id = ? ORDER BY created_at DESC LIMIT ?"
      )
      .bind(user.userId, ownerId, limit);
  }
  const res = await stmt.all();
  const rows = (res.results ?? []) as {
    id: string;
    owner_id: string;
    lobster_id: string;
    content: string;
    created_at: string;
  }[];
  const entries = rows.map((r) => ({
    id: r.id,
    owner_id: r.owner_id,
    lobster_id: r.lobster_id,
    content: r.content,
    created_at: toISO8601UTC(r.created_at),
  }));
  return c.json({ entries });
});

// ---------- POST /webhook/telegram ----------
app.post("/webhook/telegram", async (c) => {
  let body: {
    callback_query?: { id: string; data?: string };
    message?: {
      chat: { id: number };
      from?: { id: number; username?: string; first_name?: string };
      text?: string;
    };
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  // Handle bot commands (text messages)
  if (body.message?.text) {
    const result = await handleBotMessage(c.env, body.message);
    const token = c.env.TELEGRAM_BOT_TOKEN;
    if (token && result) {
      c.executionCtx.waitUntil(
        telegram.sendMessage(token, String(body.message.chat.id), result)
      );
    }
    return c.json({ ok: true });
  }

  // Handle approval callback queries (original flow)
  const cb = body.callback_query;
  if (!cb?.data) {
    return c.json({ ok: true });
  }
  const [action, approvalId] = cb.data.split(":");
  const approved = action === "approve";
  if (!approvalId) {
    return c.json({ ok: true });
  }

  const db = c.env.DB;
  const status = approved ? "APPROVED" : "REJECTED";
  const resolvedAt = new Date().toISOString();
  await db
    .prepare(
      "UPDATE approvals SET status = ?, resolved_at = ? WHERE id = ?"
    )
    .bind(status, resolvedAt, approvalId)
    .run();

  let lang: "en" | "zh" = "en";
  const approvalRow = await db
    .prepare("SELECT user_id FROM approvals WHERE id = ?")
    .bind(approvalId)
    .first<{ user_id: string | null }>();
  if (approvalRow?.user_id) {
    const userRow = await db
      .prepare("SELECT preferred_lang FROM users WHERE id = ?")
      .bind(approvalRow.user_id)
      .first<{ preferred_lang: string | null }>();
    lang = normalizeLang(userRow?.preferred_lang ?? null) as "en" | "zh";
  }

  const stub = c.env.GUARD_SESSION.get(
    c.env.GUARD_SESSION.idFromName(approvalId)
  );
  await stub.fetch("https://do/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "resolve", approved }),
  });

  const token = c.env.TELEGRAM_BOT_TOKEN;
  if (token) {
    const callbackText = approved ? t(lang, "callback.approved") : t(lang, "callback.rejected");
    await telegram.answerCallbackQuery(token, cb.id, callbackText, lang);
  }
  return c.json({ ok: true });
});

// ---------- GET /robots.txt ----------
app.get("/robots.txt", (c) => {
  const apex = c.env.APEX_DOMAIN ?? "clawdiary.org";
  const apiBase = `https://api.${apex}`;
  const body = `User-agent: *
Allow: /docs
Allow: /mcp.json
Allow: /
Disallow: /webhook/

Sitemap: ${apiBase}/sitemap.xml
`;
  return c.text(body, 200, {
    "Content-Type": "text/plain; charset=utf-8",
  });
});

// ---------- GET /sitemap.xml ----------
app.get("/sitemap.xml", (c) => {
  const apex = c.env.APEX_DOMAIN ?? "clawdiary.org";
  const apiBase = `https://api.${apex}`;
  const urls = [
    apiBase + "/",
    apiBase + "/docs",
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${escapeXml(u)}</loc></url>`).join("\n")}
</urlset>`;
  return c.text(xml, 200, {
    "Content-Type": "application/xml; charset=utf-8",
  });
});

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ---------- GET /.well-known/openapi.json ----------
app.get("/.well-known/openapi.json", (c) => {
  const apiBase = `https://api.${c.env.APEX_DOMAIN ?? "clawdiary.org"}`;
  return c.json(getOpenApiSpec(apiBase), 200, {
    "Cache-Control": "public, max-age=3600",
  });
});

// ---------- GET /.well-known/clawdiary.json ----------
app.get("/.well-known/clawdiary.json", (c) => {
  const apex = c.env.APEX_DOMAIN ?? "clawdiary.org";
  const apiBase = `https://api.${apex}`;
  return c.json(
    {
      description: "Cloud audit, guard, and shared diary for AI agents—multi-agent collaboration, one gateway.",
      api_base: apiBase,
      docs_url: `${apiBase}/docs`,
      docs_markdown_url: `${apiBase}/docs`,
      docs_markdown_accept: "Accept: text/markdown",
      openapi_url: `${apiBase}/.well-known/openapi.json`,
      mcp_descriptor_url: `${apiBase}/mcp.json`,
      auth: "Bearer token (API Key). Get key via Telegram Bot or deployer.",
    },
    200,
    { "Cache-Control": "public, max-age=3600" }
  );
});

// ---------- GET /mcp.json ----------
app.get("/mcp.json", (c) => {
  const apiBase = `https://api.${c.env.APEX_DOMAIN ?? "clawdiary.org"}`;
  return c.json({
    name: "ClawDiary Guardian",
    version: "1.0",
    documentation_url: `${apiBase}/docs`,
    openapi_url: `${apiBase}/.well-known/openapi.json`,
    tools: [
      {
        name: "request_human_approval",
        description:
          "CRITICAL: Must be called before executing any destructive, financial, or outward-facing communication actions. Waits for human operator to click Approve on Telegram. Requires Bearer API key.",
        url: `${apiBase}/v1/guard`,
      },
      {
        name: "report_audit",
        description:
          "Call after an action completes to log it (async, non-blocking). Report agent_id, optional session_id, action_type, cost, payload. Requires Bearer API key.",
        url: `${apiBase}/v1/audit`,
      },
      {
        name: "write_diary",
        description:
          "Write a diary entry for an owner/lobster. Use same owner_id across devices; lobster_id per device. Requires Bearer API key.",
        url: `${apiBase}/v1/diary`,
      },
      {
        name: "read_diary",
        description:
          "List diary entries by owner_id (GET with query owner_id, optional since, limit). Requires Bearer API key.",
        url: `${apiBase}/v1/diary`,
      },
    ],
  });
});

// ---------- GET /docs ----------
app.get("/docs", (c) => {
  const accept = c.req.header("Accept") ?? "";
  if (accept.includes("text/markdown")) {
    return c.text(AGENT_DEPLOY_MD, 200, {
      "Content-Type": "text/markdown; charset=utf-8",
    });
  }
  const apiBase = `https://api.${c.env.APEX_DOMAIN ?? "clawdiary.org"}`;
  const html = renderDocsHtml(marked.parse(AGENT_DEPLOY_MD) as string, {
    apiBase,
  });
  return c.html(html);
});

// ---------- GET / (redirect to docs) ----------
app.get("/", (c) => c.redirect("/docs", 302));

// ---------- GET /api/feed ----------
app.get("/api/feed", optionalAuth(), async (c) => {
  const since = c.req.query("since");
  const db = c.env.DB;
  const feedLimit = 50;
  const user: UserContext | undefined = c.get("user");

  const userFilter = user ? "AND user_id = ?" : "";
  const bindsExtra = user ? [user.userId] : [];

  let logs: {
    id: string;
    created_at: string;
    agent_id: string;
    session_id: string | null;
    action_type: string | null;
    cost: number;
    payload: string | null;
  }[] = [];
  let approvals: {
    id: string;
    created_at: string;
    agent_id: string;
    requested_action: string;
    risk_level: string;
    status: string;
  }[] = [];

  if (since) {
    const logRes = await db
      .prepare(
        `SELECT id, agent_id, session_id, action_type, cost, payload, created_at FROM logs WHERE created_at > ? ${userFilter} ORDER BY created_at DESC LIMIT ?`
      )
      .bind(since, ...bindsExtra, feedLimit)
      .all();
    const appRes = await db
      .prepare(
        `SELECT id, agent_id, requested_action, risk_level, status, created_at FROM approvals WHERE created_at > ? ${userFilter} ORDER BY created_at DESC LIMIT ?`
      )
      .bind(since, ...bindsExtra, feedLimit)
      .all();
    logs = (logRes.results ?? []) as typeof logs;
    approvals = (appRes.results ?? []) as typeof approvals;
  } else {
    const logRes = await db
      .prepare(
        `SELECT id, agent_id, session_id, action_type, cost, payload, created_at FROM logs WHERE 1=1 ${userFilter} ORDER BY created_at DESC LIMIT ?`
      )
      .bind(...bindsExtra, feedLimit)
      .all();
    const appRes = await db
      .prepare(
        `SELECT id, agent_id, requested_action, risk_level, status, created_at FROM approvals WHERE 1=1 ${userFilter} ORDER BY created_at DESC LIMIT ?`
      )
      .bind(...bindsExtra, feedLimit)
      .all();
    logs = (logRes.results ?? []) as typeof logs;
    approvals = (appRes.results ?? []) as typeof approvals;
  }

  const entries = [
    ...logs.map((r) => ({
      type: "log" as const,
      id: r.id,
      created_at: toISO8601UTC(r.created_at),
      agent_id: r.agent_id,
      action_type: r.action_type,
      cost: r.cost,
      payload: r.payload
        ? (() => {
            try {
              return JSON.parse(r.payload!);
            } catch {
              return r.payload;
            }
          })()
        : null,
    })),
    ...approvals.map((r) => ({
      type: "approval" as const,
      id: r.id,
      created_at: toISO8601UTC(r.created_at),
      agent_id: r.agent_id,
      requested_action: r.requested_action,
      risk_level: r.risk_level,
      status: r.status,
    })),
  ]
    .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
    .slice(0, feedLimit);

  return c.json({ entries });
});

// ---------- Worker export + scheduled ----------
async function handleScheduled(env: Env): Promise<void> {
  const db = env.DB;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const since = yesterday.toISOString();
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  // Send per-user daily digests for paid plans
  const users = await db
    .prepare(
      "SELECT id, telegram_id, plan, plan_expires_at, preferred_lang FROM users WHERE plan IN ('pro', 'team')"
    )
    .all<{
      id: string;
      telegram_id: string;
      plan: string;
      plan_expires_at: string | null;
      preferred_lang: string | null;
    }>();

  for (const u of users.results ?? []) {
    if (
      u.plan_expires_at &&
      new Date(u.plan_expires_at).getTime() < Date.now()
    )
      continue;

    const costRes = await db
      .prepare(
        "SELECT COALESCE(SUM(cost), 0) as total FROM logs WHERE user_id = ? AND created_at >= ?"
      )
      .bind(u.id, since)
      .first<{ total: number }>();
    const blockRes = await db
      .prepare(
        "SELECT COUNT(*) as cnt FROM approvals WHERE user_id = ? AND created_at >= ? AND status IN ('APPROVED', 'REJECTED')"
      )
      .bind(u.id, since)
      .first<{ cnt: number }>();
    const dateStr = new Date().toISOString().slice(0, 10);
    const usageRow = await getDailyUsage(db, u.id, dateStr);

    const userLang = normalizeLang(u.preferred_lang) as "en" | "zh";
    await telegram.sendDailySummary(token, u.telegram_id, {
      totalCost: costRes?.total ?? 0,
      blockedCount: blockRes?.cnt ?? 0,
      auditCount: usageRow.audit_count,
      guardCount: usageRow.guard_count,
    }, userLang);
  }

  // Also send admin summary to the hardcoded chat ID
  const adminChatId = env.TELEGRAM_CHAT_ID;
  if (adminChatId) {
    const costRes = await db
      .prepare(
        "SELECT COALESCE(SUM(cost), 0) as total FROM logs WHERE created_at >= ?"
      )
      .bind(since)
      .first<{ total: number }>();
    const blockRes = await db
      .prepare(
        "SELECT COUNT(*) as cnt FROM approvals WHERE created_at >= ? AND status IN ('APPROVED', 'REJECTED')"
      )
      .bind(since)
      .first<{ cnt: number }>();
    const userCount = await db
      .prepare("SELECT COUNT(*) as cnt FROM users")
      .first<{ cnt: number }>();

    await telegram.sendAdminDailySummary(token, adminChatId, {
      totalCost: costRes?.total ?? 0,
      blockedCount: blockRes?.cnt ?? 0,
      totalUsers: userCount?.cnt ?? 0,
    });
  }
}

export { GuardSession };

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    return app.fetch(request, env, ctx);
  },
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(handleScheduled(env));
  },
};
