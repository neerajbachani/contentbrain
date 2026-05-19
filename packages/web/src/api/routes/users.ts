import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { randomUUID } from "crypto";
import { getOrCreateUserProfile, parseXDataSource } from "../services/x/userProfile";
import { hasUserXaiCredentials } from "../services/x/credentials";
import { getLimitsForClient, hasPremiumAccess } from "../config/limits";

export const usersRoute = new Hono()
  .get("/profile", requireAuth, async (c) => {
    const user = c.get("user")!;
    const profile = await getOrCreateUserProfile(user.id);
    const grokConnected = await hasUserXaiCredentials(user.id);

    return c.json({
      user: { id: user.id, name: user.name, email: user.email, image: user.image },
      profile,
      grokConnected,
      isPremium: hasPremiumAccess(profile.plan),
      limits: getLimitsForClient(profile.plan),
    }, 200);
  })
  .patch("/settings", requireAuth, async (c) => {
    const user = c.get("user")!;
    const body = await c.req.json();

    const updates: Record<string, string> = {};
    if (body.xDataSource !== undefined) {
      updates.xDataSource = parseXDataSource(body.xDataSource);
    }

    if (Object.keys(updates).length === 0) {
      return c.json({ message: "No valid fields to update" }, 400);
    }

    await getOrCreateUserProfile(user.id);
    const [profile] = await db
      .update(schema.userProfiles)
      .set(updates)
      .where(eq(schema.userProfiles.userId, user.id))
      .returning();

    return c.json({ profile }, 200);
  })
  .patch("/niche", requireAuth, async (c) => {
    const user = c.get("user")!;
    const { niche } = await c.req.json();

    if (!Array.isArray(niche)) return c.json({ message: "niche must be array" }, 400);

    let profile = await db
      .select()
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.userId, user.id))
      .get();

    const today = new Date().toISOString().slice(0, 10);

    if (!profile) {
      const id = randomUUID();
      [profile] = await db.insert(schema.userProfiles).values({
        id,
        userId: user.id,
        niche: JSON.stringify(niche),
        plan: "free",
        remixCount: 0,
        mergeCount: 0,
        trendCount: 0,
        lastResetDate: today,
      }).returning();
    } else {
      [profile] = await db
        .update(schema.userProfiles)
        .set({ niche: JSON.stringify(niche) })
        .where(eq(schema.userProfiles.userId, user.id))
        .returning();
    }

    return c.json({ profile }, 200);
  });
