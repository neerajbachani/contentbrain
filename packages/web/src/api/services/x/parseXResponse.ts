import type { ContextComment, ContextPost } from "../context/redditContext";
import { logXContext } from "./logger";

function extractUrlsFromText(text: string): string[] {
  const matches = text.match(/https?:\/\/(?:twitter\.com|x\.com)\/\S+/gi) ?? [];
  return [...new Set(matches.map((u) => u.replace(/[)\],.]+$/, "")))];
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
          item?.result ??
          item?.output ??
          item?.content ??
          item?.summary;
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

function parseCitationObjects(citations: unknown[]): ContextPost[] {
  const posts: ContextPost[] = [];

  for (const c of citations) {
    if (typeof c === "string") {
      if (c.includes("x.com") || c.includes("twitter.com")) {
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
      const title =
        (obj.title as string) ??
        (obj.text as string) ??
        (obj.snippet as string) ??
        url ??
        "X post";

      if (url && (url.includes("x.com") || url.includes("twitter.com"))) {
        posts.push({
          title: String(title).slice(0, 280),
          url,
          score: 0,
          platform: "x",
          summary: typeof obj.text === "string" ? obj.text.slice(0, 400) : undefined,
        });
      }
    }
  }

  return posts;
}

export function parseXaiResponsesPayload(data: any): {
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

    for (const url of extractUrlsFromText(outputText)) {
      relatedPosts.push({ title: url, url, score: 0, platform: "x" });
    }
  }

  const citations = collectCitations(data);
  if (citations.length) {
    relatedPosts.push(...parseCitationObjects(citations));
  }

  const seen = new Set<string>();
  const dedupedPosts = relatedPosts.filter((p) => {
    if (seen.has(p.url)) return false;
    seen.add(p.url);
    return true;
  });

  logXContext("parse_xai_response", {
    outputTextLen: outputText.length,
    commentCount: comments.length,
    postCount: dedupedPosts.length,
    citationCount: citations.length,
  });

  return { comments, relatedPosts: dedupedPosts };
}
