import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, inArray, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { mergeContent } from "./ai";
import { randomUUID } from "crypto";
import { FREE_LIMITS, hasPremiumAccess } from "../config/limits";
import { logMergeImage } from "../services/mergeImageLogger";
import { runMergeImageStep } from "../services/mergeImage/runMergeImageStep";

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

type MergeGenerateBody = {
  inspirationIds: string[];
  outputType: string;
  context?: string;
  generateImage?: boolean;
  imagePrompt?: string;
  useReferences?: boolean;
  referenceMode?: "auto" | "manual";
  referenceInspirationIds?: string[];
};

type RegenerateImageBody = {
  remixId: string;
  imagePrompt?: string;
  useReferences?: boolean;
  referenceMode?: "auto" | "manual";
  referenceInspirationIds?: string[];
};

async function loadUserProfile(userId: string) {
  let profile = await db
    .select()
    .from(schema.userProfiles)
    .where(eq(schema.userProfiles.userId, userId))
    .get();

  const today = getTodayStr();
  if (profile && profile.lastResetDate !== today) {
    await db
      .update(schema.userProfiles)
      .set({ remixCount: 0, mergeCount: 0, trendCount: 0, lastResetDate: today })
      .where(eq(schema.userProfiles.userId, userId));
    profile = { ...profile, remixCount: 0, mergeCount: 0, trendCount: 0, lastResetDate: today };
  }

  return profile;
}

export const mergeRoute = new Hono()
  .post("/generate", requireAuth, async (c) => {
    const user = c.get("user")!;
    const body = (await c.req.json()) as MergeGenerateBody;
    const {
      inspirationIds,
      outputType,
      context,
      generateImage,
      imagePrompt,
      useReferences,
      referenceMode,
      referenceInspirationIds,
    } = body;

    logMergeImage("merge_generate_start", {
      userId: user.id,
      inspirationCount: inspirationIds?.length ?? 0,
      outputType,
      generateImage: !!generateImage,
    });

    if (!inspirationIds || inspirationIds.length < 2) {
      return c.json({ message: "At least 2 inspirations required" }, 400);
    }

    const profile = await loadUserProfile(user.id);

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

    if (!content?.trim()) {
      logMergeImage("merge_text_failed", { userId: user.id, message: "empty_content" }, "error");
      return c.json({ message: "Merge generation failed" }, 502);
    }

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

    logMergeImage("merge_text_ok", {
      userId: user.id,
      remixId: id,
      textLength: content.length,
    });

    let imageError: string | undefined;
    let updatedRemix = remix;

    if (generateImage) {
      const imageStep = await runMergeImageStep({
        userId: user.id,
        remixId: id,
        mergedText: content,
        outputType,
        sources: sources.map((s) => ({ id: s.id, ogImage: s.ogImage })),
        imagePrompt,
        useReferences,
        referenceMode,
        referenceInspirationIds,
      });

      if (imageStep.success && imageStep.imageUrl) {
        try {
          const [row] = await db
            .update(schema.remixes)
            .set({
              imageUrl: imageStep.imageUrl,
              imageModel: imageStep.imageModel ?? null,
              imagePrompt: imageStep.imagePrompt,
              imageMetaJson: imageStep.imageMetaJson,
            })
            .where(and(eq(schema.remixes.id, id), eq(schema.remixes.userId, user.id)))
            .returning();
          updatedRemix = row ?? updatedRemix;
          logMergeImage("merge_image_persist_ok", {
            remixId: id,
            storage: imageStep.imageUrl.startsWith("data:") ? "dataUrl" : "url",
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "persist failed";
          logMergeImage("merge_image_persist_failed", { remixId: id, message }, "error");
          imageError = message;
        }
      } else {
        imageError = imageStep.imageError ?? "Image generation failed";
        try {
          await db
            .update(schema.remixes)
            .set({
              imagePrompt: imageStep.imagePrompt,
              imageMetaJson: imageStep.imageMetaJson,
            })
            .where(and(eq(schema.remixes.id, id), eq(schema.remixes.userId, user.id)));
        } catch {
          /* non-fatal */
        }
      }
    } else {
      logMergeImage("merge_image_skipped", { userId: user.id, reason: "generateImage_false" });
    }

    if (profile) {
      await db
        .update(schema.userProfiles)
        .set({ mergeCount: (profile.mergeCount ?? 0) + 1 })
        .where(eq(schema.userProfiles.userId, user.id));
    }

    logMergeImage("merge_generate_done", {
      userId: user.id,
      remixId: id,
      hasText: true,
      hasImage: !!updatedRemix.imageUrl,
      imageError,
    });

    return c.json(
      {
        remix: updatedRemix,
        content,
        image: updatedRemix.imageUrl ?? null,
        imageError,
        partialSuccess: !!imageError && !!content,
      },
      201
    );
  })
  .post("/regenerate-image", requireAuth, async (c) => {
    const user = c.get("user")!;
    const body = (await c.req.json()) as RegenerateImageBody;
    const { remixId, imagePrompt, useReferences, referenceMode, referenceInspirationIds } = body;

    if (!remixId) return c.json({ message: "remixId required" }, 400);

    const remix = await db
      .select()
      .from(schema.remixes)
      .where(and(eq(schema.remixes.id, remixId), eq(schema.remixes.userId, user.id)))
      .get();

    if (!remix) return c.json({ message: "Remix not found" }, 404);

    let inspirationIds: string[] = [];
    try {
      inspirationIds = JSON.parse(remix.inspirationIds || "[]");
    } catch {
      inspirationIds = [];
    }

    const sources = inspirationIds.length
      ? await db
          .select()
          .from(schema.inspirations)
          .where(
            and(
              eq(schema.inspirations.userId, user.id),
              inArray(schema.inspirations.id, inspirationIds)
            )
          )
      : [];

    const outputType = remix.outputType.replace(/^merged_/, "");

    const imageStep = await runMergeImageStep({
      userId: user.id,
      remixId,
      mergedText: remix.outputContent,
      outputType,
      sources: sources.map((s) => ({ id: s.id, ogImage: s.ogImage })),
      imagePrompt,
      useReferences,
      referenceMode,
      referenceInspirationIds,
    });

    if (!imageStep.success || !imageStep.imageUrl) {
      await db
        .update(schema.remixes)
        .set({
          imagePrompt: imageStep.imagePrompt,
          imageMetaJson: imageStep.imageMetaJson,
        })
        .where(and(eq(schema.remixes.id, remixId), eq(schema.remixes.userId, user.id)));

      return c.json(
        {
          image: null,
          imageError: imageStep.imageError ?? "Image generation failed",
          partialSuccess: true,
        },
        200
      );
    }

    const [updated] = await db
      .update(schema.remixes)
      .set({
        imageUrl: imageStep.imageUrl,
        imageModel: imageStep.imageModel ?? null,
        imagePrompt: imageStep.imagePrompt,
        imageMetaJson: imageStep.imageMetaJson,
      })
      .where(and(eq(schema.remixes.id, remixId), eq(schema.remixes.userId, user.id)))
      .returning();

    logMergeImage("merge_image_persist_ok", { remixId, storage: "regenerate" });

    return c.json(
      {
        remix: updated,
        image: imageStep.imageUrl,
        imageError: null,
      },
      200
    );
  });
