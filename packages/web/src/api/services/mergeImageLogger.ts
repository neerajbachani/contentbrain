type MergeImageLogLevel = "info" | "warn" | "error";

function prefix(level: MergeImageLogLevel, event: string, detail?: Record<string, unknown>) {
  const payload = detail ? ` ${JSON.stringify(detail)}` : "";
  const line = `[MergeImage] ${event}${payload}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function logMergeImage(
  event: string,
  detail?: Record<string, unknown>,
  level: MergeImageLogLevel = "info"
) {
  prefix(level, event, detail);
}

export function truncateBodyPreview(body: string, max = 400): string {
  return body.length > max ? `${body.slice(0, max)}…` : body;
}

export function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
