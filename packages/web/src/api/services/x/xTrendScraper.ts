import { getLinkPreview, resolveXThumbnailOnly } from "../linkPreview/ogScraper";
import { NICHE_KEYWORDS } from "../nicheData";
import { normalizeTrend, TrendItem } from "../normalizer";
import { isGenericXTitle, logTrends, xEnrichmentStats } from "../trendsLogger";
import type { ContextPost } from "../context/redditContext";
import { getUserXaiAccessToken } from "./credentials";
import {
  computeViralTier,
  engagementScoreFromMetrics,
  parseEngagementFromText,
  type ViralTier,
} from "./xEngagement";
import { fetchXaiSearchContext } from "./xSearchContext";
import { sanitizeXText } from "./xTextSanitizer";
import type { TodayXNewsGroup, XTrendFetchResult } from "./xTrendTypes";

const ENRICH_PREVIEW_LIMIT = 10;
const HEADLINE_COUNT = 3;
const RELATED_PER_HEADLINE = 4;

function isXUrl(url: string): boolean {
  return url.includes("x.com/") || url.includes("twitter.com/");
}

interface RankedPost {
  post: ContextPost;
  tier: ViralTier;
  rankScore: number;
}

function rankPosts(posts: ContextPost[]): RankedPost[] {
  return posts
    .filter((p) => p.url && isXUrl(p.url))
    .map((post) => {
      const eng = parseEngagementFromText(
        `${post.title} ${post.summary ?? ""} ${post.engagementLabel ?? ""}`
      );
      const tier = eng?.tier ?? computeViralTier(0, 0, 0);
      const rankScore = eng?.rankScore ?? post.score ?? 0;
      return { post, tier, rankScore: rankScore || (4 - tier) * 10 };
    })
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return b.rankScore - a.rankScore;
    });
}

function keywordOverlap(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  const setB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  if (setA.size === 0 || setB.size === 0) return 0;
  let hit = 0;
  for (const w of setA) if (setB.has(w)) hit++;
  return hit / Math.max(setA.size, setB.size);
}

function contextPostToTrendItem(
  post: ContextPost,
  niche: string,
  opts?: { todayNews?: boolean }
): TrendItem {
  const title = sanitizeXText(post.title) ?? post.url;
  const summary = sanitizeXText(post.summary);
  const eng = parseEngagementFromText(
    `${title} ${summary ?? ""} ${post.engagementLabel ?? ""}`
  );
  const engagementScore = eng
    ? engagementScoreFromMetrics(eng.likes, eng.reposts, eng.views)
    : 75;

  return normalizeTrend(
    {
      title: title.slice(0, 280),
      url: post.url.replace(/[)\],.]+$/, ""),
      summary,
      thumbnailUrl: post.thumbnailUrl,
      engagementScore: opts?.todayNews ? Math.max(engagementScore, 120) : engagementScore,
      author: "X",
    },
    "x",
    niche
  );
}

function groupTodayNews(headlines: TrendItem[], pool: TrendItem[]): TodayXNewsGroup[] {
  const used = new Set<string>();
  for (const h of headlines) {
    if (h.url) used.add(h.url);
  }

  return headlines.map((headline) => {
    const keywords = headline.title;
    const related = pool
      .filter((p) => p.url && !used.has(p.url) && p.url !== headline.url)
      .map((p) => ({ p, overlap: keywordOverlap(keywords, p.title) }))
      .sort((a, b) => b.overlap - a.overlap || b.p.engagementScore - a.p.engagementScore)
      .slice(0, RELATED_PER_HEADLINE)
      .map((x) => x.p);

    for (const r of related) {
      if (r.url) used.add(r.url);
    }

    return { headline, relatedPosts: related };
  });
}

function pickTitle(
  parsedTitle?: string,
  parsedSummary?: string,
  previewTitle?: string | null,
  previewDescription?: string | null
): string {
  const cleanTitle = sanitizeXText(parsedTitle);
  const cleanSummary = sanitizeXText(parsedSummary);
  if (cleanTitle && !isGenericXTitle(cleanTitle)) return cleanTitle.slice(0, 280);
  if (previewDescription && previewDescription.length > 12) {
    return sanitizeXText(previewDescription.slice(0, 280)) ?? "Trending on X";
  }
  if (cleanSummary && cleanSummary.length > 12) return cleanSummary.slice(0, 280);
  if (previewTitle && previewTitle.length > 3 && !isGenericXTitle(previewTitle)) {
    return previewTitle.slice(0, 280);
  }
  return "Trending on X";
}

async function enrichXItems(items: TrendItem[]): Promise<TrendItem[]> {
  const toEnrich = items.slice(0, ENRICH_PREVIEW_LIMIT);
  const rest = items.slice(ENRICH_PREVIEW_LIMIT);

  const enriched = await Promise.all(
    toEnrich.map(async (item) => {
      if (!item.url) return item;

      try {
        const preview = await getLinkPreview(item.url);
        let thumbnailUrl =
          item.thumbnailUrl ?? preview.imageUrl ?? undefined;

        if (!thumbnailUrl) {
          thumbnailUrl = (await resolveXThumbnailOnly(item.url)) ?? undefined;
        }

        const title = pickTitle(
          item.title,
          item.summary,
          preview.title,
          preview.description
        );
        const summary =
          sanitizeXText(item.summary) ||
          sanitizeXText(preview.description) ||
          undefined;

        const author =
          item.author && item.author !== "X"
            ? item.author
            : preview.title?.trim() || "X";

        if (!thumbnailUrl) {
          logTrends("x_enrich_no_thumbnail", { url: item.url }, "warn");
        }

        return {
          ...item,
          title: sanitizeXText(title) ?? title,
          summary: summary?.slice(0, 500),
          thumbnailUrl,
          author,
        };
      } catch {
        logTrends("x_enrich_preview_failed", { url: item.url }, "warn");
        return item;
      }
    })
  );

  return [...enriched, ...rest];
}

