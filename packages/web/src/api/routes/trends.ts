import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { memCache } from "../cache/memCache";
import { runTrendJob } from "../jobs/trendJob";
import { FREE_LIMITS, hasPremiumAccess } from "../config/limits";
import {
  balanceTrendFeed,
  deduplicateTrendsByUrl,
  TrendItem,
} from "../services/normalizer";
import { fetchTrendCandidatesFromDb } from "../services/trendCandidates";
import { fetchTrendSourcesForNiches } from "../services/trendFetch";
import { persistTrendItems } from "../services/trendStorage";
import { logTrends, platformBreakdown } from "../services/trendsLogger";
import { hasUserXaiCredentials } from "../services/x/credentials";
import { fetchXTrendBundle } from "../services/x/xTrendScraper";
import type { TodayXNewsGroup } from "../services/x/xTrendTypes";

type DbTrend = typeof schema.trends.$inferSelect;

type TrendsCachePayload = {
  trends: DbTrend[];
  todayXNews: TodayXNewsGroupApi[];
};

export type TodayXNewsGroupApi = {
  headline: DbTrend;
  relatedPosts: DbTrend[];
};

function trendItemToDbRow(t: TrendItem): DbTrend {
  return {
    id: t.id,
    platform: t.source,
    platformDisplay: t.platformDisplay,
    niche: t.niche,
    title: t.title,
    url: t.url ?? null,
    summary: t.summary ?? null,
    thumbnailUrl: t.thumbnailUrl ?? null,
    author: t.author ?? null,
    engagementScore: t.engagementScore,
    scrapedAt: new Date(t.scrapedAt),
    expiresAt: new Date(t.expiresAt),
  };
}

function todayNewsToApi(groups: TodayXNewsGroup[]): TodayXNewsGroupApi[] {
  return groups.map((g) => ({
    headline: trendItemToDbRow(g.headline),
    relatedPosts: g.relatedPosts.map(trendItemToDbRow),
  }));
}

function collectTodayUrls(groups: TodayXNewsGroupApi[]): Set<string> {
  const urls = new Set<string>();
  for (const g of groups) {
    if (g.headline.url) urls.add(g.headline.url);
    for (const r of g.relatedPosts) {
      if (r.url) urls.add(r.url);
    }
  }
  return urls;
}

