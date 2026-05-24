import type { ContextComment, ContextPost } from "../context/redditContext";
import { parseEngagementFromText } from "./xEngagement";
import { sanitizeXText } from "./xTextSanitizer";
import { logXContext } from "./logger";
import type { XContextIntent } from "./types";

function extractUrlsFromText(text: string): string[] {
  const matches = text.match(/https?:\/\/(?:twitter\.com|x\.com)\/\S+/gi) ?? [];
  return [...new Set(matches.map((u) => u.replace(/[)\],.]+$/, "")))];
}

function extractTwitterMediaUrls(text: string): string[] {
  const matches =
    text.match(/https?:\/\/(?:pbs\.twimg\.com|video\.twimg\.com)\/\S+/gi) ?? [];
  return [...new Set(matches.map((u) => u.replace(/[)\],."']+$/, "")))];
}

function citationImageUrl(obj: Record<string, unknown>): string | undefined {
  const fields = [
    obj.image_url,
    obj.thumbnail_url,
    obj.media_url,
    obj.media_url_https,
    obj.preview_image_url,
  ];
  for (const f of fields) {
    if (typeof f === "string" && f.startsWith("http")) return f;
  }
  if (obj.media && typeof obj.media === "object") {
    const m = obj.media as Record<string, unknown>;
    if (typeof m.media_url_https === "string") return m.media_url_https;
    if (typeof m.url === "string") return m.url;
  }
  return undefined;
}

function isXUrl(url: string): boolean {
  return url.includes("x.com/") || url.includes("twitter.com/");
}

function stripUrls(text: string): string {
  return text.replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim();
}

function collectOutputText(data: any): string {
  const parts: string[] = [];

  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    parts.push(data.output_text);
  }

  const output = data?.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (item?.type === "message" && Array.isArray(item.content)) {
        for (const block of item.content) {
          if (block?.type === "output_text" && typeof block.text === "string") {
            parts.push(block.text);
          } else if (typeof block?.text === "string") {
            parts.push(block.text);
          }
        }
      }
      if (typeof item?.text === "string" && item.text.trim()) {
        parts.push(item.text);
      }
      if (item?.type === "x_search_call" || item?.type === "web_search_call") {
        const resultText =
          item?.result ?? item?.output ?? item?.content ?? item?.summary;
        if (typeof resultText === "string" && resultText.trim()) {
          parts.push(resultText);
        } else if (resultText && typeof resultText === "object") {
          const nested = collectOutputText(resultText);
          if (nested) parts.push(nested);
        }
      }
    }
  }

  return parts.join("\n\n").trim();
}

export function logXaiOutputStructure(data: unknown): void {
  const output = (data as { output?: unknown[] })?.output;
  if (!Array.isArray(output)) {
    logXContext("xai_output_structure", { hasOutput: false }, "warn");
    return;
  }
  const types = output.map((item) => {
    const o = item as Record<string, unknown>;
    const contentTypes = Array.isArray(o.content)
      ? (o.content as { type?: string }[]).map((b) => b.type).filter(Boolean)
      : [];
    return {
      type: o.type ?? "unknown",
      contentTypes: contentTypes.length ? contentTypes : undefined,
    };
  });
  logXContext("xai_output_structure", { outputTypes: types.slice(0, 12) }, "warn");
}

function collectCitations(data: any): unknown[] {
  const found: unknown[] = [];

  if (Array.isArray(data?.citations)) found.push(...data.citations);

  const output = data?.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (Array.isArray(item?.citations)) found.push(...item.citations);
      if (Array.isArray(item?.content)) {
        for (const block of item.content) {
          if (Array.isArray(block?.annotations)) found.push(...block.annotations);
        }
      }
    }
  }

  return found;
}

function citationText(obj: Record<string, unknown>): string | undefined {
  const fields = [
    obj.text,
    obj.snippet,
    obj.description,
    obj.content,
    obj.headline,
    obj.summary,
    obj.excerpt,
  ];
  for (const f of fields) {
    if (typeof f === "string" && f.trim().length > 8) return f.trim().slice(0, 400);
  }
  return undefined;
}

function citationTitle(obj: Record<string, unknown>, url: string, summary?: string): string {
  const candidates = [obj.title, obj.headline, obj.name, obj.text, obj.snippet];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 8 && !c.startsWith("http")) {
      return sanitizeXText(c.trim().slice(0, 280)) ?? url;
    }
  }
  if (summary && summary.length > 12) return summary.slice(0, 280);
  return url;
}

function enrichPostFromText(post: ContextPost, sourceText: string): ContextPost {
  const combined = `${post.title} ${post.summary ?? ""} ${sourceText}`;
  const eng = parseEngagementFromText(combined);
  if (!eng) return post;
  return {
    ...post,
    score: eng.rankScore,
    engagementLabel: eng.label,
  };
}

