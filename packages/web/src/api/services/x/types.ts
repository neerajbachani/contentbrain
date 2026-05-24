import type { ContextComment, ContextPost } from "../context/redditContext";

export type XDataSource = "auto" | "xai" | "apify";
export type XContextMode = "xai" | "apify" | "ai";
export type XContextIntent =
  | "context"
  | "enrich"
  | "research"
  | "meme_search"
  | "trending_global"
  | "trending_niche";

export interface XContextResult {
  mode: XContextMode;
  comments: ContextComment[];
  relatedPosts: ContextPost[];
}

export interface ResolveXContextInput {
  userId: string;
  xDataSource: XDataSource;
  rawContent: string;
  sourceUrl?: string | null;
  keyIdeas?: string[];
  tags?: string[];
  intent: XContextIntent;
  inspirationId?: string;
  nicheKeywords?: string[];
  plan?: string;
}
