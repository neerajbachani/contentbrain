import { fetchXTrends } from "./apify/xScraper";
import { fetchGoogleRssTrends } from "./news/googleRss";
import { fetchNewsDataTrends } from "./news/newsDataScraper";
import { aggregateTrends, TrendItem } from "./normalizer";
import { fetchRedditTrends } from "./reddit/redditScraper";
import { logTrends } from "./trendsLogger";
import { fetchNicheXTrendsViaXai } from "./x/xTrendScraper";

export interface FetchTrendSourcesOptions {
  userId?: string;
  includeApify?: boolean;
  includeNewsData?: boolean;
  xLimit?: number;
}

/**
 * Fetch trends from all platforms. X priority: user OAuth → Apify fallback.
 */
export async function fetchTrendSourcesForNiches(
  niches: string[],
  options: FetchTrendSourcesOptions = {}
): Promise<TrendItem[]> {
  const { userId, includeApify = false, includeNewsData = true, xLimit = 8 } = options;

  logTrends("fetch_sources_start", {
    niches,
    userId: userId ?? null,
    includeApify,
    includeNewsData,
  });

  const [redditItems, newsItems, rssItems] = await Promise.all([
    fetchRedditTrends(niches).catch((err) => {
      logTrends("fetch_reddit_failed", { error: String(err) }, "warn");
      return [];
    }),
    includeNewsData
      ? fetchNewsDataTrends(niches).catch((err) => {
          logTrends("fetch_news_failed", { error: String(err) }, "warn");
          return [];
        })
      : Promise.resolve([]),
    fetchGoogleRssTrends(niches).catch((err) => {
      logTrends("fetch_rss_failed", { error: String(err) }, "warn");
      return [];
    }),
  ]);

  let xItems: TrendItem[] = [];
  if (userId) {
    xItems = await fetchNicheXTrendsViaXai(userId, niches, xLimit).catch((err) => {
      logTrends("fetch_x_oauth_failed", { error: String(err) }, "warn");
      return [];
    });
  }

  if (xItems.length === 0 && includeApify && process.env.APIFY_API_TOKEN) {
    logTrends("fetch_x_apify_fallback", { niches });
    xItems = await fetchXTrends(niches).catch((err) => {
      logTrends("fetch_x_apify_failed", { error: String(err) }, "warn");
      return [];
    });
  }

  const aggregated = aggregateTrends(redditItems, xItems, newsItems, rssItems);
  logTrends("fetch_sources_done", {
    reddit: redditItems.length,
    x: xItems.length,
    news: newsItems.length,
    rss: rssItems.length,
    aggregated: aggregated.length,
  });

  return aggregated;
}
