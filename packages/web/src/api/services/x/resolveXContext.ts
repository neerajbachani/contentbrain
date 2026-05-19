import { fetchAIContext } from "../context/aiContext";
import { fetchApifyTweetContext, fetchApifyXSearch } from "../apify/xTweetContext";
import { getCachedXContext, setCachedXContext } from "./contextCache";
import { getUserXaiAccessToken } from "./credentials";
import { checkXContextDailyLimit, incrementXContextDailyLimit } from "./rateLimit";
import { fetchXaiSearchContext } from "./xSearchContext";
import type { ResolveXContextInput, XContextResult, XDataSource } from "./types";
import { logXContext } from "./logger";

export type ResolveXContextMeta = {
  attempted: string[];
  errors: string[];
  fallbackReason?: string;
};

function shouldTryXai(source: XDataSource, hasToken: boolean): boolean {
  if (source === "apify") return false;
  if (source === "xai") return hasToken;
  return hasToken;
}

function shouldTryApify(source: XDataSource, xaiFailed: boolean): boolean {
  if (source === "apify") return true;
  if (source === "auto") return true;
  // When user picked Grok-only but xAI failed, still try Apify
  if (source === "xai" && xaiFailed) return true;
  return false;
}

async function runLlmFallback(input: ResolveXContextInput): Promise<XContextResult> {
  logXContext("fallback_llm_openrouter", { intent: input.intent });
  const result = await fetchAIContext(
    input.rawContent,
    input.keyIdeas ?? [],
    input.tags ?? [],
    "x"
  );
  return { mode: "ai", comments: result.comments, relatedPosts: result.relatedPosts };
}

async function tryApifyPath(input: ResolveXContextInput): Promise<XContextResult | null> {
  if (input.intent === "research") {
    const query =
      input.nicheKeywords?.slice(0, 2).join(" ") ||
      input.tags?.slice(0, 2).join(" ") ||
      input.keyIdeas?.slice(0, 2).join(" ") ||
      input.rawContent.slice(0, 80);
    logXContext("apify_research_start", { query: query.slice(0, 80) });
    const search = await fetchApifyXSearch(query, 8);
    if (search && (search.comments.length > 0 || search.relatedPosts.length > 0)) {
      logXContext("apify_research_done", {
        comments: search.comments.length,
        posts: search.relatedPosts.length,
      });
      return { mode: "apify", comments: search.comments, relatedPosts: search.relatedPosts };
    }
    logXContext("apify_research_empty", { query: query.slice(0, 80) }, "warn");
    return null;
  }

  if (input.sourceUrl) {
    logXContext("apify_tweet_start", { url: input.sourceUrl });
    const tweet = await fetchApifyTweetContext(input.sourceUrl);
    if (tweet && (tweet.comments.length > 0 || tweet.relatedPosts.length > 0)) {
      logXContext("apify_tweet_done", {
        url: input.sourceUrl,
        comments: tweet.comments.length,
        posts: tweet.relatedPosts.length,
      });
      return { mode: "apify", comments: tweet.comments, relatedPosts: tweet.relatedPosts };
    }
    logXContext("apify_tweet_empty", { url: input.sourceUrl }, "warn");
  }

  return null;
}

export async function resolveXContext(
  input: ResolveXContextInput
): Promise<XContextResult & { meta?: ResolveXContextMeta }> {
  const meta: ResolveXContextMeta = { attempted: [], errors: [] };

  const cacheExtra = input.sourceUrl ?? input.rawContent.slice(0, 80);
  const cached = await getCachedXContext(
    input.userId,
    input.intent,
    input.inspirationId,
    cacheExtra
  );
  if (cached) {
    return { ...cached, meta: { attempted: ["cache"], errors: [] } };
  }

  logXContext("resolve_start", {
    userId: input.userId,
    intent: input.intent,
    xDataSource: input.xDataSource,
    plan: input.plan ?? "unknown",
    isPremium: input.plan === "premium",
    hasSourceUrl: !!input.sourceUrl,
  });

  if (!checkXContextDailyLimit(input.userId)) {
    logXContext("daily_limit_reached", { userId: input.userId }, "warn");
    meta.fallbackReason = "daily_limit";
    const fallback = await runLlmFallback(input);
    return { ...fallback, meta };
  }

  const accessToken = await getUserXaiAccessToken(input.userId);
  const tryXai = shouldTryXai(input.xDataSource, !!accessToken);
  let xaiFailed = false;

  if (!accessToken && (input.xDataSource === "xai" || input.xDataSource === "auto")) {
    meta.errors.push("No Grok token stored — connect in Settings or use Apify");
    logXContext("no_grok_token", { xDataSource: input.xDataSource }, "warn");
  }

  if (tryXai && accessToken) {
    meta.attempted.push("xai");
    const { result: xaiResult, error } = await fetchXaiSearchContext(accessToken, {
      intent: input.intent,
      rawContent: input.rawContent,
      sourceUrl: input.sourceUrl,
      keyIdeas: input.keyIdeas,
      tags: input.tags,
      nicheKeywords: input.nicheKeywords,
      userId: input.userId,
    });

    if (error) {
      xaiFailed = true;
      meta.errors.push(error.message);
      if (error.bodyPreview) {
        logXContext("xai_error_detail", { preview: error.bodyPreview.slice(0, 200) }, "warn");
      }
    }

    if (xaiResult && (xaiResult.comments.length > 0 || xaiResult.relatedPosts.length > 0)) {
      const payload: XContextResult = {
        mode: "xai",
        comments: xaiResult.comments,
        relatedPosts: xaiResult.relatedPosts,
      };
      incrementXContextDailyLimit(input.userId);
      await setCachedXContext(
        input.userId,
        input.intent,
        "xai",
        payload,
        input.inspirationId,
        cacheExtra
      );
      return { ...payload, meta };
    }

    xaiFailed = true;
    if (!error) meta.errors.push("xAI returned empty results");
  }

  if (shouldTryApify(input.xDataSource, xaiFailed)) {
    meta.attempted.push("apify");
    if (!process.env.APIFY_API_TOKEN) {
      meta.errors.push("APIFY_API_TOKEN not set on server");
      logXContext("apify_skipped_no_token", {}, "warn");
    } else {
      const apifyResult = await tryApifyPath(input);
      if (apifyResult) {
        incrementXContextDailyLimit(input.userId);
        await setCachedXContext(
          input.userId,
          input.intent,
          "apify",
          apifyResult,
          input.inspirationId,
          cacheExtra
        );
        return { ...apifyResult, meta };
      }
      meta.errors.push("Apify returned no data");
    }
  }

  meta.attempted.push("openrouter_llm");
  meta.fallbackReason = "all_live_sources_failed";
  logXContext("resolve_fallback_ai", { errors: meta.errors }, "warn");

  const fallback = await runLlmFallback(input);
  await setCachedXContext(
    input.userId,
    input.intent,
    "ai",
    fallback,
    input.inspirationId,
    cacheExtra
  );
  return { ...fallback, meta };
}

export async function enrichXRawContent(
  userId: string,
  xDataSource: XDataSource,
  sourceUrl: string,
  existingContent: string
): Promise<string> {
  const result = await resolveXContext({
    userId,
    xDataSource,
    rawContent: existingContent,
    sourceUrl,
    intent: "enrich",
  });

  const parts: string[] = [existingContent];
  for (const c of result.comments) {
    parts.push(`${c.author}: ${c.body}`);
  }
  const merged = parts.join("\n\n").trim();
  return merged.length > existingContent.length ? merged : existingContent;
}
