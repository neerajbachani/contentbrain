import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { deduplicateTrendsByUrl } from "./normalizer";
import { logTrends, platformBreakdown } from "./trendsLogger";

const TREND_PLATFORMS = ["reddit", "x", "newsdata", "google_rss"] as const;
const PER_PLATFORM_CAP = 30;

type DbTrend = typeof schema.trends.$inferSelect;

/**
 * Load trend candidates per platform so low-score news/rss rows are not
 * excluded by a single global engagement sort.
 */
export async function fetchTrendCandidatesFromDb(
  niches: string[],
  now: Date = new Date()
): Promise<DbTrend[]> {
  const pools: DbTrend[] = [];
  const rawBreakdown: Record<string, number> = {};

  for (const platform of TREND_PLATFORMS) {
    const rows = await db
      .select()
      .from(schema.trends)
      .where(and(inArray(schema.trends.niche, niches), eq(schema.trends.platform, platform)))
      .orderBy(desc(schema.trends.engagementScore))
      .limit(PER_PLATFORM_CAP);

    rawBreakdown[platform] = rows.length;
    const fresh = rows.filter((t) => !t.expiresAt || t.expiresAt > now);
    pools.push(...fresh);
  }

  const candidates = deduplicateTrendsByUrl(pools);

  logTrends("db_candidates", {
    niches,
    dbRawBreakdown: rawBreakdown,
    dbCandidateBreakdown: platformBreakdown(candidates),
    dbCandidateCount: candidates.length,
  });

  return candidates;
}
