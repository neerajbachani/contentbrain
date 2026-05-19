import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { requireAuth } from "../middleware/auth";
import { resolveXContext } from "../services/x/resolveXContext";
import { getOrCreateUserProfile } from "../services/x/userProfile";
import { NICHE_KEYWORDS } from "../services/nicheData";
import { isXPlatform } from "../services/x/xUrl";
import { getXContextDailyRemaining } from "../services/x/rateLimit";
import { hasPremiumAccess } from "../config/limits";

export const xRoute = new Hono()
  .post("/research", requireAuth, async (c) => {
    const user = c.get("user")!;
    const body = await c.req.json();
    const inspirationId = body.inspirationId as string | undefined;

    if (!inspirationId) {
      return c.json({ message: "inspirationId required" }, 400);
    }

    const profile = await getOrCreateUserProfile(user.id);
    if (!hasPremiumAccess(profile.plan)) {
      return c.json({ message: "Research on X is a Premium feature", premiumRequired: true }, 403);
    }

    const item = await db
      .select()
      .from(schema.inspirations)
      .where(and(eq(schema.inspirations.id, inspirationId), eq(schema.inspirations.userId, user.id)))
      .get();

    if (!item) return c.json({ message: "Not found" }, 404);

    let keyIdeas: string[] = [];
    let tags: string[] = [];
    let niches: string[] = [];
    try { keyIdeas = JSON.parse(item.keyIdeas || "[]"); } catch {}
    try { tags = JSON.parse(item.tags || "[]"); } catch {}
    try { niches = JSON.parse(profile.niche || "[]"); } catch {}

    const nicheKeywords = niches.flatMap((n) => NICHE_KEYWORDS[n.toLowerCase()] ?? []).slice(0, 4);

    const result = await resolveXContext({
      userId: user.id,
      xDataSource: profile.xDataSource as "auto" | "xai" | "apify",
      rawContent: item.rawContent,
      sourceUrl: item.sourceUrl,
      keyIdeas,
      tags,
      intent: "research",
      inspirationId: item.id,
      nicheKeywords,
      plan: hasPremiumAccess(profile.plan) ? "premium" : profile.plan,
    });

    return c.json({
      mode: result.mode,
      relatedPosts: result.relatedPosts,
      comments: result.comments,
      remainingToday: getXContextDailyRemaining(user.id),
    }, 200);
  });
