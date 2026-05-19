type XLogLevel = "info" | "warn" | "error";

function prefix(level: XLogLevel, event: string, detail?: Record<string, unknown>) {
  const payload = detail ? ` ${JSON.stringify(detail)}` : "";
  const line = `[XContext] ${event}${payload}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function logXContext(
  event: string,
  detail?: Record<string, unknown>,
  level: XLogLevel = "info"
) {
  const safe = { ...detail };
  if (typeof safe.tokenPreview === "string") {
    safe.tokenPreview = `${safe.tokenPreview.slice(0, 8)}…`;
  }
  prefix(level, event, safe);
}