function parseCitationObjects(citations: unknown[]): ContextPost[] {
  const posts: ContextPost[] = [];

  for (const c of citations) {
    if (typeof c === "string") {
      if (isXUrl(c)) {
        posts.push({ title: c, url: c, score: 0, platform: "x" });
      }
      continue;
    }

    if (c && typeof c === "object") {
      const obj = c as Record<string, unknown>;
      const url =
        (obj.url as string) ??
        (obj.post_url as string) ??
        (obj.link as string) ??
        (obj.uri as string);

      if (!url || !isXUrl(url)) continue;

      const rawSummary = citationText(obj);
      const summary = sanitizeXText(rawSummary);
      const title = citationTitle(obj, url, summary);
      const sourceText = combinedCitationSource(obj, rawSummary);
      const thumbFromCitation = citationImageUrl(obj);
      const thumbFromText = extractTwitterMediaUrls(sourceText)[0];

      posts.push(
        enrichPostFromText(
          {
            title,
            url,
            score: 0,
            platform: "x",
            summary,
            thumbnailUrl: thumbFromCitation ?? thumbFromText,
          },
          sourceText
        )
      );
    }
  }

  return posts;
}

function combinedCitationSource(obj: Record<string, unknown>, summary?: string): string {
  return [obj.text, obj.snippet, obj.description, summary].filter((x) => typeof x === "string").join(" ");
}

/** Associate nearby output-text chunks with X URLs for richer summaries. */
function extractPostsFromOutputText(outputText: string): ContextPost[] {
  const posts: ContextPost[] = [];
  const chunks = outputText
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);

  for (const chunk of chunks) {
    const urls = extractUrlsFromText(chunk);
    if (urls.length === 0) continue;

    const summaryText = sanitizeXText(stripUrls(chunk)) ?? "";
    const mediaInChunk = extractTwitterMediaUrls(chunk);
    urls.forEach((url, idx) => {
      const title =
        summaryText.length > 12
          ? summaryText.slice(0, 280)
          : url;
      posts.push(
        enrichPostFromText(
          {
            title,
            url,
            score: 0,
            platform: "x",
            summary: summaryText.length > 12 ? summaryText.slice(0, 400) : undefined,
            thumbnailUrl: mediaInChunk[idx] ?? mediaInChunk[0],
          },
          chunk
        )
      );
    });
  }

  return posts;
}

function mergePosts(posts: ContextPost[]): ContextPost[] {
  const byUrl = new Map<string, ContextPost>();

  for (const post of posts) {
    if (!post.url) continue;
    const key = post.url.replace(/[)\],.]+$/, "");
    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, { ...post, url: key });
      continue;
    }
    const existingRich = (existing.summary?.length ?? 0) + (existing.title?.length ?? 0);
    const incomingRich = (post.summary?.length ?? 0) + (post.title?.length ?? 0);
    const merged: ContextPost = {
      ...existing,
      url: key,
      thumbnailUrl: existing.thumbnailUrl ?? post.thumbnailUrl,
    };
    if (incomingRich > existingRich) {
      byUrl.set(key, {
        ...post,
        url: key,
        thumbnailUrl: post.thumbnailUrl ?? existing.thumbnailUrl,
      });
    } else {
      byUrl.set(key, merged);
    }
  }

  return [...byUrl.values()];
}

export function parseXaiResponsesPayload(
  data: any,
  intent?: XContextIntent
): {
  comments: ContextComment[];
  relatedPosts: ContextPost[];
} {
  const comments: ContextComment[] = [];
  const relatedPosts: ContextPost[] = [];

  const outputText = collectOutputText(data);

  if (outputText) {
    const chunks = outputText
      .split(/\n{2,}/)
      .map((s) => s.trim())
      .filter((s) => s.length > 15);

    if (chunks.length <= 1 && outputText.length > 40) {
      comments.push({
        author: "Grok · X search",
        body: outputText,
        score: 0,
      });
    } else {
      for (const chunk of chunks.slice(0, 8)) {
        comments.push({
          author: "Grok · X search",
          body: chunk,
          score: 0,
        });
      }
    }

    relatedPosts.push(...extractPostsFromOutputText(outputText));
  }

  const citations = collectCitations(data);
  if (citations.length) {
    relatedPosts.push(...parseCitationObjects(citations));
  }

  const dedupedPosts = mergePosts(relatedPosts);

  const urlOnly = dedupedPosts.filter(
    (p) => !p.summary && (p.title.startsWith("http") || p.title === p.url)
  ).length;
  const textEnriched = dedupedPosts.length - urlOnly;

  const withThumbnail = dedupedPosts.filter((p) => p.thumbnailUrl).length;

  logXContext("parse_xai_response", {
    outputTextLen: outputText.length,
    commentCount: comments.length,
    postCount: dedupedPosts.length,
    citationCount: citations.length,
    urlOnly,
    textEnriched,
    withThumbnail,
    intent: intent ?? "unknown",
  });

  if (intent === "meme_search" && dedupedPosts.length > 0 && withThumbnail === 0) {
    logXaiOutputStructure(data);
    logXContext(
      "meme_search_zero_thumbnails_parse",
      { postCount: dedupedPosts.length },
      "warn"
    );
  }

  return { comments, relatedPosts: dedupedPosts };
}