export const trendsRoute = new Hono()
  .get("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const nicheParam = c.req.query("niche");
    const source = c.req.query("source") ?? "all";
    const limit = Math.min(Number(c.req.query("limit") ?? 20), 50);
    const niches = nicheParam ? nicheParam.split(",").filter(Boolean) : ["tech"];

    const profile = await db
      .select()
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.userId, user.id))
      .get();

    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = `trends:v2:${user.id}:${niches.sort().join(",")}:${source}:${limit}`;
    const cached = memCache.get<TrendsCachePayload>(cacheKey);
    if (cached) {
      logTrends("api_cache_hit", { userId: user.id, niches, source, limit });
      return c.json({ trends: cached.trends, todayXNews: cached.todayXNews, fromCache: true }, 200);
    }

    if (
      !hasPremiumAccess(profile?.plan) &&
      profile?.lastResetDate === today &&
      (profile?.trendCount ?? 0) >= FREE_LIMITS.dailyTrendFetches
    ) {
      return c.json(
        {
          message: `Daily trend limit reached (${FREE_LIMITS.dailyTrendFetches}/day). Upgrade to Premium.`,
          limitReached: true,
        },
        403
      );
    }

    const xOAuthAvailable = await hasUserXaiCredentials(user.id);
    const includeApify =
      !!process.env.APIFY_API_TOKEN && process.env.APIFY_X_TRENDS_ENABLED !== "false";

    logTrends("api_request", {
      userId: user.id,
      niches,
      source,
      limit,
      xOAuthAvailable,
      includeApify,
    });

    const now = new Date();
    let dbTrends = await fetchTrendCandidatesFromDb(niches, now);

    logTrends("api_db_read", {
      dbCount: dbTrends.length,
      breakdown: platformBreakdown(dbTrends),
    });

    let didStaleFetch = false;
    if (dbTrends.length < 5) {
      didStaleFetch = true;
      logTrends("api_stale_fetch", { dbCount: dbTrends.length, niches });
      try {
        const freshItems = await fetchTrendSourcesForNiches(niches, {
          userId: user.id,
          includeApify,
          includeNewsData: true,
          xLimit: 10,
        });

        if (freshItems.length > 0) {
          const inserted = await persistTrendItems(freshItems);
          logTrends("api_stale_inserted", { inserted });
          dbTrends = await fetchTrendCandidatesFromDb(niches, now);
        }
      } catch (err) {
        logTrends(
          "api_stale_fetch_failed",
          { error: err instanceof Error ? err.message : String(err) },
          "error"
        );
      }
    }

    let todayXNews: TodayXNewsGroupApi[] = [];
    let liveXNiche: TrendItem[] = [];

    if (xOAuthAvailable) {
      const bundleCacheKey = `trends:bundle:${user.id}:${niches.sort().join(",")}`;
      let bundle = memCache.get<{ todayXNews: TodayXNewsGroup[]; nichePosts: TrendItem[] }>(
        bundleCacheKey
      );

      if (!bundle) {
        logTrends("api_x_bundle_fetch", { userId: user.id, niches });
        bundle = await fetchXTrendBundle(user.id, niches, 10);
        memCache.set(bundleCacheKey, bundle, 600);
      } else {
        logTrends("api_x_bundle_cache_hit", { userId: user.id });
      }

      todayXNews = todayNewsToApi(bundle.todayXNews);
      liveXNiche = bundle.nichePosts;

      const todayUrls = collectTodayUrls(todayXNews);
      const liveRows = liveXNiche
        .filter((t) => !t.url || !todayUrls.has(t.url))
        .map(trendItemToDbRow);

      const withoutX = dbTrends.filter((t) => t.platform !== "x");
      dbTrends = deduplicateTrendsByUrl([...liveRows, ...withoutX]);
      logTrends("api_live_x_merged", {
        todayXNewsCount: todayXNews.length,
        nicheLiveCount: liveRows.length,
        relatedGroupSizes: todayXNews.map((g) => g.relatedPosts.length),
        viralHeadlines: todayXNews.length,
      });
    } else if (!didStaleFetch) {
      // legacy path without bundle when oauth unavailable
    }

    let responseTrends: DbTrend[] = [...dbTrends];

    logTrends("api_pre_balance", {
      count: responseTrends.length,
      breakdown: platformBreakdown(responseTrends),
    });

    if (source !== "all") {
      responseTrends = responseTrends.filter((t) => t.platform === source);
    }

    responseTrends = balanceTrendFeed(responseTrends, limit);

    logTrends("api_response", {
      count: responseTrends.length,
      breakdown: platformBreakdown(responseTrends),
      todayXNewsCount: todayXNews.length,
    });

    const payload: TrendsCachePayload = { trends: responseTrends, todayXNews };
    memCache.set(cacheKey, payload, 600);

    if (profile) {
      await db
        .update(schema.userProfiles)
        .set({
          trendCount:
            profile.lastResetDate !== today ? 1 : (profile.trendCount ?? 0) + 1,
          lastResetDate: today,
        })
        .where(eq(schema.userProfiles.userId, user.id));
    }

    return c.json({ trends: responseTrends, todayXNews, fromCache: false }, 200);
  })

  .post("/refresh", requireAuth, async (c) => {
    const THROTTLE_KEY = "trend_refresh_last";
    const last = memCache.get<number>(THROTTLE_KEY);

    if (last && Date.now() - last < 30 * 60 * 1000) {
      const waitMin = Math.ceil((30 * 60 * 1000 - (Date.now() - last)) / 60000);
      return c.json({ error: `Refresh available in ${waitMin} minutes` }, 429);
    }

    const user = c.get("user")!;
    const profile = await db
      .select()
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.userId, user.id))
      .get();

    if (!hasPremiumAccess(profile?.plan)) {
      return c.json({ error: "Manual refresh is a Premium feature" }, 403);
    }

    memCache.set(THROTTLE_KEY, Date.now(), 1800);
    const includeApify =
      !!process.env.APIFY_API_TOKEN && process.env.APIFY_X_TRENDS_ENABLED !== "false";

    logTrends("api_refresh_start", { userId: user.id, includeApify });

    runTrendJob({
      includeNewsData: true,
      includeApify,
      includeXai: true,
      xaiUserId: user.id,
    }).catch((err) => {
      logTrends("api_refresh_job_failed", { error: String(err) }, "error");
    });

    return c.json({ message: "Refresh started — new trends will appear in ~30 seconds" }, 200);
  });
