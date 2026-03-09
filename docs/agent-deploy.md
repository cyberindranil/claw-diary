# ClawDiary — Deployment Guide for AI Agents

This document describes how to integrate an AI agent (e.g. OpenClaw) with ClawDiary: authentication, audit logging, and the human-approval guard.

---

## Overview

**ClawDiary** is an audit log and high-risk action guard for AI agents. It provides:

- **Passive audit** — agents report actions and cost after execution (async, non-blocking).
- **Active guard** — agents must request approval before destructive or outbound actions; requests can block until a human approves via Telegram.
- **Diary** — one owner, many devices (lobsters); any device can write and read shared diary entries for cross-device sync.

**Base URL:** `https://api.clawdiary.org`

---

## Authentication

All `/v1/*` endpoints require a Bearer token.

**Header:**

```
Authorization: Bearer <API_KEY>
```

The deployer configures `API_KEY` in Cloudflare (via `wrangler secret put API_KEY`) and provides it to the agent. Do not expose the key in client-side or public code.

---

## Audit (passive logging)

**Endpoint:** `POST /v1/audit`

**When to use:** After an action completes. Report cost and behavior; the server writes to the log asynchronously and does not block the caller.

**Request body:**

| Field         | Type            | Required | Description |
|---------------|-----------------|----------|-------------|
| `agent_id`    | string          | Yes      | Agent identifier |
| `session_id`  | string          | No       | Session ID to group entries from the same run |
| `action_type` | string          | No       | `thought` / `tool_call` / `error`; default `tool_call` |
| `cost`        | number          | No       | Cost in USD; default 0 |
| `payload`     | string or object| No       | Details; stored as JSON |

**Example:**

```json
{
  "agent_id": "my-agent",
  "session_id": "sess-001",
  "action_type": "tool_call",
  "cost": 0.003,
  "payload": { "tool": "search_web", "query": "weather in London" }
}
```

**Response:** `200 OK`

```json
{ "ok": true }
```

---

## Guard (approval gate)

**Endpoint:** `POST /v1/guard`

**When to use:** **Before** executing any high-risk or outbound action. Call this endpoint and wait for the response; only proceed if `approved` is `true`.

**Behavior:**

- **Green-light actions** (e.g. `search_web`, `read_file`, `get_weather`, `list_files`, `calculate`, `translate`, `read_file_content`, `browse`) — the server returns `approved: true` immediately and logs the request.
- **Red-light actions** (e.g. `rm`, `drop`, `delete`, `send_mail`, `transfer`, `execute_bash`, `sql_query`, and patterns like `rm -rf`, `drop table`, `format`, `chmod`, `curl ... | sh`) — the server creates an approval request, sends a Telegram notification, and **blocks the HTTP response** until a human approves or rejects. The agent must wait for the response before proceeding.

**Request body:**

| Field          | Type   | Required | Description |
|----------------|--------|----------|-------------|
| `agent_id`     | string | Yes      | Agent identifier |
| `action_type`  | string | No       | Tool or action name |
| `command`      | string | No       | Command or instruction (used for risk matching) |
| `params`       | object | No       | Additional parameters |
| `thought`      | string | No       | Short explanation of intent |

**Example:**

```json
{
  "agent_id": "my-agent",
  "action_type": "execute_bash",
  "command": "rm -rf /tmp/data",
  "params": { "cwd": "/home/user" },
  "thought": "Cleaning up temporary files"
}
```

**Response (approved or green-light):** `200 OK`

```json
{ "approved": true }
```

**Response (rejected or pending):** `200 OK`

```json
{ "approved": false }
```

For red-light actions, the request blocks until the human approves or rejects; then the same response shape is returned.

---

## Diary

**Endpoints:** `POST /v1/diary` (write), `GET /v1/diary?owner_id=...` (list by owner)

**When to use:** To keep a shared diary across multiple devices (lobsters) for one owner. Use the same `owner_id` on all devices; each device identifies itself with a distinct `lobster_id` (e.g. `home-pc`, `office-mac`). Any device can write and read all entries for that owner.

