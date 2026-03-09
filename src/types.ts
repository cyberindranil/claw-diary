export type PlanType = "free" | "pro" | "team";

export type Env = {
  DB: D1Database;
  GUARD_SESSION: DurableObjectNamespace;
  /** Fallback admin key; multi-tenant keys live in api_keys table */
  API_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  /** Admin chat ID for system-level notifications */
  TELEGRAM_CHAT_ID?: string;
  APEX_DOMAIN?: string;
};

export type UserContext = {
  userId: string;
  plan: PlanType;
  telegramId: string;
  /** Preferred UI language for bot/notifications: 'en' | 'zh' */
  preferredLang?: string;
  /** True when authenticated via the legacy env API_KEY */
  isAdmin: boolean;
  /** When set, quota is charged to this user (team owner); subscription follows this account. */
  quotaUserId?: string;
};

export type AuditBody = {
  agent_id: string;
  session_id?: string;
  action_type?: string;
  cost?: number;
  payload?: string | Record<string, unknown>;
};

export type GuardBody = {
  agent_id: string;
  action_type?: string;
  command?: string;
  params?: Record<string, unknown>;
  thought?: string;
};

export type LogRow = {
  id: string;
  agent_id: string;
  session_id: string | null;
  action_type: string | null;
  cost: number;
  payload: string | null;
  created_at: string;
};

export type ApprovalRow = {
  id: string;
  agent_id: string;
  requested_action: string;
  risk_level: string;
  status: string;
  reviewer_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type DiaryCreateBody = {
  owner_id: string;
  lobster_id: string;
  content: string;
};

export type DiaryEntryRow = {
  id: string;
  user_id: string | null;
  owner_id: string;
  lobster_id: string;
  content: string;
  created_at: string;
};

export type UserRow = {
  id: string;
  telegram_id: string;
  telegram_username: string | null;
  display_name: string | null;
  plan: PlanType;
  plan_expires_at: string | null;
  paddle_customer_id: string | null;
  paddle_subscription_id: string | null;
  preferred_lang: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiKeyRow = {
  id: string;
  user_id: string;
  key_hash: string;
  key_prefix: string;
  name: string;
  last_used_at: string | null;
  created_at: string;
};

export type UsageDailyRow = {
  user_id: string;
  date: string;
  audit_count: number;
  guard_count: number;
  diary_count: number;
  total_cost: number;
};

export type InviteCodeRow = {
  code: string;
  plan: PlanType;
  duration_days: number;
  created_by: string | null;
  used_by: string | null;
  used_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type TeamMemberRow = {
  team_owner_id: string;
  member_user_id: string;
  role: string;
  created_at: string;
};
