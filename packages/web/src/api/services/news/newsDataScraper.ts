import { NICHE_KEYWORDS } from "../nicheData";
import { normalizeTrend, TrendItem } from "../normalizer";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchNewsDataTrends(niches: string[]): Promise<TrendItem[]> {
  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) {
    console.warn("[NewsData] NEWSDATA_API_KEY not set — skipping");
    return [];
  }

  const results: TrendItem[] = [];

  for (const niche of niches) {
    const keywords = NICHE_KEYWORDS[niche.toLowerCase()] ?? [];
    const query = keywords.slice(0, 3).join(" OR "); // RULE 2: 1 call per niche

    try {
      const params = new URLSearchParams({
        apikey: apiKey,
        q: query,
        language: "en",
        size: "10",
        prioritydomain: "top",
      });

      const res = await fetch(`https://newsdata.io/api/1/news?${params}`);
      if (!res.ok) {
        console.error(`[NewsData] HTTP ${res.status} for niche ${niche}`);
        continue;
      }

      const data = await res.json() as any;
      const articles = data?.results ?? [];

      for (const article of articles) {
        if (!article.title) continue;
        results.push(
          normalizeTrend(
            {
              title: article.title,
              url: article.link,
              summary: article.description?.slice(0, 400),
              thumbnailUrl: article.image_url ?? undefined,
              engagementScore: 50,
              author: article.source_name,
            },
            "newsdata",
            niche
          )
        );
      }

      await sleep(500); // stay under rate limit
    } catch (err) {
      console.error(`[NewsData] Failed for niche ${niche}:`, err);
    }
  }

  return results;
}
