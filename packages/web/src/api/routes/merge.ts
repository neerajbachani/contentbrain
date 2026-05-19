import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, inArray, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { mergeContent } from "./ai";
import { randomUUID } from "crypto";
import { FREE_LIMITS, hasPremiumAccess } from "../config/limits";

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

export const mergeRoute = new Hono()
  .post("/generate", requireAuth, async (c) => {
    const user = c.get("user")!;
    const body = await c.req.json();
    const { inspirationIds, outputType, context } = body;

    if (!inspirationIds || inspirationIds.length < 2) {
      return c.json({ message: "At least 2 inspirations required" }, 400);
    }

    // Check rate limits
    let profile = await db
      .select()
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.userId, user.id))
      .get();

    const today = getTodayStr();
    if (profile && profile.lastResetDate !== today) {
      await db
        .update(schema.userProfiles)
        .set({ remixCount: 0, mergeCount: 0, trendCount: 0, lastResetDate: today })
        .where(eq(schema.userProfiles.userId, user.id));
      profile = { ...profile, remixCount: 0, mergeCount: 0, trendCount: 0, lastResetDate: today };
    }

    if (!hasPremiumAccess(profile?.plan) && (profile?.mergeCount ?? 0) >= FREE_LIMITS.dailyMerges) {
      return c.json(
        {
          message: `Daily merge limit reached (${FREE_LIMITS.dailyMerges}/day). Upgrade to Premium.`,
          limitReached: true,
        },
        403
      );
    }

    const sources = await db
      .select()
      .from(schema.inspirations)
      .where(
        and(
          eq(schema.inspirations.userId, user.id),
          inArray(schema.inspirations.id, inspirationIds)
        )
      );

    if (sources.length < 2) return c.json({ message: "Inspirations not found" }, 404);

    const content = await mergeContent(sources, outputType, context);

    const id = randomUUID();
    const [remix] = await db.insert(schema.remixes).values({
      id,
      userId: user.id,
      inspirationIds: JSON.stringify(inspirationIds),
      outputType: `merged_${outputType}`,
      outputContent: content,
      platform: "multi",
      variations: JSON.stringify([{ label: "Merged", content, why_it_works: "Combined from multiple sources" }]),
    }).returning();

    if (profile) {
      await db
        .update(schema.userProfiles)
        .set({ mergeCount: (profile.mergeCount ?? 0) + 1 })
        .where(eq(schema.userProfiles.userId, user.id));
    }

    return c.json({ remix, content }, 201);
  });
