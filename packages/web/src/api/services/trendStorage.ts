import { inArray } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { deduplicateTrendsByUrl, TrendItem } from "./normalizer";
import { logTrends, platformBreakdown } from "./trendsLogger";

export async function persistTrendItems(items: TrendItem[]): Promise<number> {
  const deduped = deduplicateTrendsByUrl(items);
  if (deduped.length === 0) return 0;

  const urls = deduped.map((t) => t.url).filter((u): u is string => !!u);
  if (urls.length > 0) {
    await db.delete(schema.trends).where(inArray(schema.trends.url, urls));
  }

  let inserted = 0;
  for (let i = 0; i < deduped.length; i += 50) {
    const chunk = deduped.slice(i, i + 50);
    await db
      .insert(schema.trends)
      .values(
        chunk.map((t) => ({
          id: t.id,
          platform: t.source,
          platformDisplay: t.platformDisplay,
          niche: t.niche,
          title: t.title,
          url: t.url ?? null,
          summary: t.summary ?? null,
          thumbnailUrl: t.thumbnailUrl ?? null,
          author: t.author ?? null,
          engagementScore: t.engagementScore,
          scrapedAt: new Date(t.scrapedAt),
          expiresAt: new Date(t.expiresAt),
        }))
      )
      .onConflictDoNothing();
    inserted += chunk.length;
  }

  logTrends("persist_done", {
    count: inserted,
    breakdown: platformBreakdown(deduped.map((t) => ({ platform: t.source }))),
  });

  return inserted;
}
