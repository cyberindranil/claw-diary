-- All timestamps stored in UTC (D1/SQLite datetime).

-- ===== Multi-tenant user & subscription tables =====

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    telegram_id TEXT UNIQUE NOT NULL,
    telegram_username TEXT,
    display_name TEXT,
    plan TEXT DEFAULT 'free',
    plan_expires_at DATETIME,
    paddle_customer_id TEXT,
    paddle_subscription_id TEXT,
    preferred_lang TEXT DEFAULT 'en',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- For existing DBs: ALTER TABLE users ADD COLUMN preferred_lang TEXT DEFAULT 'en';

CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);

CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    name TEXT DEFAULT 'default',
    last_used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

CREATE TABLE IF NOT EXISTS usage_daily (
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    audit_count INTEGER DEFAULT 0,
    guard_count INTEGER DEFAULT 0,
    diary_count INTEGER DEFAULT 0,
    total_cost REAL DEFAULT 0,
    PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS invite_codes (
    code TEXT PRIMARY KEY,
    plan TEXT DEFAULT 'pro',
    duration_days INTEGER DEFAULT 30,
    created_by TEXT,
    used_by TEXT,
    used_at DATETIME,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_members (
    team_owner_id TEXT NOT NULL,
    member_user_id TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (team_owner_id, member_user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_member ON team_members(member_user_id);

-- ===== Existing tables (with user_id for tenant isolation) =====

CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    agent_id TEXT NOT NULL,
    session_id TEXT,
    action_type TEXT,
    cost REAL DEFAULT 0.0,
    payload TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_logs_agent_id ON logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_logs_session_id ON logs(session_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id);

CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    agent_id TEXT NOT NULL,
    requested_action TEXT,
    risk_level TEXT,
    status TEXT DEFAULT 'PENDING',
    reviewer_note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_created_at ON approvals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approvals_user_id ON approvals(user_id);

CREATE TABLE IF NOT EXISTS diary_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    owner_id TEXT NOT NULL,
    lobster_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_diary_entries_owner_id ON diary_entries(owner_id);
CREATE INDEX IF NOT EXISTS idx_diary_entries_created_at ON diary_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diary_entries_user_id ON diary_entries(user_id);
