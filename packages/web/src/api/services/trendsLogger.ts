type TrendsLogLevel = "info" | "warn" | "error";

function prefix(level: TrendsLogLevel, event: string, detail?: Record<string, unknown>) {
  const payload = detail ? ` ${JSON.stringify(detail)}` : "";
  const line = `[Trends] ${event}${payload}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function logTrends(
  event: string,
  detail?: Record<string, unknown>,
  level: TrendsLogLevel = "info"
) {
  prefix(level, event, detail);
}

export function platformBreakdown(
  items: Array<{ platform?: string; source?: string }>
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = item.platform ?? item.source ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

const GENERIC_X_TITLES = new Set(["trending on x", "x post"]);

export function isGenericXTitle(title?: string | null): boolean {
  if (!title) return true;
  const t = title.trim().toLowerCase();
  if (GENERIC_X_TITLES.has(t)) return true;
  if (t.startsWith("http://") || t.startsWith("https://")) return true;
  return false;
}

export function xEnrichmentStats(
  items: Array<{
    title?: string | null;
    summary?: string | null;
    thumbnailUrl?: string | null;
  }>
) {
  let withTitle = 0;
  let withSummary = 0;
  let withThumbnail = 0;
  let genericTitle = 0;
  let urlOnly = 0;

  for (const item of items) {
    if (item.summary?.trim()) withSummary++;
    else urlOnly++;
    if (item.thumbnailUrl?.trim()) withThumbnail++;
    if (isGenericXTitle(item.title)) genericTitle++;
    else if (item.title?.trim()) withTitle++;
  }

  return {
    total: items.length,
    withTitle,
    withSummary,
    withThumbnail,
    genericTitle,
    urlOnly,
  };
}
