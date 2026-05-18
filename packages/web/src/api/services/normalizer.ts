import { randomUUID } from "crypto";

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

export function normalizeTrend(
  raw: Record<string, unknown>,
  source: TrendSource,
  niche: string
): TrendItem {
  const now = new Date();
  const expires = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  return {
    id: String(raw.id ?? randomUUID()),
    source,
    platformDisplay: PLATFORM_MAP[source],
    niche,
    title: String(raw.title ?? "").trim().slice(0, 300),
    url: raw.url ? String(raw.url) : undefined,
    summary: raw.summary ? String(raw.summary).slice(0, 500) : undefined,
    thumbnailUrl: raw.thumbnailUrl ? String(raw.thumbnailUrl) : undefined,
    engagementScore: Number(raw.engagementScore ?? 0),
    author: raw.author ? String(raw.author) : undefined,
    scrapedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };
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
  return deduplicateTrends(all);
}
