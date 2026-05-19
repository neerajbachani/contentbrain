import { fetchRedditTrends } from "../services/reddit/redditScraper";
import { fetchApifyXTrendFallback, fetchXTrends } from "../services/apify/xScraper";
import { fetchNewsDataTrends } from "../services/news/newsDataScraper";
import { fetchGoogleRssTrends } from "../services/news/googleRss";
import { aggregateTrends, deduplicateTrendsByUrl, TrendItem } from "../services/normalizer";
import { db } from "../database";
import * as schema from "../database/schema";
import { lt } from "drizzle-orm";
import { memCache } from "../cache/memCache";
import { ALL_NICHES } from "../services/nicheData";
import { persistTrendItems } from "../services/trendStorage";
import { logTrends, platformBreakdown } from "../services/trendsLogger";
import { fetchNicheXTrendsViaXai } from "../services/x/xTrendScraper";

export interface TrendJobOptions {
  includeApify?: boolean;
  includeXai?: boolean;
  xaiUserId?: string;
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
    includeApify = false,
    includeXai = false,
    xaiUserId,
    includeNewsData = true,
    googleRssOnly = false,
    niches = ALL_NICHES,
    maxItemsPerPlatform,
  } = options;

  const jobMode = getJobMode(options);
  const cap = (items: TrendItem[]) =>
    maxItemsPerPlatform ? items.slice(0, maxItemsPerPlatform) : items;

  try {
    const [reddit, newsdata, googleRss] = await Promise.allSettled([
      googleRssOnly ? Promise.resolve([]) : fetchRedditTrends(niches),
      includeNewsData && !googleRssOnly ? fetchNewsDataTrends(niches) : Promise.resolve([]),
      fetchGoogleRssTrends(niches),
    ]);

    let xData: TrendItem[] = [];

    if (!googleRssOnly) {
      if (includeXai && xaiUserId) {
        xData = await fetchNicheXTrendsViaXai(xaiUserId, niches, 10).catch(() => []);
        logTrends("job_x_oauth", { count: xData.length, userId: xaiUserId });
      }

      if (xData.length === 0 && includeApify) {
        const apifyX = await fetchXTrends(niches).catch(() => []);
        xData = cap(apifyX);
        logTrends("job_x_apify", { count: xData.length });
      }

      if (includeApify && xData.length < 5) {
        const fallback = await fetchApifyXTrendFallback(5);
        const seen = new Set(xData.map((t) => t.url).filter(Boolean));
        for (const item of fallback) {
          if (item.url && seen.has(item.url)) continue;
          if (item.url) seen.add(item.url);
          xData.push(item);
        }
        xData = cap(xData);
      }
    }

    const redditData = cap(reddit.status === "fulfilled" ? reddit.value : []);
    const newsdataData = cap(newsdata.status === "fulfilled" ? newsdata.value : []);
    const googleData = cap(googleRss.status === "fulfilled" ? googleRss.value : []);

    logTrends("job_fetched", {
      mode: jobMode,
      reddit: redditData.length,
      x: xData.length,
      news: newsdataData.length,
      rss: googleData.length,
    });

    const aggregated = aggregateTrends(redditData, xData, newsdataData, googleData);
    const beforeDedupe = aggregated.length;
    const deduped = deduplicateTrendsByUrl(aggregated);

    logTrends("job_deduped", {
      before: beforeDedupe,
      after: deduped.length,
      breakdown: platformBreakdown(deduped.map((t) => ({ platform: t.source }))),
    });

    if (deduped.length === 0) {
      logTrends("job_skip_empty", { mode: jobMode }, "warn");
      return 0;
    }

    await db
      .delete(schema.trends)
      .where(lt(schema.trends.expiresAt, new Date()));

    const stored = await persistTrendItems(deduped);
    memCache.flush();

    logTrends("job_complete", { mode: jobMode, stored });
    return stored;
  } catch (err) {
    logTrends(
      "job_failed",
      { error: err instanceof Error ? err.message : String(err) },
      "error"
    );
    return 0;
  }
}
