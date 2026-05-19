/** Strip label prefixes that Grok sometimes injects into summaries (e.g. "URL: ...", "Author: ..."). */
function stripLabelPrefixes(text: string): string {
  // Remove leading "Key: value" metadata lines
  const labelPattern = /^(?:url|author|handle|engagement|views?|likes?|reposts?|retweets?|replies|tweet|post)\s*:\s*/gim;
  // Strip whole lines that are purely a label+value with no prose
  let s = text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      // Drop lines that are just "Label: value" with no sentence structure
      return !(/^[A-Za-z ]{2,20}:\s+\S/.test(trimmed) && trimmed.split(" ").length <= 6);
    })
    .join("\n");
  s = s.replace(labelPattern, "");
  return s;
}

/** Strip markdown/list artifacts from x_search text fields. */
export function sanitizeXText(text: string | undefined | null): string | undefined {
  if (!text) return undefined;
  let s = text.trim();
  if (!s) return undefined;

  s = s.replace(/\*\*/g, "");
  s = s.replace(/^\s*[-*•]\s+/gm, "");
  s = s.replace(/^["'`]+|["'`]+$/g, "");
  s = stripLabelPrefixes(s);
  s = s.replace(/\s+/g, " ").trim();
  return s || undefined;
}
