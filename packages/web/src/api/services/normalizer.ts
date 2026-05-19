import { createHash, randomUUID } from "crypto";

export type TrendSource = "reddit" | "x" | "newsdata" | "google_rss";
export type PlatformDisplay = "Reddit" | "X" | "News" | "Blog";

export interface TrendItem {
  id: string;
  source: TrendSource;
  platformDisplay: PlatformDisplay;
  niche: string;
  title: string;
  url?: string;
  summary?: string;
  thumbnailUrl?: string;
  engagementScore: number;
  author?: string;
  scrapedAt: string;
  expiresAt: string;
}

const PLATFORM_MAP: Record<TrendSource, PlatformDisplay> = {
  reddit: "Reddit",
  x: "X",
  newsdata: "News",
  google_rss: "Blog",
};

/** Normalize URL for stable dedupe keys. */
export function normalizeTrendUrl(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/\/+$/, "");
}

export function stableTrendId(platform: string, url: string): string {
  const normalized = normalizeTrendUrl(url);
  return createHash("sha256").update(`${platform}|${normalized}`).digest("hex").slice(0, 32);
}

export function normalizeTrend(
  raw: Record<string, unknown>,
  source: TrendSource,
  niche: string
): TrendItem {
  const now = new Date();
  const expires = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const url = raw.url ? String(raw.url) : undefined;

  const id = raw.id
    ? String(raw.id)
    : url
      ? stableTrendId(source, url)
      : randomUUID();

  return {
    id,
    source,
    platformDisplay: PLATFORM_MAP[source],
    niche,
    title: String(raw.title ?? "").trim().slice(0, 300),
    url,
    summary: raw.summary ? String(raw.summary).slice(0, 500) : undefined,
    thumbnailUrl: raw.thumbnailUrl ? String(raw.thumbnailUrl) : undefined,
    engagementScore: Number(raw.engagementScore ?? 0),
    author: raw.author ? String(raw.author) : undefined,
    scrapedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };
}

function getItemPlatform(item: { source?: TrendSource; platform?: string }): string {
  return item.source ?? item.platform ?? "unknown";
}

export function deduplicateTrendsByUrl<T extends { url?: string | null }>(items: T[]): T[] {
  const seen = new Set<string>();
  const kept: T[] = [];
  for (const item of items) {
    if (!item.url) {
      kept.push(item);
      continue;
    }
    const key = normalizeTrendUrl(item.url);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(item);
  }
  return kept;
}

// Jaccard similarity for deduplication
function jaccard(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function deduplicateTrends(items: TrendItem[], threshold = 0.65): TrendItem[] {
  const kept: TrendItem[] = [];
  for (const item of items) {
    const isDupe = kept.some(
      (k) => k.niche === item.niche && jaccard(k.title, item.title) > threshold
    );
    if (!isDupe) kept.push(item);
  }
  return kept;
}

export function aggregateTrends(...sources: TrendItem[][]): TrendItem[] {
  const all = sources.flat();
  all.sort((a, b) => b.engagementScore - a.engagementScore);
  return deduplicateTrends(deduplicateTrendsByUrl(all));
}

type Balanceable = {
  engagementScore: number | null;
  source?: TrendSource;
  platform?: string;
};

/** Mix platforms so the feed is not dominated by a single source. */
export function balanceTrendFeed<T extends Balanceable>(items: T[], limit: number): T[] {
  if (items.length === 0) return items;

  const buckets: Record<string, T[]> = {
    reddit: [],
    x: [],
    news: [],
  };

  for (const item of items) {
    const p = getItemPlatform(item);
    if (p === "reddit") buckets.reddit.push(item);
    else if (p === "x") buckets.x.push(item);
    else buckets.news.push(item);
  }

  const sortByScore = (a: T, b: T) =>
    (b.engagementScore ?? 0) - (a.engagementScore ?? 0);

  buckets.reddit.sort(sortByScore);
  buckets.x.sort(sortByScore);
  buckets.news.sort(sortByScore);

  const caps = {
    reddit: Math.min(8, Math.ceil(limit * 0.4)),
    x: Math.min(5, Math.ceil(limit * 0.25)),
    news: Math.min(6, Math.ceil(limit * 0.3)),
  };

  const result: T[] = [];
  const used = new Set<T>();

  const takeFrom = (bucket: T[], max: number) => {
    for (const item of bucket) {
      if (result.length >= limit) break;
      if (used.has(item)) continue;
      if (max <= 0) break;
      result.push(item);
      used.add(item);
      max--;
    }
  };

  takeFrom(buckets.x, caps.x);
  takeFrom(buckets.news, caps.news);
  takeFrom(buckets.reddit, caps.reddit);

  const remaining = [...items].sort(sortByScore);
  for (const item of remaining) {
    if (result.length >= limit) break;
    if (used.has(item)) continue;
    result.push(item);
    used.add(item);
  }

  return result.slice(0, limit);
}
