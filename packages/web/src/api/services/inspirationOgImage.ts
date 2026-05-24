import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and } from "drizzle-orm";
import { getLinkPreview } from "./linkPreview/ogScraper";
import { isXPlatform } from "./x/xUrl";
import { resolveXOgImageForUrl } from "./x/resolveXPostMedia";

type InspirationRow = typeof schema.inspirations.$inferSelect;

export async function backfillInspirationOgImage(
  item: InspirationRow
): Promise<InspirationRow> {
  if (item.ogImage?.trim()) return item;
  if (!item.sourceUrl || typeof item.sourceUrl !== "string") return item;

  const isX = isXPlatform(item.sourcePlatform ?? "", item.sourceUrl);
  let ogImage: string | null = null;

  try {
    if (isX) {
      ogImage = await resolveXOgImageForUrl(item.sourceUrl);
    } else {
      const preview = await getLinkPreview(item.sourceUrl);
      ogImage = preview.imageUrl ?? null;
    }
  } catch {
    return item;
  }

  if (!ogImage) return item;

  const [updated] = await db
    .update(schema.inspirations)
    .set({ ogImage })
    .where(
      and(
        eq(schema.inspirations.id, item.id),
        eq(schema.inspirations.userId, item.userId)
      )
    )
    .returning();

  return updated ?? { ...item, ogImage };
}

export async function resolveOgImageForNewInspiration(
  sourceUrl: string | null | undefined,
  sourcePlatform: string | null | undefined,
  existingOgImage: string | null | undefined
): Promise<string | null> {
  if (existingOgImage?.trim()) return existingOgImage;
  if (!sourceUrl || typeof sourceUrl !== "string") return null;

  if (isXPlatform(sourcePlatform ?? "", sourceUrl)) {
    return resolveXOgImageForUrl(sourceUrl);
  }

  try {
    const preview = await getLinkPreview(sourceUrl);
    return preview.imageUrl ?? null;
  } catch {
    return null;
  }
}
