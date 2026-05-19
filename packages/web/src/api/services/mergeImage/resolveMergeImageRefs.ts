import { hostnameFromUrl, logMergeImage } from "../mergeImageLogger";
import { MERGE_IMAGE_MAX_REFS } from "./mergeImageConfig";

export type InspirationForRefs = {
  id: string;
  ogImage: string | null;
};

function isValidImageUrl(url: string): boolean {
  const t = url.trim();
  if (!t.startsWith("http://") && !t.startsWith("https://")) return false;
  try {
    new URL(t);
    return true;
  } catch {
    return false;
  }
}

export function resolveMergeImageRefs(input: {
  sources: InspirationForRefs[];
  referenceMode?: "auto" | "manual";
  referenceInspirationIds?: string[];
  useReferences?: boolean;
}): { urls: string[]; hostnames: string[]; skipped: string[] } {
  const useRefs = input.useReferences !== false;
  if (!useRefs) {
    return { urls: [], hostnames: [], skipped: ["useReferences_false"] };
  }

  let pool = input.sources;
  if (input.referenceMode === "manual" && input.referenceInspirationIds?.length) {
    const idSet = new Set(input.referenceInspirationIds);
    pool = input.sources.filter((s) => idSet.has(s.id));
  }

  const urls: string[] = [];
  const hostnames: string[] = [];
  const skipped: string[] = [];

  for (const src of pool) {
    if (urls.length >= MERGE_IMAGE_MAX_REFS) break;
    const og = src.ogImage?.trim();
    if (!og) {
      skipped.push(`${src.id}:no_og_image`);
      continue;
    }
    if (!isValidImageUrl(og)) {
      skipped.push(`${src.id}:invalid_url`);
      continue;
    }
    if (urls.includes(og)) continue;
    urls.push(og);
    const host = hostnameFromUrl(og);
    if (host) hostnames.push(host);
  }

  logMergeImage("merge_image_refs_resolved", {
    requestedIds: pool.map((s) => s.id),
    validCount: urls.length,
    invalidCount: skipped.length,
    hostnames,
  }, urls.length === 0 && pool.length > 0 ? "warn" : "info");

  return { urls, hostnames, skipped };
}
