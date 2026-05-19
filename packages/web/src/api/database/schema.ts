import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export * from "./auth-schema";

export const userProfiles = sqliteTable("user_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  niche: text("niche").notNull().default("[]"), // JSON array
  plan: text("plan").notNull().default("free"), // 'free' | 'premium'
  xDataSource: text("x_data_source").notNull().default("auto"), // 'auto' | 'xai' | 'apify'
  remixCount: integer("remix_count").notNull().default(0),
  mergeCount: integer("merge_count").notNull().default(0),
  trendCount: integer("trend_count").notNull().default(0),
  lastResetDate: text("last_reset_date").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const inspirations = sqliteTable("inspirations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(), // 'tweet' | 'reel' | 'reddit' | 'blog' | 'url' | 'text'
  sourcePlatform: text("source_platform").notNull().default("custom"),
  sourceUrl: text("source_url"),
  rawContent: text("raw_content").notNull(),
  ogImage: text("og_image"),
  title: text("title"),
  tags: text("tags").notNull().default("[]"), // JSON array
  summary: text("summary"),
  writingStyle: text("writing_style"),
  keyIdeas: text("key_ideas").notNull().default("[]"), // JSON array
  hook: text("hook"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const remixes = sqliteTable("remixes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  inspirationIds: text("inspiration_ids").notNull().default("[]"), // JSON array
  outputType: text("output_type").notNull(), // 'tweet' | 'thread' | 'reel_script' | ...
  outputContent: text("output_content").notNull(),
  platform: text("platform"),
  variations: text("variations").notNull().default("[]"), // JSON array
  imageUrl: text("image_url"),
  imageModel: text("image_model"),
  imagePrompt: text("image_prompt"),
  imageMetaJson: text("image_meta_json"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const trends = sqliteTable("trends", {
  id: text("id").primaryKey(),
  platform: text("platform").notNull(), // 'reddit' | 'x' | 'newsdata' | 'google_rss' | 'news'
  platformDisplay: text("platform_display").notNull().default("Reddit"), // 'Reddit' | 'X' | 'News' | 'Blog'
  niche: text("niche"),
  title: text("title").notNull(),
  url: text("url"),
  summary: text("summary"),
  thumbnailUrl: text("thumbnail_url"),
  author: text("author"),
  engagementScore: integer("engagement_score").default(0),
  scrapedAt: integer("scraped_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
});

export const canvases = sqliteTable("canvases", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull().default("Untitled Canvas"),
  inspirationIds: text("inspiration_ids").notNull().default("[]"),
  remixIds: text("remix_ids").notNull().default("[]"),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const userXaiCredentials = sqliteTable("user_xai_credentials", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const xContextCache = sqliteTable("x_context_cache", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  inspirationId: text("inspiration_id"),
  intent: text("intent").notNull(), // 'context' | 'enrich' | 'research'
  cacheKey: text("cache_key").notNull().unique(),
  mode: text("mode").notNull(), // 'xai' | 'apify' | 'ai'
  payloadJson: text("payload_json").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const linkPreviews = sqliteTable("link_previews", {
  id: text("id").primaryKey(),
  url: text("url").notNull().unique(),
  title: text("title"),
  description: text("description"),
  imageUrl: text("image_url"),
  siteName: text("site_name"),
  favicon: text("favicon"),
  fetchedAt: integer("fetched_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
