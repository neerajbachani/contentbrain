import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { memCache } from "../cache/memCache";
import { runTrendJob } from "../jobs/trendJob";

export const trendsRoute = new Hono()
  // GET /trends?niche=fitness,tech&source=all&limit=20
  .get("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const nicheParam = c.req.query("niche");
    const source = c.req.query("source") ?? "all";
    const limit = Math.min(Number(c.req.query("limit") ?? 20), 50);
    const niches = nicheParam ? nicheParam.split(",").filter(Boolean) : ["tech"];

    // Check rate limits
    const profile = await db
      .select()
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.userId, user.id))
      .get();

    const today = new Date().toISOString().slice(0, 10);
    // Cache key
    const cacheKey = `trends:${niches.sort().join(",")}:${source}:${limit}`;
    const cached = memCache.get<any[]>(cacheKey);
    if (cached) {
      return c.json({ trends: cached, fromCache: true }, 200);
    }

    // Check rate limits (only for non-cached requests)
    if (
      profile?.plan === "free" &&
      profile?.lastResetDate === today &&
      (profile?.trendCount ?? 0) >= 5
    ) {
      return c.json(
        { message: "Daily trend limit reached. Upgrade to Premium.", limitReached: true },
        403
      );
    }

    // Check DB for fresh trends (not expired)
    const now = new Date();
    let dbTrends = await db
      .select()
      .from(schema.trends)
      .where(
        inArray(schema.trends.niche, niches)
      )
      .orderBy(desc(schema.trends.engagementScore))
      .limit(limit);

    // Filter out expired
    dbTrends = dbTrends.filter((t) => !t.expiresAt || t.expiresAt > now);

    // Filter by source if specified
    if (source !== "all") {
      dbTrends = dbTrends.filter((t) => t.platform === source);
    }

    // If DB is stale/empty, trigger a fresh fetch in background
    if (dbTrends.length < 5) {
      runTrendJob({ niches, includeNewsData: true }).catch(console.error);
      // Also do a quick Reddit + News + RSS fetch synchronously for immediate response
      const { fetchRedditTrends } = await import("../services/reddit/redditScraper");
      const { fetchNewsDataTrends } = await import("../services/news/newsDataScraper");
      const { fetchGoogleRssTrends } = await import("../services/news/googleRss");
      const { aggregateTrends } = await import("../services/normalizer");

      const [redditItems, newsItems, rssItems] = await Promise.all([
        fetchRedditTrends(niches).catch(() => []),
        fetchNewsDataTrends(niches).catch(() => []),
        fetchGoogleRssTrends(niches).catch(() => []),
      ]);

      const freshItems = aggregateTrends(redditItems, newsItems, rssItems);

      if (freshItems.length > 0) {
        await db
          .insert(schema.trends)
          .values(
            freshItems.map((t) => ({
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
            }))
          )
          .onConflictDoNothing()
          .catch(() => {});

        // Re-query
        dbTrends = await db
          .select()
          .from(schema.trends)
          .where(inArray(schema.trends.niche, niches))
          .orderBy(desc(schema.trends.engagementScore))
          .limit(limit);
      }
    }

    // Cache for 10 minutes
    memCache.set(cacheKey, dbTrends, 600);

    // Update trend count
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

    return c.json({ trends: dbTrends, fromCache: false }, 200);
  })

  // POST /trends/refresh — manual refresh (rate-limited)
  .post("/refresh", requireAuth, async (c) => {
    const THROTTLE_KEY = "trend_refresh_last";
    const last = memCache.get<number>(THROTTLE_KEY);

    if (last && Date.now() - last < 30 * 60 * 1000) {
      const waitMin = Math.ceil((30 * 60 * 1000 - (Date.now() - last)) / 60000);
      return c.json({ error: `Refresh available in ${waitMin} minutes` }, 429);
    }

    // Run in background — RULE 7: free users no refresh
    const user = c.get("user")!;
    const profile = await db
      .select()
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.userId, user.id))
      .get();

    if (profile?.plan !== "premium") {
      return c.json({ error: "Manual refresh is a Premium feature" }, 403);
    }

    memCache.set(THROTTLE_KEY, Date.now(), 1800);
    runTrendJob({ includeNewsData: true }).catch(console.error);

    return c.json({ message: "Refresh started — new trends will appear in ~30 seconds" }, 200);
  });
