import { getRedditToken } from "../reddit/redditAuth";
import { getRedditThumbnail } from "../reddit/redditScraper";

export interface ContextComment {
  author: string;
  body: string;
  score: number;
  sourceUrl?: string;
}

export interface ContextPost {
  title: string;
  url: string;
  score: number;
  platform: string;
  summary?: string;
  thumbnailUrl?: string;
  trendTier?: "global" | "niche";
  engagementLabel?: string;
}

function parseRedditUrl(url: string): { subreddit: string; postId: string } | null {
  try {
    const match = url.match(/reddit\.com\/r\/([^/]+)\/comments\/([a-z0-9]+)/i);
    if (!match) return null;
    return { subreddit: match[1], postId: match[2] };
  } catch {
    return null;
  }
}

export async function fetchRedditContext(
  sourceUrl: string
): Promise<{ comments: ContextComment[]; relatedPosts: ContextPost[] } | null> {
  const parsed = parseRedditUrl(sourceUrl);
  if (!parsed) return null;

  const { subreddit, postId } = parsed;
  const token = await getRedditToken();
  const userAgent = process.env.REDDIT_USER_AGENT ?? "ContentBrain/1.0";

  const headers: Record<string, string> = { "User-Agent": userAgent };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const base = token ? "https://oauth.reddit.com" : "https://www.reddit.com";

  const [commentsResult, relatedResult] = await Promise.allSettled([
    fetch(`${base}/comments/${postId}.json?sort=top&limit=10&depth=1`, { headers }).then(
      (r) => r.json()
    ),
    fetch(`${base}/r/${subreddit}/hot.json?limit=8`, { headers }).then((r) => r.json()),
  ]);

  const comments: ContextComment[] = [];
  if (commentsResult.status === "fulfilled") {
    const raw = commentsResult.value as any;
    const commentListing = raw?.[1]?.data?.children ?? [];
    for (const child of commentListing) {
      if (child.kind !== "t1") continue;
      const d = child.data;
      if (!d.body || d.body === "[deleted]" || d.body === "[removed]") continue;
      if (d.score < 1) continue;
      comments.push({
        author: `u/${d.author}`,
        body: d.body.slice(0, 280),
        score: d.score,
        sourceUrl: `https://reddit.com${d.permalink ?? ""}`,
      });
      if (comments.length >= 5) break;
    }
  }

  const relatedPosts: ContextPost[] = [];
  if (relatedResult.status === "fulfilled") {
    const raw = relatedResult.value as any;
    const posts = raw?.data?.children ?? [];
    for (const child of posts) {
      const p = child.data;
      if (!p.title || p.stickied) continue;
      // Skip the original post itself
      if (p.id === postId) continue;
      relatedPosts.push({
        title: p.title,
        url: `https://reddit.com${p.permalink}`,
        score: p.score ?? 0,
        platform: "reddit",
        summary: p.selftext?.slice(0, 200) || undefined,
        thumbnailUrl: getRedditThumbnail(p),
      });
      if (relatedPosts.length >= 4) break;
    }
  }

  return { comments, relatedPosts };
}
