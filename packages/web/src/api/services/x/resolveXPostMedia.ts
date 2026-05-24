import ogs from "open-graph-scraper";
import { normalizeXUrl, parseXStatusUrl } from "./xUrl";
import { logXContext } from "./logger";

const UA = "Mozilla/5.0 (compatible; ContentBrain/1.0)";

type FxTwitterMediaBlock = {
  photos?: { url?: string }[];
  videos?: { url?: string; thumbnail_url?: string }[];
  all?: { url?: string; thumbnail_url?: string; type?: string }[];
};

export type XMediaSource =
  | "syndication"
  | "fxtwitter"
  | "oembed"
  | "og"
  | "existing";

export type ResolveXPostMediaResult = {
  imageUrl: string | null;
  source?: XMediaSource;
};

function isTwitterUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes("twitter.com") || host.includes("x.com");
  } catch {
    return false;
  }
}

function firstHttpUrl(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === "string" && c.startsWith("http")) return c;
  }
  return null;
}

/** Parse syndication tweet-result JSON for any attached media image. */
export function extractMediaFromSyndication(data: Record<string, unknown>): string | null {
  const mediaDetails = data.mediaDetails;
  if (Array.isArray(mediaDetails)) {
    for (const item of mediaDetails) {
      if (item && typeof item === "object") {
        const url = firstHttpUrl(
          (item as Record<string, unknown>).media_url_https,
          (item as Record<string, unknown>).media_url
        );
        if (url) return url;
      }
    }
  }

  const photos = data.photos;
  if (Array.isArray(photos)) {
    for (const p of photos) {
      if (p && typeof p === "object") {
        const url = firstHttpUrl((p as Record<string, unknown>).url);
        if (url) return url;
      }
    }
  }

  const video = data.video;
  if (video && typeof video === "object") {
    const poster = firstHttpUrl((video as Record<string, unknown>).poster);
    if (poster) return poster;
  }

  const entities = data.entities;
  if (entities && typeof entities === "object") {
    const media = (entities as Record<string, unknown>).media;
    if (Array.isArray(media)) {
      for (const m of media) {
        if (m && typeof m === "object") {
          const url = firstHttpUrl((m as Record<string, unknown>).media_url_https);
          if (url) return url;
        }
      }
    }
  }

  const card = data.card;
  if (card && typeof card === "object") {
    const binding = (card as Record<string, unknown>).binding_values;
    if (binding && typeof binding === "object") {
      const img = (binding as Record<string, unknown>).thumbnail_image_original;
      if (img && typeof img === "object") {
        const url = firstHttpUrl((img as Record<string, unknown>).image_value);
        if (url) return url;
      }
    }
  }

  return null;
}

export async function fetchTweetSyndicationMedia(
  tweetId: string
): Promise<{ imageUrl: string | null; status: number }> {
  const token = Math.floor(Math.random() * 1e10);
  const syndicationUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=${token}&lang=en`;

  try {
    const res = await fetch(syndicationUrl, {
      headers: { "User-Agent": UA },
    });
    if (!res.ok) {
      logXContext(
        "syndication_http_error",
        { tweetId, status: res.status },
        "warn"
      );
      return { imageUrl: null, status: res.status };
    }

    const data = (await res.json()) as Record<string, unknown>;
    const imageUrl = extractMediaFromSyndication(data);
    logXContext("syndication_parsed", {
      tweetId,
      hasMedia: !!imageUrl,
      hasMediaDetails: Array.isArray(data.mediaDetails) && data.mediaDetails.length > 0,
    });
    return { imageUrl, status: res.status };
  } catch (err: unknown) {
    logXContext(
      "syndication_fetch_failed",
      { tweetId, message: err instanceof Error ? err.message : String(err) },
      "warn"
    );
    return { imageUrl: null, status: 0 };
  }
}

async function fetchFxTwitterMedia(tweetId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.fxtwitter.com/2/status/${tweetId}`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) {
      logXContext("fxtwitter_http_error", { tweetId, status: res.status }, "warn");
      return null;
    }

    const data = (await res.json()) as {
      status?: { media?: FxTwitterMediaBlock };
      tweet?: { media?: FxTwitterMediaBlock };
    };

    const media = data?.status?.media ?? data?.tweet?.media;
    if (!media) return null;

    const photo = media.photos?.[0]?.url;
    if (photo) return photo;

    for (const v of media.videos ?? []) {
      const thumb = firstHttpUrl(v.thumbnail_url, v.url);
      if (thumb) return thumb;
    }

    for (const item of media.all ?? []) {
      if (item.type === "photo" && item.url) return item.url;
      const thumb = firstHttpUrl(item.thumbnail_url, item.url);
      if (thumb) return thumb;
    }

    return null;
  } catch (err: unknown) {
    logXContext(
      "fxtwitter_fetch_failed",
      { tweetId, message: err instanceof Error ? err.message : String(err) },
      "warn"
    );
    return null;
  }
}

