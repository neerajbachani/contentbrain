import { api } from "../lib/api";

export type TrendSource = "reddit" | "x" | "newsdata" | "google_rss" | "news";
export type PlatformDisplay = "Reddit" | "X" | "News" | "Blog";

export interface TrendItem {
  id: string;
  platform: TrendSource;
  platformDisplay: PlatformDisplay;
  niche: string | null;
  title: string;
  url: string | null;
  summary: string | null;
  thumbnailUrl: string | null;
  author: string | null;
  engagementScore: number | null;
  scrapedAt: number | null;
}

export async function fetchTrends(
  niches: string[],
  source: "all" | TrendSource = "all",
  limit = 20
): Promise<TrendItem[]> {
  const params = new URLSearchParams({
    niche: niches.join(","),
    source,
    limit: String(limit),
  });

  const res = await (api.trends as any).$get({ query: Object.fromEntries(params) });
  if (!res.ok) throw new Error(`Trends fetch failed: ${res.status}`);

  const json = (await res.json()) as { trends: TrendItem[] };
  return json.trends ?? [];
}

export async function refreshTrends(): Promise<{ message: string }> {
  const res = await (api.trends as any).refresh.$post({});
  if (res.status === 403) {
    const json = (await res.json()) as { error: string };
    throw new Error(json.error);
  }
  if (res.status === 429) {
    const json = (await res.json()) as { error: string };
    throw new Error(json.error);
  }
  return res.json();
}
