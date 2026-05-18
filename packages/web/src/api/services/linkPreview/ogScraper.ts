import ogs from "open-graph-scraper";
import { db } from "../../database";
import * as schema from "../../database/schema";
import { eq } from "drizzle-orm";
import { memCache } from "../../cache/memCache";
import { randomUUID } from "crypto";

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

export async function getLinkPreview(url: string): Promise<LinkPreview> {
  // 1. In-memory cache (1h)
  const cacheKey = `og:${url}`;
  const cached = memCache.get<LinkPreview>(cacheKey);
  if (cached) return cached;

  // 2. DB cache
  const dbCached = await db
    .select()
    .from(schema.linkPreviews)
    .where(eq(schema.linkPreviews.url, url))
    .get();

  if (dbCached) {
    const preview: LinkPreview = {
      url: dbCached.url,
      title: dbCached.title,
      description: dbCached.description,
      imageUrl: dbCached.imageUrl,
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
        const preview: LinkPreview = {
          url,
          title: oembed?.author_name ? String(oembed.author_name) : null,
          description: description || null,
          imageUrl: oembed?.thumbnail_url ? String(oembed.thumbnail_url) : null,
          siteName: "X",
        };

        await persistPreview(preview);
        memCache.set(cacheKey, preview, 3600);
        return preview;
      }
    } catch {
      // Fall through to OG scraping below.
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