function logTierStats(label: string, ranked: RankedPost[]) {
  const tier1 = ranked.filter((r) => r.tier === 1).length;
  const tier2 = ranked.filter((r) => r.tier === 2).length;
  const tier3 = ranked.filter((r) => r.tier === 3).length;
  logTrends(label, { viralConfirmed: tier1, partialConfirmed: tier2, backfillCount: tier3 });
}

/** Today's global X trending headlines (Explore-style) via x_search. */
export async function fetchTodayXNewsViaXai(userId: string): Promise<TodayXNewsGroup[]> {
  const token = await getUserXaiAccessToken(userId);
  if (!token) return [];

  logTrends("x_today_news_start", { userId });

  const { result, error } = await fetchXaiSearchContext(token, {
    intent: "trending_global",
    rawContent: "global trending on X today",
    userId,
  });

  if (error || !result?.relatedPosts?.length) {
    logTrends("x_today_news_empty", { message: error?.message ?? "no_posts" }, "warn");
    return [];
  }

  const ranked = rankPosts(result.relatedPosts);
  logTierStats("x_today_news_ranked", ranked);

  const headlinePosts = ranked.slice(0, HEADLINE_COUNT).map((r) => r.post);
  const poolPosts = ranked.slice(HEADLINE_COUNT).map((r) => r.post);

  let headlines = headlinePosts.map((p) => contextPostToTrendItem(p, "global", { todayNews: true }));
  let pool = poolPosts.map((p) => contextPostToTrendItem(p, "global"));

  headlines = await enrichXItems(headlines);
  pool = await enrichXItems(pool);

  const groups = groupTodayNews(headlines, pool);

  const thumbCount =
    groups.reduce(
      (n, g) =>
        n +
        (g.headline.thumbnailUrl ? 1 : 0) +
        g.relatedPosts.filter((r) => r.thumbnailUrl).length,
      0
    );

  logTrends("x_today_news_done", {
    userId,
    headlineCount: groups.length,
    relatedGroupSizes: groups.map((g) => g.relatedPosts.length),
    withThumbnail: thumbCount,
  });

  return groups;
}

/** Viral niche X posts via x_search trending_niche intent. */
export async function fetchNicheXTrendsViaXai(
  userId: string,
  niches: string[],
  limit = 10
): Promise<TrendItem[]> {
  const token = await getUserXaiAccessToken(userId);
  if (!token) {
    logTrends("x_oauth_skip", { userId, reason: "no_token" }, "warn");
    return [];
  }

  const targetNiches = niches.slice(0, 2);
  const results: TrendItem[] = [];
  const seenUrls = new Set<string>();

  logTrends("x_niche_fetch_start", { userId, niches: targetNiches, limit });

  for (const niche of targetNiches) {
    if (results.length >= limit) break;

    const keywords = NICHE_KEYWORDS[niche.toLowerCase()] ?? [niche];
    const { result, error } = await fetchXaiSearchContext(token, {
      intent: "trending_niche",
      rawContent: keywords.slice(0, 3).join(" "),
      nicheKeywords: keywords,
      userId,
    });

    if (error) {
      logTrends("x_niche_failed", { niche, message: error.message }, "warn");
      continue;
    }

    if (!result?.relatedPosts?.length) {
      logTrends("x_niche_empty", { niche });
      continue;
    }

    const ranked = rankPosts(result.relatedPosts);
    logTierStats(`x_niche_ranked_${niche}`, ranked);

    for (const { post } of ranked) {
      if (results.length >= limit) break;
      if (!post.url || !isXUrl(post.url)) continue;

      const normalizedUrl = post.url.replace(/[)\],.]+$/, "");
      if (seenUrls.has(normalizedUrl)) continue;
      seenUrls.add(normalizedUrl);

      results.push(contextPostToTrendItem({ ...post, url: normalizedUrl }, niche));
    }
  }

  const beforeStats = xEnrichmentStats(results);
  const enriched = await enrichXItems(results);
  const afterStats = xEnrichmentStats(enriched);

  logTrends("x_niche_fetch_done", {
    userId,
    count: enriched.length,
    before: beforeStats,
    after: afterStats,
  });

  return enriched;
}

/** Combined fetch for trends API: today's news groups + niche viral posts. */
export async function fetchXTrendBundle(
  userId: string,
  niches: string[],
  nicheLimit = 10
): Promise<XTrendFetchResult> {
  const [todayXNews, nichePosts] = await Promise.all([
    fetchTodayXNewsViaXai(userId),
    fetchNicheXTrendsViaXai(userId, niches, nicheLimit),
  ]);

  const headlineUrls = new Set(
    todayXNews.flatMap((g) => [
      g.headline.url,
      ...g.relatedPosts.map((r) => r.url),
    ]).filter(Boolean) as string[]
  );

  const filteredNiche = nichePosts.filter((p) => !p.url || !headlineUrls.has(p.url));

  return { todayXNews, nichePosts: filteredNiche };
}

/** @deprecated Use fetchNicheXTrendsViaXai or fetchXTrendBundle */
export async function fetchXTrendsViaXai(
  userId: string,
  niches: string[],
  limit = 8
): Promise<TrendItem[]> {
  const bundle = await fetchXTrendBundle(userId, niches, limit);
  return bundle.nichePosts;
}
