<p align="center">
  <img src="https://img.shields.io/badge/runtime-Cloudflare_Workers-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare Workers" />
  <img src="https://img.shields.io/badge/framework-Hono-E36002?logo=hono&logoColor=white" alt="Hono" />
  <img src="https://img.shields.io/badge/database-D1_(SQLite)-003B57?logo=sqlite&logoColor=white" alt="D1" />
  <img src="https://img.shields.io/badge/lang-TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" />
</p>

# ClawDiary

**Cloud audit, guard, and shared diary for AI agents — multi-agent collaboration, one gateway.**

ClawDiary is a lightweight, self-hosted API gateway built on Cloudflare Workers that gives you full visibility and control over your AI agents. It provides three core capabilities: **passive audit logging**, **active risk interception with human-in-the-loop approval**, and a **shared diary** for cross-device agent collaboration.

> [中文](#中文说明) | English

---

## Use the hosted service — [clawdiary.org](https://clawdiary.org)

**[ClawDiary](https://clawdiary.org) is live in production.** No setup required: register via the [Telegram Bot](https://t.me/ClawDiaryBot), get your API key, and start using Guard + Audit + Diary from Cursor, MCP, or any HTTP client. The hosted service includes the full web dashboard (timeline, docs, legal pages) and optional paid plans (Pro / Team) with higher quotas and Telegram notifications.

| | Self‑hosted (this repo) | [clawdiary.org](https://clawdiary.org) |
|---|---|---|
| **Audit, Guard, Diary API** | Yes | Yes |
| **Telegram Bot & approval** | You configure your own | Included |
| **Web UI (timeline, docs)** | No (API only) | Yes |
| **Billing / paid plans** | No | Yes (Paddle) |
| **Best for** | Full control, private deployment | Quick start, no ops |

If you just want to plug in and go, use **[https://api.clawdiary.org](https://api.clawdiary.org)** with the API key from the bot. This repository is the **API-only, self-hostable** version for those who prefer to run their own instance.

---

## Highlights

- **Audit** — Agents report actions after execution; async, zero-latency logging to D1
- **Guard** — High-risk operations are intercepted and held until a human approves via Telegram
- **Diary** — One owner, multiple devices ("lobsters"), shared notebook readable and writable from anywhere
- **Daily Digest** — Automated Cron summary of costs and blocked actions, pushed to Telegram
- **Multi-tenant** — User isolation via API keys; Free tier and invite-code upgrades (no payment in this repo)
- **MCP & OpenAPI** — Machine-readable descriptors at `/mcp.json` and `/.well-known/openapi.json`
- **API-only** — No web UI or payment code; for full product (timeline, billing) use [clawdiary.org](https://clawdiary.org)
- **Zero infrastructure** — Runs entirely on Cloudflare's edge: Workers, D1, Durable Objects

---

## Architecture

```
                         ┌──────────────────────────────────────────────┐
                         │            Cloudflare Workers               │
                         │                                              │
  AI Agent ──────────────┤  POST /v1/audit ──► D1 (logs)               │
  (Cursor, MCP, etc.)    │                                              │
                         │  POST /v1/guard ──► Classifier               │
                         │                      │                       │
                         │              ┌───────┴───────┐               │
                         │              ▼               ▼               │
                         │          Green-lit       Red-flagged          │
                         │         (approved)    ┌──► D1 (approvals)    │
                         │                       │                      │
                         │                       ├──► Telegram notify   │
                         │                       │                      │
                         │                       └──► Durable Object    │
                         │                            (wait/resolve)    │
                         │                                              │
  Your app ──────────────┤  GET /api/feed  ──► JSON entries (optional auth) │
                         │                                              │
  Telegram ──────────────┤  POST /webhook/telegram                      │
                         │   ├── Approve / Reject callbacks             │
                         │   └── Bot commands (/start, /key, /manage)   │
                         │                                              │
                         │  Cron (00:00 UTC) ──► Daily digest           │
                         └──────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- A Cloudflare account with [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) logged in (`wrangler login`)
- (Optional) A Telegram Bot for approval notifications and daily digests

### Setup

```bash
# 1. Clone and install
git clone https://github.com/your-org/claw-diary.git
cd claw-diary
npm install

# 2. Copy the example config and fill in your values
cp wrangler.example.toml wrangler.toml

# 3. Create the D1 database
npm run db:create
# Paste the returned database_id into wrangler.toml → [[d1_databases]]

# 4. Run migrations
npm run db:migrate          # Remote (safe: auto-adds missing columns)
npm run db:migrate:local    # Local dev

# 5. Set secrets (interactive prompt)
wrangler secret put API_KEY
wrangler secret put TELEGRAM_BOT_TOKEN

# 6. Start local dev server
npm run dev

# 7. Deploy to Cloudflare
npm run deploy
```

---

## Configuration

### Secrets (via `wrangler secret put`)

| Name | Required | Description |
|------|----------|-------------|
| `API_KEY` | Yes | Bearer token for all `/v1/*` endpoints |
| `TELEGRAM_BOT_TOKEN` | No | Telegram Bot API token for approval & digest |

### Environment Variables (in `wrangler.toml` `[vars]`)

| Name | Description |
|------|-------------|
| `TELEGRAM_CHAT_ID` | Admin chat ID for system notifications |
| `APEX_DOMAIN` | Your domain (e.g. `clawdiary.org`) |
*(Payment/billing is not included in this open-source build. Use [clawdiary.org](https://clawdiary.org) for hosted plans.)*

---

## API Reference

All `/v1/*` endpoints require authentication:

```
Authorization: Bearer <API_KEY>
```

### `POST /v1/audit` — Passive Logging

Report an action after execution. Non-blocking (`waitUntil`).

```json
{
  "agent_id": "my-agent",
  "session_id": "sess-001",
  "action_type": "tool_call",
  "cost": 0.003,
  "payload": { "tool": "search_web", "query": "weather" }
}
```

**Response:** `{ "ok": true }`

### `POST /v1/guard` — Approval Gate

Call **before** a high-risk action. The request blocks until a human approves or rejects.

```json
{
  "agent_id": "my-agent",
  "action_type": "execute_bash",
  "command": "rm -rf /tmp/data",
  "thought": "Cleaning up temporary files"
}
```

**Response:** `{ "approved": true }` or `{ "approved": false }`

### `POST /v1/diary` — Write Entry

```json
{
  "owner_id": "alice",
  "lobster_id": "home-pc",
  "content": "Completed API integration today."
}
```

### `GET /v1/diary` — Read Entries

| Param | Type | Description |
|-------|------|-------------|
| `owner_id` | string | Required. Owner identifier |
| `since` | string | Optional. ISO 8601 UTC timestamp filter |
| `limit` | number | Optional. Max entries (default 50, max 100) |

### Other Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /` | No | Redirects to `/docs` |
| `GET /api/feed` | Optional | JSON feed of logs & approvals |
| `GET /docs` | No | Human-readable deployment guide (HTML or Markdown) |
| `GET /mcp.json` | No | MCP tool descriptor |
| `GET /.well-known/openapi.json` | No | OpenAPI 3.0 spec |
| `GET /.well-known/clawdiary.json` | No | Service discovery descriptor |
| `POST /webhook/telegram` | No | Telegram bot callback |

---

## Risk Classification

The classifier (`src/classifier.ts`) categorizes actions into two tiers:

**Green-lit** (auto-approved, logged silently):

`search_web` `read_file` `get_weather` `list_files` `calculate` `translate` `browse`

**Red-flagged** (blocks until human approval):

| Risk Level | Pattern |
|------------|---------|
| CRITICAL | `rm -rf`, `drop table/database`, `format`, `dd if=`, `mkfs.` |
| HIGH | `execute_bash`, `transfer`, `send_mail`, `sql_query` |
| MEDIUM | `rm`, `delete`, `chmod`, `curl .. \| sh`, `wget .. \| sh` |

Unrecognized actions default to **MEDIUM risk, logged but auto-approved**.

---

## Plans & Quotas (self-hosted)

This repo supports the **Free** tier and **invite-code** upgrades (no payment integration). For Pro/Team with billing, use [clawdiary.org](https://clawdiary.org).

| | Free (default) | With invite code |
|---|---|---|
| API Keys | 1 | Same limits as Pro/Team |
| Guard / Audit / Diary | 50 / 200 / 10 per day | Higher (see `src/plans.ts`) |
| Telegram notifications | Admin only (`TELEGRAM_CHAT_ID`) | Per-user when upgraded |
| Daily digest | Admin summary | Per-user for upgraded |

---

## Telegram Bot Setup

1. Talk to [@BotFather](https://t.me/BotFather) and `/newbot` to get your `TELEGRAM_BOT_TOKEN`
2. Send any message to your bot, then visit:
   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```
   Find your `chat.id` in the response JSON
3. Set the webhook after deploying:
   ```
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<WORKER_DOMAIN>/webhook/telegram
   ```

### Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Register and get your API key |
| `/key` | Generate a new API key |
| `/usage` | View today's usage stats |
| `/manage` | Show plan & usage (subscription via [clawdiary.org](https://clawdiary.org) only) |
| `/lang` | Switch language (en/zh) |

---

## Agent Integration

### Cursor IDE

Add a rule in `.cursor/rules/` that instructs the agent to:

1. Call `POST /v1/guard` before destructive/outbound actions
2. Call `POST /v1/audit` after completing actions
3. Set `CLAWDIARY_API_KEY` in environment (never commit to repo)

### MCP-compatible Agents

Import the tool descriptor:

```
GET https://<WORKER_DOMAIN>/mcp.json
```

The `request_human_approval` tool will be available for the agent to call before high-risk operations.

---

## Project Structure

```
claw-diary/
├── src/
│   ├── index.ts            # Hono routes, Worker & Scheduled exports
│   ├── types.ts            # TypeScript type definitions
│   ├── auth.ts             # Bearer token auth middleware
│   ├── classifier.ts       # Green/red risk classifier
│   ├── guard-session.ts    # Durable Object for approval wait/resolve
│   ├── telegram.ts         # Telegram Bot API helpers
│   ├── bot-commands.ts     # Bot command handlers
│   ├── bot-i18n.ts         # i18n strings (en/zh)
│   ├── plans.ts            # Plan limits & quota logic
│   ├── usage.ts            # Daily usage tracking middleware
│   ├── keys.ts             # API key hashing
│   ├── openapi.ts          # OpenAPI 3.0 spec generator
│   ├── ui.ts               # Docs page HTML template only
│   └── agent-deploy-doc.ts # Deployment guide markdown
├── scripts/
│   └── d1-migrate.mjs      # Safe D1 migration script
├── schema.sql              # Database schema
├── wrangler.example.toml   # Config template (copy to wrangler.toml)
├── package.json
└── tsconfig.json
```

---

## Database Schema

Six tables with full tenant isolation via `user_id`:

| Table | Purpose |
|-------|---------|
| `users` | User accounts (linked to Telegram) |
| `api_keys` | Hashed API keys per user |
| `logs` | Audit trail (agent actions & costs) |
| `approvals` | Guard approval records |
| `diary_entries` | Shared diary entries |
| `usage_daily` | Per-user daily quota counters |

All timestamps are stored in **UTC**.

---

## License

[MIT](LICENSE)

---

<a id="中文说明"></a>

## 中文说明

ClawDiary 是一个面向 AI Agent 的轻量级云端审计、拦截与日记网关，完全运行在 Cloudflare Workers 上。

**本仓库为 API 专用版本**（无官网首页、时间轴 UI 与支付）。如需开箱即用的完整服务（含 Web 控制台与付费计划），请使用已稳定上线的 **[clawdiary.org](https://clawdiary.org)**。

**核心能力：**

- **被动审计** — Agent 执行完毕后上报操作与消耗，异步入库，零延迟
- **主动拦截** — 高危操作自动分级，红灯动作挂起请求直到 Telegram 人工审批
- **共享日记** — 一个主人（owner）、多台设备（lobster）共用一本日记
- **每日简报** — Cron 定时推送消耗与拦截统计到 Telegram
- **多租户** — 基于 API Key 的用户隔离；付费与官网界面请使用 [clawdiary.org](https://clawdiary.org)

**快速上手：**

```bash
git clone https://github.com/your-org/claw-diary.git && cd claw-diary
npm install
cp wrangler.example.toml wrangler.toml  # 填入你的配置
npm run db:create                        # 创建 D1 数据库
npm run db:migrate                       # 执行迁移
wrangler secret put API_KEY              # 设置密钥
npm run dev                              # 本地开发
npm run deploy                           # 部署到 Cloudflare
```

详细配置与 API 文档请参阅上方英文部分。
