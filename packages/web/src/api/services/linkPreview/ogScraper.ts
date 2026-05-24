import ogs from "open-graph-scraper";
import { db } from "../../database";
import * as schema from "../../database/schema";
import { eq } from "drizzle-orm";
import { memCache } from "../../cache/memCache";
import { randomUUID } from "crypto";
import {
  fetchTweetSyndicationThumbnail,
  resolveXPostMedia,
} from "../x/resolveXPostMedia";

export interface LinkPreview {
  url: string;
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  siteName?: string | null;
  favicon?: string | null;
}

function isTwitterUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes("twitter.com") || host.includes("x.com");
  } catch {
    return false;
  }
}

export function parseTweetId(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/i);
  return match?.[1] ?? null;
}

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function persistPreview(preview: LinkPreview): Promise<void> {
  await db
    .insert(schema.linkPreviews)
    .values({
      id: randomUUID(),
      url: preview.url,
      title: preview.title ?? null,
      description: preview.description ?? null,
      imageUrl: preview.imageUrl ?? null,
      siteName: preview.siteName ?? null,
      favicon: preview.favicon ?? null,
      fetchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.linkPreviews.url,
      set: {
        title: preview.title ?? null,
        description: preview.description ?? null,
        imageUrl: preview.imageUrl ?? null,
        siteName: preview.siteName ?? null,
        favicon: preview.favicon ?? null,
        fetchedAt: new Date(),
      },
    });
}

/** Resolve X post image only (syndication + FxTwitter + oEmbed), bypassing stale null DB cache. */
export async function resolveXThumbnailOnly(url: string): Promise<string | null> {
  if (!isTwitterUrl(url)) return null;
  const { imageUrl } = await resolveXPostMedia(url);
  return imageUrl;
}

export async function getLinkPreview(url: string): Promise<LinkPreview> {
  // 1. In-memory cache (1h)
  const cacheKey = `og:${url}`;
  const cached = memCache.get<LinkPreview>(cacheKey);
  if (cached) {
    if (!cached.imageUrl && isTwitterUrl(url)) {
      const imageUrl = await resolveXThumbnailOnly(url);
      if (imageUrl) {
        const updated = { ...cached, imageUrl };
        memCache.set(cacheKey, updated, 3600);
        await persistPreview(updated);
        return updated;
      }
    }
    return cached;
  }

  // 2. DB cache
  const dbCached = await db
    .select()
    .from(schema.linkPreviews)
    .where(eq(schema.linkPreviews.url, url))
    .get();

  if (dbCached) {
    let imageUrl = dbCached.imageUrl;
    if (!imageUrl && isTwitterUrl(url)) {
      imageUrl = await resolveXThumbnailOnly(url);
      if (imageUrl) {
        const updated: LinkPreview = {
          url: dbCached.url,
          title: dbCached.title,
          description: dbCached.description,
          imageUrl,
          siteName: dbCached.siteName,
          favicon: dbCached.favicon,
        };
        await persistPreview(updated);
        memCache.set(cacheKey, updated, 3600);
        return updated;
      }
    }

    const preview: LinkPreview = {
      url: dbCached.url,
      title: dbCached.title,
      description: dbCached.description,
      imageUrl,
      siteName: dbCached.siteName,
      favicon: dbCached.favicon,
    };
    memCache.set(cacheKey, preview, 3600);
    return preview;
  }

  // 3. Twitter/X fallback via oEmbed (more reliable than OG for tweets)
  if (isTwitterUrl(url)) {
    try {
      const oembedRes = await fetch(
        `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`
      );
      if (oembedRes.ok) {
        const oembed = await oembedRes.json() as any;
        const description = stripHtml(String(oembed?.html ?? ""));
        let imageUrl = oembed?.thumbnail_url ? String(oembed.thumbnail_url) : null;
        if (!imageUrl) {
          const tweetId = parseTweetId(url);
          if (tweetId) {
            imageUrl = await fetchTweetSyndicationThumbnail(tweetId);
          }
        }

        const preview: LinkPreview = {
          url,
          title: oembed?.author_name ? String(oembed.author_name) : null,
          description: description || null,
          imageUrl,
          siteName: "X",
        };

        await persistPreview(preview);
        memCache.set(cacheKey, preview, 3600);
        return preview;
      }
    } catch {
      // Fall through to OG scraping below.
    }

    const tweetId = parseTweetId(url);
    if (tweetId) {
      const syndicationImage = await fetchTweetSyndicationThumbnail(tweetId);
      if (syndicationImage) {
        const preview: LinkPreview = {
          url,
          title: null,
          description: null,
          imageUrl: syndicationImage,
          siteName: "X",
        };
        await persistPreview(preview);
        memCache.set(cacheKey, preview, 3600);
        return preview;
      }
    }
  }

  // 4. Fresh scrape
  try {
    const { result, error: ogsError } = await ogs({
      url,
      fetchOptions: {
        headers: { "user-agent": "Mozilla/5.0 (compatible; ContentBrainBot/1.0)" },
      },
      timeout: 8000,
    } as any);

    const preview: LinkPreview = ogsError || !result?.success
      ? { url, title: null, description: null, imageUrl: null, siteName: null }
      : {
          url,
          title: result.ogTitle ?? result.dcTitle ?? null,
          description: result.ogDescription ?? null,
          imageUrl: (result.ogImage as any)?.[0]?.url ?? (result.twitterImage as any)?.[0]?.url ?? null,
          siteName: result.ogSiteName ?? null,
          favicon: (result as any).favicon ?? null,
        };

    await persistPreview(preview);

    memCache.set(cacheKey, preview, 3600);
    return preview;
  } catch {
    const fallback: LinkPreview = { url, title: null, description: null, imageUrl: null, siteName: null };
    memCache.set(cacheKey, fallback, 300); // short cache on failure
    return fallback;
  }
}
