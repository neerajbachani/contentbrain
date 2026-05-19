export type ViralTier = 1 | 2 | 3;

export interface ParsedEngagement {
  likes: number;
  reposts: number;
  views: number;
  label: string;
  tier: ViralTier;
  rankScore: number;
}

function parseCount(raw: string): number {
  const n = raw.replace(/,/g, "").toLowerCase();
  const m = n.match(/^([\d.]+)\s*([km])?$/);
  if (!m) return parseInt(n, 10) || 0;
  const val = parseFloat(m[1]);
  if (m[2] === "k") return Math.round(val * 1000);
  if (m[2] === "m") return Math.round(val * 1_000_000);
  return Math.round(val);
}

/** Parse likes/reposts/views from x_search prose or citation text. */
export function parseEngagementFromText(text: string): ParsedEngagement | null {
  if (!text) return null;

  const likesM =
    text.match(/([\d.,]+[kmKM]?)\s*(?:likes?|hearts?|♥)/i) ??
    text.match(/likes?[:\s]+([\d.,]+[kmKM]?)/i);
  const repostsM =
    text.match(/([\d.,]+[kmKM]?)\s*(?:reposts?|retweets?|RTs?)/i) ??
    text.match(/(?:reposts?|retweets?)[:\s]+([\d.,]+[kmKM]?)/i);
  const viewsM =
    text.match(/([\d.,]+[kmKM]?)\s*(?:views?|impressions?)/i) ??
    text.match(/views?[:\s]+([\d.,]+[kmKM]?)/i);

  const likes = likesM ? parseCount(likesM[1]) : 0;
  const reposts = repostsM ? parseCount(repostsM[1]) : 0;
  const views = viewsM ? parseCount(viewsM[1]) : 0;

  if (likes === 0 && reposts === 0 && views === 0) return null;

  const tier = computeViralTier(likes, reposts, views);
  const rankScore = likes + reposts * 3 + Math.floor(views / 100);

  const parts: string[] = [];
  if (likes) parts.push(`${formatCount(likes)} likes`);
  if (reposts) parts.push(`${formatCount(reposts)} reposts`);
  if (views) parts.push(`${formatCount(views)} views`);

  return {
    likes,
    reposts,
    views,
    label: parts.join(" · "),
    tier,
    rankScore,
  };
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function computeViralTier(likes: number, reposts: number, views: number): ViralTier {
  if (likes >= 1000 || reposts >= 300 || views >= 50_000) return 1;
  if (likes >= 500 || reposts >= 150 || views >= 25_000) return 2;
  if (likes >= 100 || reposts >= 50 || views >= 10_000) return 2;
  return 3;
}

export function engagementScoreFromMetrics(likes: number, reposts: number, views: number): number {
  return Math.min(9999, likes + reposts * 3 + Math.floor(views / 50));
}
