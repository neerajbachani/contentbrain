/** Strip markdown/list artifacts from x_search text fields. */
export function sanitizeXText(text: string | undefined | null): string | undefined {
  if (!text) return undefined;
  let s = text.trim();
  if (!s) return undefined;

  s = s.replace(/\*\*/g, "");
  s = s.replace(/^\s*[-*•]\s+/gm, "");
  s = s.replace(/^["'`]+|["'`]+$/g, "");
  s = s.replace(/\s+/g, " ").trim();
  return s || undefined;
}
