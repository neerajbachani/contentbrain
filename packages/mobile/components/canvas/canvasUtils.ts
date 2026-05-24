import type { InspirationItem, SortBy } from "../../store/canvasStore";

export const FILTERS = ["all", "tweet", "reel", "reddit", "blog", "text", "url"] as const;

export const PLATFORM_COLORS = {
  twitter: "#1D9BF0",
  reddit: "#FF4500",
  instagram: "#E1306C",
  youtube: "#FF0000",
  news: "#6366F1",
} as const;

export function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function normalizeInspiration(item: Record<string, unknown>): InspirationItem {
  return {
    id: String(item.id ?? ""),
    type: String(item.type ?? "text"),
    sourcePlatform: String(item.sourcePlatform ?? "custom"),
    sourceUrl: (item.sourceUrl as string | null | undefined) ?? null,
    rawContent: String(item.rawContent ?? ""),
    ogImage: (item.ogImage as string | null | undefined) ?? null,
    title: (item.title as string | null | undefined) ?? null,
    tags: parseJsonArray(item.tags),
    summary: (item.summary as string | null | undefined) ?? null,
    writingStyle: (item.writingStyle as string | null | undefined) ?? null,
    keyIdeas: parseJsonArray(item.keyIdeas),
    hook: (item.hook as string | null | undefined) ?? null,
    createdAt: (item.createdAt as string | Date) ?? new Date().toISOString(),
    userId: String(item.userId ?? ""),
  };
}

export function getPlatformMeta(platform: string, fallback: string) {
  const p = platform?.toLowerCase();
  const color = (PLATFORM_COLORS as Record<string, string>)[p] ?? fallback;
  const labelMap: Record<string, string> = {
    twitter: "Twitter/X",
    x: "Twitter/X",
    reddit: "Reddit",
    instagram: "Instagram",
    youtube: "YouTube",
    news: "News",
    blog: "News",
  };
  return { label: labelMap[p] ?? (platform ?? "Custom"), color };
}

export function detectPlatformFromUrl(value: string): string | null {
  const normalized = value.toLowerCase();
  if (normalized.includes("twitter.com") || normalized.includes("x.com")) return "twitter";
  if (normalized.includes("reddit.com")) return "reddit";
  if (normalized.includes("youtube.com") || normalized.includes("youtu.be")) return "youtube";
  if (normalized.includes("instagram.com")) return "instagram";
  return null;
}

export function collectAllTags(items: InspirationItem[]): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const tag of item.tags ?? []) {
      const key = tag.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
    .slice(0, 12);
}

function matchesSearch(item: InspirationItem, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  const haystack = [
    item.title,
    item.summary,
    item.rawContent,
    item.hook,
    item.writingStyle,
    ...(item.tags ?? []),
    ...(item.keyIdeas ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function filterAndSortInspirations(
  items: InspirationItem[],
  filter: string,
  tagFilter: string | null,
  searchQuery: string,
  sortBy: SortBy
): InspirationItem[] {
  let result = items.filter((item) => {
    if (filter !== "all" && item.type !== filter && item.sourcePlatform !== filter) return false;
    if (tagFilter && !(item.tags ?? []).some((t) => t.toLowerCase() === tagFilter.toLowerCase())) return false;
    return matchesSearch(item, searchQuery);
  });

  result = [...result].sort((a, b) => {
    if (sortBy === "most_ideas") {
      return (b.keyIdeas?.length ?? 0) - (a.keyIdeas?.length ?? 0);
    }
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return sortBy === "oldest" ? aTime - bTime : bTime - aTime;
  });

  return result;
}

export function isLikelyUrl(text: string): boolean {
  const trimmed = text.trim();
  return /^https?:\/\/.+/i.test(trimmed);
}
