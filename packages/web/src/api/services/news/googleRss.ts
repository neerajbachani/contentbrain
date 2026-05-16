import { NICHE_KEYWORDS } from "../nicheData";
import { normalizeTrend, TrendItem } from "../normalizer";

// Simple RSS parser — no external dep needed
async function parseRss(url: string): Promise<Array<{ title: string; link?: string; contentSnippet?: string }>> {
  const res = await fetch(url, {
    headers: { "User-Agent": "ContentBrain/1.0" },
  });
  if (!res.ok) return [];

  const xml = await res.text();

  const items: Array<{ title: string; link?: string; contentSnippet?: string }> = [];

  // Simple regex-based RSS item extraction
  const itemMatches = xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/g);
  for (const match of itemMatches) {
    const content = match[1];

    const titleMatch = content.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>|<title[^>]*>(.*?)<\/title>/s);
    const linkMatch = content.match(/<link[^>]*>(.*?)<\/link>/s);
    const snippetMatch = content.match(/<description[^>]*><!\[CDATA\[(.*?)\]\]><\/description>|<description[^>]*>(.*?)<\/description>/s);

    const title = (titleMatch?.[1] ?? titleMatch?.[2] ?? "").trim();
    const link = (linkMatch?.[1] ?? "").trim();
    const snippet = (snippetMatch?.[1] ?? snippetMatch?.[2] ?? "").trim();

    if (title) {
      items.push({ title, link: link || undefined, contentSnippet: snippet || undefined });
    }
  }

  return items;
}

export async function fetchGoogleRssTrends(niches: string[]): Promise<TrendItem[]> {
  const results: TrendItem[] = [];

  for (const niche of niches) {
    const keywords = NICHE_KEYWORDS[niche.toLowerCase()] ?? [];
    const keyword = keywords[0]; // RULE 3: 1 keyword per niche
    if (!keyword) continue;

    try {
      const encoded = encodeURIComponent(keyword);
      const url = `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`;
      const items = await parseRss(url);

      for (const item of items.slice(0, 8)) {
        if (!item.title) continue;

        // Clean "Title - Source Name" format
        const cleanTitle = item.title.replace(/\s-\s[^-]+$/, "").trim();

        results.push(
          normalizeTrend(
            {
              title: cleanTitle,
              url: item.link,
              summary: item.contentSnippet?.slice(0, 300),
              engagementScore: 30,
            },
            "google_rss",
            niche
          )
        );
      }
    } catch (err) {
      console.error(`[GoogleRSS] Failed for niche ${niche}:`, err);
    }
  }

  return results;
}
