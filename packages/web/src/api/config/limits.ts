/**
 * Free-tier caps (env-overridable). Premium / DEV_GRANT_PREMIUM = unlimited.
 */
export const FREE_LIMITS = {
  maxInspirations: parseInt(process.env.FREE_MAX_INSPIRATIONS ?? "30", 10),
  dailyRemixes: parseInt(process.env.FREE_DAILY_REMIXES ?? "20", 10),
  dailyMerges: parseInt(process.env.FREE_DAILY_MERGES ?? "10", 10),
  dailyTrendFetches: parseInt(process.env.FREE_DAILY_TRENDS ?? "20", 10),
} as const;

/** When true, free users get premium features (live X context, research, trend refresh). */
export function hasPremiumAccess(plan: string | undefined | null): boolean {
  if (plan === "premium") return true;
  return process.env.DEV_GRANT_PREMIUM === "true";
}

export function getLimitsForClient(plan: string | undefined | null) {
  const premium = hasPremiumAccess(plan);
  return {
    isPremium: premium,
    inspirations: premium ? null : FREE_LIMITS.maxInspirations,
    dailyRemixes: premium ? null : FREE_LIMITS.dailyRemixes,
    dailyMerges: premium ? null : FREE_LIMITS.dailyMerges,
    dailyTrends: premium ? null : FREE_LIMITS.dailyTrendFetches,
  };
}
