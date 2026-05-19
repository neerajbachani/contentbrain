import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { remixContent } from "./ai";
import { randomUUID } from "crypto";
import { FREE_LIMITS, hasPremiumAccess } from "../config/limits";

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

export const remixesRoute = new Hono()
  .get("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const items = await db
      .select()
      .from(schema.remixes)
      .where(eq(schema.remixes.userId, user.id))
      .orderBy(schema.remixes.createdAt);
    return c.json({ remixes: items.reverse() }, 200);
  })
  .post("/generate", requireAuth, async (c) => {
    const user = c.get("user")!;
    const body = await c.req.json();
    const { inspirationId, outputType, targetPlatform, style, fuelContext, userTake } = body;

    if (!inspirationId || !outputType || !targetPlatform) {
      return c.json({ message: "Missing required fields" }, 400);
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

    if (!hasPremiumAccess(profile?.plan) && (profile?.remixCount ?? 0) >= FREE_LIMITS.dailyRemixes) {
      return c.json(
        {
          message: `Daily remix limit reached (${FREE_LIMITS.dailyRemixes}/day). Upgrade to Premium.`,
          limitReached: true,
        },
        403
      );
    }

    // Get the inspiration
    const inspiration = await db
      .select()
      .from(schema.inspirations)
      .where(and(eq(schema.inspirations.id, inspirationId), eq(schema.inspirations.userId, user.id)))
      .get();

    if (!inspiration) return c.json({ message: "Inspiration not found" }, 404);

    const augmentedContent = fuelContext
      ? `${inspiration.rawContent}\n\n---\nCommunity reactions to factor in:\n${fuelContext}`
      : inspiration.rawContent;

    const result = await remixContent(
      augmentedContent,
      outputType,
      targetPlatform,
      style ?? inspiration.writingStyle ?? "casual",
      typeof userTake === "string" ? userTake.trim() || undefined : undefined
    );

    const id = randomUUID();
    const [remix] = await db.insert(schema.remixes).values({
      id,
      userId: user.id,
      inspirationIds: JSON.stringify([inspirationId]),
      outputType,
      outputContent: result.variations?.[0]?.content ?? "",
      platform: targetPlatform,
      variations: JSON.stringify(result.variations ?? []),
    }).returning();

    // Increment count
    if (profile) {
      await db
        .update(schema.userProfiles)
        .set({ remixCount: (profile.remixCount ?? 0) + 1 })
        .where(eq(schema.userProfiles.userId, user.id));
    }

    return c.json({ remix, variations: result.variations }, 201);
  })
  .delete("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.param();
    await db
      .delete(schema.remixes)
      .where(and(eq(schema.remixes.id, id), eq(schema.remixes.userId, user.id)));
    return c.json({ success: true }, 200);
  });
