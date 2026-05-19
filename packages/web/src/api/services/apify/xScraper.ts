import { NICHE_KEYWORDS } from "../nicheData";
import { normalizeTrend, TrendItem } from "../normalizer";
import { APIFY_TWITTER_ACTOR, runApifyActor } from "./apifyClient";

export async function fetchXTrends(niches: string[]): Promise<TrendItem[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.warn("[Apify] APIFY_API_TOKEN not set — skipping X trends");
    return [];
  }

  const results: TrendItem[] = [];

  for (const niche of niches) {
    const keywords = NICHE_KEYWORDS[niche.toLowerCase()] ?? [];
    const query = keywords.slice(0, 2).join(" OR ");

    try {
      const tweets = await runApifyActor(
        APIFY_TWITTER_ACTOR,
        {
          searchTerms: [query],
          maxItems: 10,
          sort: "Latest",
          language: "en",
        },
        token
      );

      for (const tweet of tweets) {
        if (!tweet.text) continue;
        results.push(
          normalizeTrend(
            {
              title: tweet.text.slice(0, 280),
              url: tweet.url,
              engagementScore: (tweet.retweetCount ?? 0) + (tweet.likeCount ?? 0),
              author: tweet.author?.userName ? `@${tweet.author.userName}` : undefined,
            },
            "x",
            niche
          )
        );
      }
    } catch (err) {
      console.error(`[Apify] Failed for niche ${niche}:`, err);
    }
  }

  return results;
}

/** Broad fallback when niche bootstrap returns fewer than min X items. */
export async function fetchApifyXTrendFallback(minItems = 5): Promise<TrendItem[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.warn("[Apify] APIFY_API_TOKEN not set — skipping X trend fallback");
    return [];
  }

  try {
    console.log(`[TrendJob] x_underflow — running broad Apify search (min ${minItems})`);
    const tweets = await runApifyActor(
      APIFY_TWITTER_ACTOR,
      {
        searchTerms: ["viral OR trending"],
        maxItems: Math.max(minItems, 10),
        sort: "Top",
        language: "en",
      },
      token,
      { maxWaitMs: 60_000, itemLimit: 15 }
    );

    const results: TrendItem[] = [];
    for (const tweet of tweets) {
      if (!tweet.text) continue;
      results.push(
        normalizeTrend(
          {
            title: tweet.text.slice(0, 280),
            url: tweet.url,
            engagementScore: (tweet.retweetCount ?? 0) + (tweet.likeCount ?? 0),
            author: tweet.author?.userName ? `@${tweet.author.userName}` : undefined,
          },
          "x",
          "general"
        )
      );
    }
    console.log(`[TrendJob] x_underflow fallback fetched ${results.length} items`);
    return results;
  } catch (err) {
    console.error("[Apify] X trend fallback failed:", err);
    return [];
  }
}
