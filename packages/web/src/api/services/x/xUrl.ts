export function isXPlatform(platform: string, sourceUrl?: string | null): boolean {
  const p = platform.toLowerCase();
  if (p === "twitter" || p === "x") return true;
  const url = sourceUrl ?? "";
  return url.includes("twitter.com") || url.includes("x.com");
}

export function parseXStatusUrl(url: string): { tweetId: string } | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/i);
  if (!match) return null;
  return { tweetId: match[1] };
}

export function normalizeXUrl(url: string): string {
  return url.replace(/^https?:\/\/twitter\.com/i, "https://x.com");
}