async function fetchOembedThumbnail(url: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`,
      { headers: { "User-Agent": UA } }
    );
    if (!res.ok) return null;
    const oembed = (await res.json()) as { thumbnail_url?: string };
    return oembed.thumbnail_url ? String(oembed.thumbnail_url) : null;
  } catch {
    return null;
  }
}

async function fetchOgThumbnail(url: string): Promise<string | null> {
  try {
    const { result, error: ogsError } = await ogs({
      url,
      fetchOptions: { headers: { "user-agent": UA } },
      timeout: 6000,
    } as Parameters<typeof ogs>[0]);

    if (ogsError || !result?.success) return null;
    return (
      (result.ogImage as { url?: string }[] | undefined)?.[0]?.url ??
      (result.twitterImage as { url?: string }[] | undefined)?.[0]?.url ??
      null
    );
  } catch {
    return null;
  }
}

/** Resolve best-effort image URL for an X status post (multi-source, no stale OG cache). */
export async function resolveXPostMedia(url: string): Promise<ResolveXPostMediaResult> {
  const normalized = normalizeXUrl(url);
  if (!isTwitterUrl(normalized)) {
    return { imageUrl: null };
  }

  const tweetId = parseXStatusUrl(normalized)?.tweetId ?? null;
  const tried: string[] = [];

  if (tweetId) {
    tried.push("syndication");
    const { imageUrl: synUrl } = await fetchTweetSyndicationMedia(tweetId);
    if (synUrl) {
      logXContext("x_media_resolve_ok", { url: normalized, source: "syndication", tweetId });
      return { imageUrl: synUrl, source: "syndication" };
    }

    tried.push("fxtwitter");
    const fxUrl = await fetchFxTwitterMedia(tweetId);
    if (fxUrl) {
      logXContext("x_media_resolve_ok", { url: normalized, source: "fxtwitter", tweetId });
      return { imageUrl: fxUrl, source: "fxtwitter" };
    }
  }

  tried.push("oembed");
  const oembedUrl = await fetchOembedThumbnail(normalized);
  if (oembedUrl) {
    logXContext("x_media_resolve_ok", { url: normalized, source: "oembed", tweetId });
    return { imageUrl: oembedUrl, source: "oembed" };
  }

  tried.push("og");
  const ogUrl = await fetchOgThumbnail(normalized);
  if (ogUrl) {
    logXContext("x_media_resolve_ok", { url: normalized, source: "og", tweetId });
    return { imageUrl: ogUrl, source: "og" };
  }

  logXContext("x_media_resolve_miss", { url: normalized, tweetId, tried }, "warn");
  return { imageUrl: null };
}

/** Thin helper for inspirations / canvas / remix ogImage backfill. */
export async function resolveXOgImageForUrl(url: string): Promise<string | null> {
  const { imageUrl } = await resolveXPostMedia(url);
  return imageUrl;
}

/** Back-compat alias used by ogScraper trends path. */
export async function fetchTweetSyndicationThumbnail(tweetId: string): Promise<string | null> {
  const { imageUrl } = await fetchTweetSyndicationMedia(tweetId);
  return imageUrl;
}
