import { spawnSync } from "node:child_process";

const DB_NAME = process.env.D1_DB_NAME || "clawdiary-main-db";
const mode = process.argv.includes("--local") ? "--local" : "--remote";

function runWrangler(args, { allowErrorSubstrings = [] } = {}) {
  const res = spawnSync("wrangler", args, { encoding: "utf8" });
  const out = `${res.stdout ?? ""}${res.stderr ?? ""}`;

  if (res.status === 0) return { ok: true, out };

  const allowed = allowErrorSubstrings.some((s) => out.includes(s));
  if (allowed) return { ok: true, out };

  return { ok: false, out, status: res.status ?? 1 };
}

function execOrThrow(args, opts) {
  const r = runWrangler(args, opts);
  if (!r.ok) {
    process.stderr.write(r.out);
    process.exit(r.status || 1);
  }
}

function alterAddColumn(table, column, type) {
  execOrThrow(
    ["d1", "execute", DB_NAME, mode, "--command", `ALTER TABLE ${table} ADD COLUMN ${column} ${type};`],
    {
      allowErrorSubstrings: [
        "duplicate column name",
        "no such table",
        "SQLITE_ERROR: duplicate column name",
        "SQLITE_ERROR: no such table",
      ],
    }
  );
}

// 1) Make schema forward-compatible for existing DBs.
// These ALTERs are safe to run on:
// - old DBs: adds missing columns
// - new DBs: tables not yet created -> ignored (no such table)
// - already-migrated DBs: column exists -> ignored (duplicate column name)
alterAddColumn("logs", "user_id", "TEXT");
alterAddColumn("approvals", "user_id", "TEXT");
alterAddColumn("diary_entries", "user_id", "TEXT");
alterAddColumn("users", "paddle_customer_id", "TEXT");
alterAddColumn("users", "paddle_subscription_id", "TEXT");
alterAddColumn("users", "preferred_lang", "TEXT DEFAULT 'en'");

// 2) Apply the main schema (tables + indexes).
execOrThrow(["d1", "execute", DB_NAME, mode, "--file", "./schema.sql"]);

process.stdout.write(`OK: migrated ${DB_NAME} (${mode})\n`);

