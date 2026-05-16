import { fetchRedditTrends } from "../services/reddit/redditScraper";
import { fetchXTrends } from "../services/apify/xScraper";
import { fetchNewsDataTrends } from "../services/news/newsDataScraper";
import { fetchGoogleRssTrends } from "../services/news/googleRss";
import { aggregateTrends, TrendItem } from "../services/normalizer";
import { db } from "../database";
import * as schema from "../database/schema";
import { lt } from "drizzle-orm";
import { memCache } from "../cache/memCache";
import { ALL_NICHES } from "../services/nicheData";

export interface TrendJobOptions {
  includeApify?: boolean;
  includeNewsData?: boolean;
  googleRssOnly?: boolean;
  niches?: string[];
}

export async function runTrendJob(options: TrendJobOptions = {}): Promise<number> {
  const {
    includeApify = false, // Default off — expensive
    includeNewsData = true,
    googleRssOnly = false,
    niches = ALL_NICHES,
  } = options;

  try {
    // Run sources in parallel, settle all
    const [reddit, x, newsdata, googleRss] = await Promise.allSettled([
      googleRssOnly ? Promise.resolve([]) : fetchRedditTrends(niches),
      includeApify && !googleRssOnly ? fetchXTrends(niches) : Promise.resolve([]),
      includeNewsData && !googleRssOnly ? fetchNewsDataTrends(niches) : Promise.resolve([]),
      fetchGoogleRssTrends(niches),
    ]);

    const redditData   = reddit.status    === "fulfilled" ? reddit.value    : [];
    const xData        = x.status         === "fulfilled" ? x.value         : [];
    const newsdataData = newsdata.status   === "fulfilled" ? newsdata.value  : [];
    const googleData   = googleRss.status  === "fulfilled" ? googleRss.value : [];

    console.log(
      `[TrendJob] Fetched: Reddit=${redditData.length} X=${xData.length} News=${newsdataData.length} RSS=${googleData.length}`
    );

    const aggregated = aggregateTrends(redditData, xData, newsdataData, googleData);

    if (aggregated.length === 0) {
      console.warn("[TrendJob] No items aggregated — skipping DB write");
      return 0;
    }

    // Delete expired trends first
    await db
      .delete(schema.trends)
      .where(lt(schema.trends.expiresAt, new Date()));

    // Insert in chunks of 50
    for (let i = 0; i < aggregated.length; i += 50) {
      const chunk = aggregated.slice(i, i + 50);
      await db
        .insert(schema.trends)
        .values(
          chunk.map((t: TrendItem) => ({
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
        .onConflictDoNothing();
    }

    // Bust cache
    memCache.flush();

    console.log(`[TrendJob] Complete — ${aggregated.length} items stored`);
    return aggregated.length;
  } catch (err) {
    console.error("[TrendJob] Failed:", err);
    return 0;
  }
}
