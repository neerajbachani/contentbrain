import { NICHE_KEYWORDS } from "../nicheData";
import { normalizeTrend, TrendItem } from "../normalizer";

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "quacker~twitter-scraper";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pollApifyRun(
  runId: string,
  token: string,
  maxWaitMs = 30_000
): Promise<any[]> {
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    await sleep(3000);

    const statusRes = await fetch(
      `${APIFY_BASE}/actor-runs/${runId}?token=${token}`
    );
    const statusData = await statusRes.json() as any;
    const status = statusData?.data?.status;

    if (status === "SUCCEEDED") {
      const datasetId = statusData?.data?.defaultDatasetId;
      const dataRes = await fetch(
        `${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&limit=10`
      );
      return (await dataRes.json() as any[]) ?? [];
    }

    if (status === "FAILED" || status === "ABORTED") {
      throw new Error(`Apify run ${runId} ended with status: ${status}`);
    }
  }

  throw new Error(`Apify run ${runId} timed out after ${maxWaitMs}ms`);
}

export async function fetchXTrends(niches: string[]): Promise<TrendItem[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.warn("[Apify] APIFY_API_TOKEN not set — skipping X trends");
    return [];
  }

  const results: TrendItem[] = [];

  for (const niche of niches) {
    const keywords = NICHE_KEYWORDS[niche.toLowerCase()] ?? [];
    const query = keywords.slice(0, 2).join(" OR "); // RULE 4: cost control

    try {
      const runRes = await fetch(
        `${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            searchTerms: [query],
            maxItems: 10,
            sort: "Latest",
            language: "en",
          }),
        }
      );

      if (!runRes.ok) {
        console.error(`[Apify] Run start failed for niche ${niche}:`, runRes.status);
        continue;
      }

      const runData = await runRes.json() as any;
      const runId = runData?.data?.id;
      if (!runId) continue;

      const tweets = await pollApifyRun(runId, token);

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