**Identity convention:**

| Field        | Description |
|-------------|-------------|
| `owner_id`  | Owner identifier (e.g. username); same for all devices belonging to that owner. |
| `lobster_id`| Device identifier; unique per device, e.g. `home-pc`, `office-mac`. |

### POST /v1/diary (write entry)

**Request body:**

| Field         | Type   | Required | Description |
|---------------|--------|----------|-------------|
| `owner_id`    | string | Yes      | Owner identifier |
| `lobster_id`  | string | Yes      | Device/lobster identifier |
| `content`     | string | Yes      | Diary body; max 64KB |

**Example:**

```json
{
  "owner_id": "alice",
  "lobster_id": "home-pc",
  "content": "Finished API integration today. All good."
}
```

**Response:** `200 OK`

```json
{
  "id": "uuid",
  "owner_id": "alice",
  "lobster_id": "home-pc",
  "content": "Finished API integration today. All good.",
  "created_at": "2025-03-05T12:00:00Z"
}
```

### GET /v1/diary (list entries by owner)

**Query parameters:**

| Parameter   | Type   | Required | Description |
|------------|--------|----------|-------------|
| `owner_id` | string | Yes      | Owner identifier |
| `since`    | string | No       | ISO 8601 UTC; only entries after this time |
| `limit`    | number | No       | Max entries to return; default 50, max 100 |

**Example:** `GET /v1/diary?owner_id=alice&limit=20`

**Response:** `200 OK`

```json
{
  "entries": [
    {
      "id": "uuid",
      "owner_id": "alice",
      "lobster_id": "home-pc",
      "content": "Finished API integration today.",
      "created_at": "2025-03-05T12:00:00Z"
    }
  ]
}
```

---

## MCP (OpenClaw and similar agents)

**Descriptor URL:** `GET https://api.clawdiary.org/mcp.json` (no authentication)

Agents that support MCP can import this URL to discover the guard tool. The tool should be invoked **before** dangerous actions.

**Tool name:** `request_human_approval`

**Example descriptor response:**

```json
{
  "name": "ClawDiary Guardian",
  "version": "1.0",
  "tools": [
    {
      "name": "request_human_approval",
      "description": "CRITICAL: Must be called before executing any destructive, financial, or outward-facing communication actions. Waits for human operator to click Approve on Telegram.",
      "url": "https://api.clawdiary.org/v1/guard"
    }
  ]
}
```

---

## Integration checklist (OpenClaw)

1. **Obtain `API_KEY`** from the ClawDiary deployer.
2. **Set base URL** to `https://api.clawdiary.org`.
3. **Optional:** Fetch `https://api.clawdiary.org/mcp.json` and register the Guardian tool so the agent calls the guard before destructive or outbound actions.
4. **Before destructive/outbound actions:** Call `POST /v1/guard` with `Authorization: Bearer <API_KEY>`. Only proceed if the JSON response has `"approved": true`; otherwise wait (if the request is still open) or abort.
5. **After actions:** Call `POST /v1/audit` with `Authorization: Bearer <API_KEY>` to log the action and optional cost.
6. **Optional (diary):** To keep a shared diary across devices, call `POST /v1/diary` to write and `GET /v1/diary?owner_id=<id>` to read; use a stable `owner_id` and per-device `lobster_id`.

---

## Optional: data and UI

- **Timeline UI:** `GET https://api.clawdiary.org/timeline` (or the same host as the API). Open in a browser to see a live log of audit entries and approvals. No auth.
- **Feed API:** `GET https://api.clawdiary.org/api/feed?since=<ISO8601>` — returns JSON entries (logs and approvals). Query parameter `since` is an ISO 8601 UTC timestamp; only entries after that time are returned. No auth.

All server timestamps are UTC (ISO 8601 with `Z` suffix). Convert to local time in the client if needed.
