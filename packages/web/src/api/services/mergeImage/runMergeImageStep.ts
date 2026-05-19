import { logMergeImage } from "../mergeImageLogger";
import {
  buildDefaultImagePrompt,
  generateMergeImage,
  type GenerateMergeImageResult,
} from "./generateMergeImage";
import { resolveMergeImageRefs } from "./resolveMergeImageRefs";
import type { InspirationForRefs } from "./resolveMergeImageRefs";

export type MergeImageStepInput = {
  userId: string;
  remixId: string;
  mergedText: string;
  outputType: string;
  sources: InspirationForRefs[];
  imagePrompt?: string;
  useReferences?: boolean;
  referenceMode?: "auto" | "manual";
  referenceInspirationIds?: string[];
};

export type MergeImageStepResult = {
  imageUrl?: string;
  imageModel?: string;
  imagePrompt: string;
  imageMetaJson: string;
  imageError?: string;
  success: boolean;
  latencyMs?: number;
};

export async function runMergeImageStep(
  input: MergeImageStepInput
): Promise<MergeImageStepResult> {
  const imageStarted = Date.now();
  const referenceMode = input.referenceMode ?? "auto";
  const prompt =
    input.imagePrompt?.trim() ||
    buildDefaultImagePrompt(input.mergedText, input.outputType);

  logMergeImage("merge_image_start", {
    userId: input.userId,
    remixId: input.remixId,
    referenceMode,
    useReferences: input.useReferences !== false,
  });

  const { urls, skipped } = resolveMergeImageRefs({
    sources: input.sources,
    referenceMode,
    referenceInspirationIds: input.referenceInspirationIds,
    useReferences: input.useReferences,
  });

  if (input.useReferences !== false && urls.length === 0 && input.sources.length > 0) {
    logMergeImage(
      "merge_image_refs_empty",
      {
        inspirationIds: input.sources.map((s) => s.id),
        reason: "no_og_image",
        skipped,
      },
      "warn"
    );
  }

  const genResult: GenerateMergeImageResult = await generateMergeImage({
    prompt,
    referenceUrls: urls,
  });

  const latencyMs = Date.now() - imageStarted;

  if (!genResult.ok) {
    const imageMetaJson = JSON.stringify({
      lastError: genResult.error,
      lastErrorAt: new Date().toISOString(),
      referenceCount: urls.length,
      status: genResult.status,
    });

    logMergeImage("merge_image_done", {
      remixId: input.remixId,
      success: false,
      latencyMs,
      partialSuccess: true,
    });

    return {
      imagePrompt: prompt,
      imageMetaJson,
      imageError: genResult.error,
      success: false,
      latencyMs,
    };
  }

  const imageMetaJson = JSON.stringify({
    latencyMs: genResult.latencyMs,
    dataUrlLength: genResult.dataUrlLength,
    referenceCount: urls.length,
    referenceHostnames: urls.map((u) => {
      try {
        return new URL(u).hostname;
      } catch {
        return null;
      }
    }).filter(Boolean),
    generatedAt: new Date().toISOString(),
  });

  logMergeImage("merge_image_done", {
    remixId: input.remixId,
    success: true,
    latencyMs,
    partialSuccess: false,
  });

  return {
    imageUrl: genResult.imageUrl,
    imageModel: genResult.model,
    imagePrompt: prompt,
    imageMetaJson,
    success: true,
    latencyMs,
  };
}
