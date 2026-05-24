import type { ContextPost } from "../context/redditContext";
import { fetchApifyTweetThumbnail } from "../apify/xTweetContext";
import { logXContext } from "./logger";
import { resolveXPostMedia, type XMediaSource } from "./resolveXPostMedia";

const ENRICH_LIMIT = 12;
const CONCURRENCY = 4;

function isXStatusUrl(url: string): boolean {
  return (
    (url.includes("x.com/") || url.includes("twitter.com/")) &&
    /\/status\/\d+/i.test(url)
  );
}

export type ContextEnrichStats = {
  total: number;
  enriched: number;
  withThumbnail: number;
  failed: number;
  sources: Partial<Record<XMediaSource | "apify", number>>;
};

/** @deprecated Use ContextEnrichStats */
export type MemeEnrichStats = ContextEnrichStats;

async function enrichOnePost(
  post: ContextPost,
  sourceCounts: Partial<Record<XMediaSource | "apify", number>>,
  logPrefix: string
): Promise<ContextPost> {
  let thumbnailUrl = post.thumbnailUrl?.trim() || undefined;

  if (!thumbnailUrl) {
    const { imageUrl, source } = await resolveXPostMedia(post.url);
    if (imageUrl) {
      thumbnailUrl = imageUrl;
      if (source) {
        sourceCounts[source] = (sourceCounts[source] ?? 0) + 1;
      }
      logXContext(`${logPrefix}_enrich_ok`, { url: post.url, source });
    }
  }

  if (!thumbnailUrl && process.env.APIFY_API_TOKEN) {
    const apifyThumb = await fetchApifyTweetThumbnail(post.url);
    if (apifyThumb) {
      thumbnailUrl = apifyThumb;
      sourceCounts.apify = (sourceCounts.apify ?? 0) + 1;
      logXContext(`${logPrefix}_enrich_ok`, { url: post.url, source: "apify" });
    }
  }

  if (!thumbnailUrl) {
    logXContext(`${logPrefix}_enrich_no_thumbnail`, { url: post.url }, "warn");
  }

  return { ...post, thumbnailUrl };
}

async function runInChunks<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}

export async function enrichContextPosts(
  posts: ContextPost[],
  options?: { logPrefix?: string }
): Promise<{ posts: ContextPost[]; stats: ContextEnrichStats }> {
  const logPrefix = options?.logPrefix ?? "context";
  const candidates = posts.filter((p) => p.url && isXStatusUrl(p.url)).slice(0, ENRICH_LIMIT);
  const rest = posts.filter((p) => !candidates.some((c) => c.url === p.url));

  logXContext(`${logPrefix}_enrich_start`, { total: posts.length, toEnrich: candidates.length });

  const sourceCounts: Partial<Record<XMediaSource | "apify", number>> = {};
  let failed = 0;

  const enriched = await runInChunks(candidates, CONCURRENCY, async (post) => {
    const result = await enrichOnePost(post, sourceCounts, logPrefix);
    if (!result.thumbnailUrl?.trim()) failed += 1;
    return result;
  });

  const all = [...enriched, ...rest];
  const withThumbnail = all.filter((p) => p.thumbnailUrl?.trim()).length;

  const stats: ContextEnrichStats = {
    total: posts.length,
    enriched: candidates.length,
    withThumbnail,
    failed,
    sources: sourceCounts,
  };

  logXContext(`${logPrefix}_enrich_done`, stats);

  return { posts: all, stats };
}

export async function enrichMemePosts(
  posts: ContextPost[]
): Promise<{ posts: ContextPost[]; stats: MemeEnrichStats }> {
  return enrichContextPosts(posts, { logPrefix: "meme" });
}
