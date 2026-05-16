import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { processInspiration } from "./ai";
import { randomUUID } from "crypto";

export const inspirationsRoute = new Hono()
  .get("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const items = await db
      .select()
      .from(schema.inspirations)
      .where(eq(schema.inspirations.userId, user.id))
      .orderBy(schema.inspirations.createdAt);
    return c.json({ inspirations: items.reverse() }, 200);
  })
  .post("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const body = await c.req.json();
    const { rawContent, sourceUrl, sourcePlatform, type, title, ogImage } = body;

    if (!rawContent) return c.json({ message: "rawContent required" }, 400);

    // Check free tier limit
    const existing = await db
      .select()
      .from(schema.inspirations)
      .where(eq(schema.inspirations.userId, user.id));

    const profile = await db
      .select()
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.userId, user.id))
      .get();

    if (profile?.plan === "free" && existing.length >= 5) {
      return c.json({ message: "Free limit reached. Upgrade to Premium.", limitReached: true }, 403);
    }

    // AI processing
    let aiData: any = {};
    try {
      aiData = await processInspiration(rawContent, sourceUrl);
    } catch { /* use defaults */ }

    const id = randomUUID();
    const [item] = await db.insert(schema.inspirations).values({
      id,
      userId: user.id,
      type: aiData.content_type ?? type ?? "text",
      sourcePlatform: sourcePlatform ?? "custom",
      sourceUrl: sourceUrl ?? null,
      rawContent,
      ogImage: ogImage ?? null,
      title: title ?? aiData.summary?.slice(0, 100) ?? null,
      tags: JSON.stringify(aiData.tags ?? []),
      summary: aiData.summary ?? null,
      writingStyle: aiData.writing_style ?? null,
      keyIdeas: JSON.stringify(aiData.key_ideas ?? []),
      hook: aiData.hook ?? null,
    }).returning();

    return c.json({ inspiration: item }, 201);
  })
  .delete("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.param();
    await db
      .delete(schema.inspirations)
      .where(and(eq(schema.inspirations.id, id), eq(schema.inspirations.userId, user.id)));
    return c.json({ success: true }, 200);
  })
  .get("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.param();
    const item = await db
      .select()
      .from(schema.inspirations)
      .where(and(eq(schema.inspirations.id, id), eq(schema.inspirations.userId, user.id)))
      .get();
    if (!item) return c.json({ message: "Not found" }, 404);
    return c.json({ inspiration: item }, 200);
  });
