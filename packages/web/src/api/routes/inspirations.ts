import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { processInspiration } from "./ai";
import { randomUUID } from "crypto";
import { fetchRedditContext } from "../services/context/redditContext";
import { fetchAIContext } from "../services/context/aiContext";
import { resolveXContext, enrichXRawContent } from "../services/x/resolveXContext";
import { getOrCreateUserProfile } from "../services/x/userProfile";
import { isXPlatform } from "../services/x/xUrl";
import type { XDataSource } from "../services/x/types";
import { logXContext } from "../services/x/logger";
import { FREE_LIMITS, hasPremiumAccess } from "../config/limits";
import { getLinkPreview } from "../services/linkPreview/ogScraper";

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
    let { rawContent, sourceUrl, sourcePlatform, type, title, ogImage } = body;

    if (!rawContent) return c.json({ message: "rawContent required" }, 400);

    // Auto-fetch OG image for X/Twitter URLs when client didn't provide one
    if (!ogImage && sourceUrl && typeof sourceUrl === "string" &&
        isXPlatform(sourcePlatform ?? "", sourceUrl)) {
      try {
        const preview = await getLinkPreview(sourceUrl);
        if (preview.imageUrl) ogImage = preview.imageUrl;
        if (!title && preview.title) title = preview.title;
      } catch { /* non-fatal */ }
    }

    const existing = await db
      .select()
      .from(schema.inspirations)
      .where(eq(schema.inspirations.userId, user.id));

    const profile = await getOrCreateUserProfile(user.id);

    if (!hasPremiumAccess(profile.plan) && existing.length >= FREE_LIMITS.maxInspirations) {
      return c.json(
        {
          message: `Free limit reached (${FREE_LIMITS.maxInspirations} inspirations). Upgrade to Premium.`,
          limitReached: true,
        },
        403
      );
    }

    const isX = isXPlatform(sourcePlatform ?? "", sourceUrl);
    if (
      hasPremiumAccess(profile.plan) &&
      isX &&
      sourceUrl &&
      typeof sourceUrl === "string"
    ) {
      try {
        rawContent = await enrichXRawContent(
          user.id,
          profile.xDataSource as XDataSource,
          sourceUrl,
          rawContent
        );
      } catch (err) {
        console.error("[inspirations] X enrich failed:", err);
      }
    }

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
  })
  .get("/:id/context", requireAuth, async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.param();

    try {
      const item = await db
        .select()
        .from(schema.inspirations)
        .where(and(eq(schema.inspirations.id, id), eq(schema.inspirations.userId, user.id)))
        .get();

      if (!item) return c.json({ message: "Not found" }, 404);

      const profile = await getOrCreateUserProfile(user.id);
      const platform = item.sourcePlatform?.toLowerCase() ?? "";
      const isReddit = platform === "reddit" || (item.sourceUrl ?? "").includes("reddit.com");
      const isX = isXPlatform(platform, item.sourceUrl);

      if (isReddit && item.sourceUrl) {
        const result = await fetchRedditContext(item.sourceUrl);
        if (result) {
          return c.json({
            mode: "reddit" as const,
            comments: result.comments,
            relatedPosts: result.relatedPosts,
          }, 200);
        }
      }

      const includeDebug = process.env.NODE_ENV !== "production";

      if (isX && !hasPremiumAccess(profile.plan)) {
        logXContext("resolve_premium_blocked", { userId: user.id, inspirationId: id }, "warn");
        let keyIdeas: string[] = [];
        let tags: string[] = [];
        try { keyIdeas = JSON.parse(item.keyIdeas || "[]"); } catch {}
        try { tags = JSON.parse(item.tags || "[]"); } catch {}
        const result = await fetchAIContext(item.rawContent, keyIdeas, tags, "x");
        return c.json({
          mode: "x" as const,
          comments: result.comments,
          relatedPosts: result.relatedPosts,
          debug: {
            attempted: [],
            errors: ["ContentBrain premium required for live X context"],
            fallbackReason: "premium_required",
          },
        }, 200);
      }

      if (isX && hasPremiumAccess(profile.plan)) {
        let keyIdeas: string[] = [];
        let tags: string[] = [];
        try { keyIdeas = JSON.parse(item.keyIdeas || "[]"); } catch {}
        try { tags = JSON.parse(item.tags || "[]"); } catch {}

        const result = await resolveXContext({
          userId: user.id,
          xDataSource: profile.xDataSource as XDataSource,
          rawContent: item.rawContent,
          sourceUrl: item.sourceUrl,
          keyIdeas,
          tags,
          intent: "context",
          inspirationId: item.id,
          plan: hasPremiumAccess(profile.plan) ? "premium" : profile.plan,
        });

        return c.json({
          mode: result.mode,
          comments: result.comments,
          relatedPosts: result.relatedPosts,
          ...(includeDebug && result.meta ? { debug: result.meta } : {}),
        }, 200);
      }

      let keyIdeas: string[] = [];
      let tags: string[] = [];
      try { keyIdeas = JSON.parse(item.keyIdeas || "[]"); } catch {}
      try { tags = JSON.parse(item.tags || "[]"); } catch {}
      const result = await fetchAIContext(item.rawContent, keyIdeas, tags, "generic");

      return c.json({
        mode: "ai" as const,
        comments: result.comments,
        relatedPosts: result.relatedPosts,
      }, 200);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Context failed";
      console.error("[inspirations] GET /:id/context error:", err);
      return c.json({ message, error: message }, 500);
    }
  });
