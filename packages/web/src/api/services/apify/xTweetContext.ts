import type { ContextComment, ContextPost } from "../context/redditContext";
import { APIFY_TWITTER_ACTOR, runApifyActor } from "./apifyClient";
import { normalizeXUrl, parseXStatusUrl } from "../x/xUrl";

function mapTweetToComments(tweets: any[], mainTweetId?: string): ContextComment[] {
  const comments: ContextComment[] = [];
  const main = tweets.find((t) => String(t.id) === mainTweetId || t.url?.includes(mainTweetId ?? "___"));

  if (main?.text) {
    comments.push({
      author: main.author?.userName ? `@${main.author.userName}` : "Original post",
      body: main.text,
      score: (main.likeCount ?? 0) + (main.retweetCount ?? 0),
      sourceUrl: main.url,
    });
  }

  for (const t of tweets) {
    if (!t.text) continue;
    if (main && t.id === main.id) continue;
    if (t.inReplyToStatusId || t.isReply) {
      comments.push({
        author: t.author?.userName ? `@${t.author.userName}` : "Reply",
        body: t.text,
        score: (t.likeCount ?? 0) + (t.retweetCount ?? 0),
        sourceUrl: t.url,
      });
    }
  }

  if (comments.length === 0) {
    for (const t of tweets.slice(0, 8)) {
      if (!t.text) continue;
      comments.push({
        author: t.author?.userName ? `@${t.author.userName}` : "X user",
        body: t.text,
        score: (t.likeCount ?? 0) + (t.retweetCount ?? 0),
        sourceUrl: t.url,
      });
    }
  }

  return comments.slice(0, 12);
}

function mapTweetToRelated(tweets: any[]): ContextPost[] {
  return tweets
    .filter((t) => t.text && t.url)
    .slice(0, 8)
    .map((t) => ({
      title: t.text.slice(0, 200),
      url: t.url,
      score: (t.likeCount ?? 0) + (t.retweetCount ?? 0),
      platform: "x",
      summary: t.text.length > 200 ? t.text.slice(200, 400) : undefined,
    }));
}

export async function fetchApifyTweetContext(
  sourceUrl: string
): Promise<{ comments: ContextComment[]; relatedPosts: ContextPost[] } | null> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return null;

  const parsed = parseXStatusUrl(sourceUrl);
  const url = normalizeXUrl(sourceUrl);

  try {
    const tweets = await runApifyActor(
      APIFY_TWITTER_ACTOR,
      {
        startUrls: [{ url }],
        maxItems: 15,
        addUserInfo: true,
      },
      token,
      { maxWaitMs: 45_000, itemLimit: 15 }
    );

    if (!tweets.length) return null;

    return {
      comments: mapTweetToComments(tweets, parsed?.tweetId),
      relatedPosts: mapTweetToRelated(tweets),
    };
  } catch (err) {
    console.error("[Apify] xTweetContext failed:", err);
    return null;
  }
}

export async function fetchApifyXSearch(
  query: string,
  maxItems = 8
): Promise<{ comments: ContextComment[]; relatedPosts: ContextPost[] } | null> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token || !query.trim()) return null;

  try {
    const tweets = await runApifyActor(
      APIFY_TWITTER_ACTOR,
      {
        searchTerms: [query],
        maxItems,
        sort: "Latest",
        language: "en",
      },
      token,
      { maxWaitMs: 45_000, itemLimit: maxItems }
    );

    if (!tweets.length) return null;

    return {
      comments: [],
      relatedPosts: mapTweetToRelated(tweets),
    };
  } catch (err) {
    console.error("[Apify] xSearch failed:", err);
    return null;
  }
}

export async function fetchApifyThreadText(sourceUrl: string): Promise<string | null> {
  const ctx = await fetchApifyTweetContext(sourceUrl);
  if (!ctx) return null;

  const parts = ctx.comments.map((c) => `${c.author}: ${c.body}`);
  if (!parts.length && ctx.relatedPosts[0]) {
    return ctx.relatedPosts[0].title;
  }
  return parts.join("\n\n") || null;
}
