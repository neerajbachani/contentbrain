export function isYouTubePlatform(platform: string, sourceUrl?: string | null): boolean {
  const p = platform.toLowerCase();
  if (p === "youtube") return true;
  const url = (sourceUrl ?? "").toLowerCase();
  return url.includes("youtube.com") || url.includes("youtu.be");
}

/** Extract 11-char video id from common YouTube URL shapes. */
export function parseYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }

    if (!host.endsWith("youtube.com")) return null;

    if (parsed.pathname.startsWith("/watch")) {
      const id = parsed.searchParams.get("v");
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }

    const pathMatch = parsed.pathname.match(
      /^\/(?:embed|v|shorts|live)\/([\w-]{11})/
    );
    return pathMatch?.[1] ?? null;
  } catch {
    const bare = url.trim();
    if (/^[\w-]{11}$/.test(bare)) return bare;
    return null;
  }
}
