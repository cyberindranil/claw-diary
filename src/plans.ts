import type { PlanType } from "./types";

export type PlanLimits = {
  keys: number;
  guard: number;
  audit: number;
  diary: number;
  teamMembers: number;
  telegramNotify: boolean;
  dailyDigest: boolean;
};

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    keys: 1,
    guard: 50,
    audit: 200,
    diary: 10,
    teamMembers: 0,
    telegramNotify: false,
    dailyDigest: false,
  },
  pro: {
    keys: 5,
    guard: 2000,
    audit: 10000,
    diary: 200,
    teamMembers: 0,
    telegramNotify: true,
    dailyDigest: true,
  },
  team: {
    keys: 20,
    guard: 10000,
    audit: 50000,
    diary: 1000,
    teamMembers: 6,
    telegramNotify: true,
    dailyDigest: true,
  },
} as const;

export function getLimits(plan: PlanType): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

/** Returns true when a paid plan has passed its expiry date. */
export function isPlanExpired(plan: PlanType, expiresAt: string | null): boolean {
  if (plan === "free") return false;
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

/** Effective plan: downgrades to free when expired. */
export function effectivePlan(plan: PlanType, expiresAt: string | null): PlanType {
  return isPlanExpired(plan, expiresAt) ? "free" : plan;
}
