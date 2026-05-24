import { fetchTranscript } from "youtube-transcript";
import { parseYouTubeVideoId } from "./youtubeUrl";

const MAX_TRANSCRIPT_CHARS = 40_000;
const TRANSCRIPT_MARKER = "--- Transcript ---";

export async function fetchYouTubeTranscriptText(
  videoIdOrUrl: string,
  lang?: string
): Promise<string | null> {
  try {
    const segments = await fetchTranscript(
      videoIdOrUrl,
      lang ? { lang } : undefined
    );
    if (!segments?.length) return null;

    const text = segments
      .map((s) => s.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (!text) return null;

    if (text.length <= MAX_TRANSCRIPT_CHARS) return text;
    return `${text.slice(0, MAX_TRANSCRIPT_CHARS)}\n\n[Transcript truncated]`;
  } catch (err) {
    console.error("[youtube] transcript fetch failed:", err);
    return null;
  }
}

export async function enrichYouTubeRawContent(
  sourceUrl: string,
  existingContent: string
): Promise<string> {
  const videoId = parseYouTubeVideoId(sourceUrl);
  if (!videoId) return existingContent;

  if (existingContent.includes(TRANSCRIPT_MARKER)) return existingContent;

  const transcript = await fetchYouTubeTranscriptText(videoId);
  if (!transcript || transcript.length < 50) return existingContent;

  const merged = `${existingContent.trim()}\n\n${TRANSCRIPT_MARKER}\n${transcript}`.trim();
  return merged.length > existingContent.length ? merged : existingContent;
}
