import { fetchRedditTrends } from "../services/reddit/redditScraper";
import { fetchApifyXTrendFallback, fetchXTrends } from "../services/apify/xScraper";
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
  maxItemsPerPlatform?: number;
}

function getJobMode(options: TrendJobOptions): string {
  if (options.maxItemsPerPlatform) return "bootstrap";
  if (options.googleRssOnly) return "rss-only";
  return "full";
}

export async function runTrendJob(options: TrendJobOptions = {}): Promise<number> {
  const {
    includeApify = false, // Default off — expensive
    includeNewsData = true,
    googleRssOnly = false,
    niches = ALL_NICHES,
    maxItemsPerPlatform,
  } = options;

  const jobMode = getJobMode(options);
  const cap = (items: TrendItem[]) =>
    maxItemsPerPlatform ? items.slice(0, maxItemsPerPlatform) : items;

  try {
    // Run sources in parallel, settle all
    const [reddit, x, newsdata, googleRss] = await Promise.allSettled([
      googleRssOnly ? Promise.resolve([]) : fetchRedditTrends(niches),
      includeApify && !googleRssOnly ? fetchXTrends(niches) : Promise.resolve([]),
      includeNewsData && !googleRssOnly ? fetchNewsDataTrends(niches) : Promise.resolve([]),
      fetchGoogleRssTrends(niches),
    ]);

    let xData = cap(x.status === "fulfilled" ? x.value : []);

    if (includeApify && !googleRssOnly && xData.length < 5) {
      const fallback = await fetchApifyXTrendFallback(5);
      const seen = new Set(xData.map((t) => t.url).filter(Boolean));
      for (const item of fallback) {
        if (item.url && seen.has(item.url)) continue;
        if (item.url) seen.add(item.url);
        xData.push(item);
      }
      xData = cap(xData);
    }

    const redditData   = cap(reddit.status    === "fulfilled" ? reddit.value    : []);
    const newsdataData = cap(newsdata.status   === "fulfilled" ? newsdata.value  : []);
    const googleData   = cap(googleRss.status  === "fulfilled" ? googleRss.value : []);

    const xStored = xData.filter((t) => t.source === "x").length;
    console.log(
      `[TrendJob][${jobMode}] Fetched: Reddit=${redditData.length} X=${xData.length} (x_platform=${xStored}) News=${newsdataData.length} RSS=${googleData.length}`
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
