import { NICHE_SUBREDDITS } from "../nicheData";
import { normalizeTrend, TrendItem } from "../normalizer";
import { getRedditToken } from "./redditAuth";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Decode HTML entities in URLs (e.g. &amp; → &) */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Best available image for a Reddit post, in priority order:
 * 1. preview.images[0].source.url  (high-res, always present for link posts)
 * 2. p.thumbnail if it's an http URL (low-res fallback)
 */
function getRedditThumbnail(p: any): string | undefined {
  const previewUrl = p?.preview?.images?.[0]?.source?.url;
  if (previewUrl) return decodeHtmlEntities(previewUrl);
  const thumb = p?.thumbnail;
  if (typeof thumb === "string" && thumb.startsWith("http")) return decodeHtmlEntities(thumb);
  return undefined;
}

export async function fetchRedditTrends(niches: string[]): Promise<TrendItem[]> {
  const token = await getRedditToken();
  const userAgent = process.env.REDDIT_USER_AGENT ?? "ContentBrain/1.0";
  const results: TrendItem[] = [];

  for (const niche of niches) {
    const subs = (NICHE_SUBREDDITS[niche.toLowerCase()] ?? []).slice(0, 2); // RULE 1: max 2 per niche

    for (const sub of subs) {
      try {
        const url = token
          ? `https://oauth.reddit.com/r/${sub}/hot.json?limit=5`
          : `https://www.reddit.com/r/${sub}/hot.json?limit=5`;

        const headers: Record<string, string> = { "User-Agent": userAgent };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(url, { headers });
        if (!res.ok) continue;

        const data = await res.json() as any;
        const posts = data?.data?.children ?? [];

        for (const post of posts) {
          const p = post.data;
          if (!p.title || p.stickied || p.score < 10) continue;

          results.push(
            normalizeTrend(
              {
                title: p.title,
                url: `https://reddit.com${p.permalink}`,
                summary: p.selftext?.slice(0, 300) || undefined,
                thumbnailUrl: getRedditThumbnail(p),
                engagementScore: p.score,
                author: p.subreddit_name_prefixed ?? `r/${sub}`,
              },
              "reddit",
              niche
            )
          );
        }

        await sleep(200); // respect rate limit
      } catch (err) {
        console.error(`[Reddit] Failed for r/${sub}:`, err);
      }
    }
  }

  return results;
}
