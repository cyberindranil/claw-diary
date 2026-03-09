const GREEN_ACTIONS = new Set([
  "search_web",
  "read_file",
  "get_weather",
  "list_files",
  "calculate",
  "translate",
  "read_file_content",
  "browse",
]);

const RED_PATTERNS: RegExp[] = [
  /\brm\s+/i,
  /\brm\s+-rf\s+/i,
  /\bdrop\s+(table|database)/i,
  /\bdelete\s+(from|table)/i,
  /\bsend_mail\b/i,
  /\btransfer(_money)?\b/i,
  /\bexecute_bash\b/i,
  /\bsql_query\b/i,
  /\bshutdown\b/i,
  /\bformat\s+/i,
  /\bchmod\s+/i,
  /\bcurl\s+.*\|\s*sh\b/i,
  /\bwget\s+.*\|\s*sh\b/i,
  /\bdd\s+if=/i,
  /\bmkfs\./i,
];

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ClassifyResult =
  | { approved: true; risk: RiskLevel; logOnly: true }
  | { approved: false; risk: RiskLevel; needsApproval: true };

/**
 * 先看 action_type 是否在绿灯集合 -> 直接放行并记日记；
 * 再对 command 做红灯正则检测 -> 命中则需人工审批。
 * 未识别动作默认 MEDIUM，记录但放行。
 */
export function classify(
  actionType?: string,
  command?: string
): ClassifyResult {
  const action = (actionType ?? "").trim().toLowerCase();
  const cmd = (command ?? "").trim();

  if (action && GREEN_ACTIONS.has(action)) {
    return { approved: true, risk: "LOW", logOnly: true };
  }

  for (const re of RED_PATTERNS) {
    if (re.test(cmd)) {
      const level: RiskLevel =
        /rm\s+-rf|drop\s+(table|database)|format\s+|dd\s+if=|mkfs\./i.test(cmd)
          ? "CRITICAL"
          : /execute_bash|transfer|send_mail|sql_query/i.test(cmd)
            ? "HIGH"
            : "MEDIUM";
      return { approved: false, risk: level, needsApproval: true };
    }
  }

  return { approved: true, risk: "MEDIUM", logOnly: true };
}
