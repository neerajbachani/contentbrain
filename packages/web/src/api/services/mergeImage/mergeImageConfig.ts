/** OpenRouter image generation defaults (override via env). */
export const OPENROUTER_IMAGE_BASE = "https://openrouter.ai/api/v1";

/** Text-to-image when no reference images are used. */
export const OPENROUTER_IMAGE_MODEL_TEXT =
  process.env.OPENROUTER_IMAGE_MODEL ?? "google/gemini-2.5-flash-image";

/** Image-conditioned generation when inspirations supply ogImage refs. */
export const OPENROUTER_IMAGE_MODEL_REFS =
  process.env.OPENROUTER_IMAGE_MODEL_WITH_REFS ?? OPENROUTER_IMAGE_MODEL_TEXT;

export const MERGE_IMAGE_MAX_REFS = Math.min(
  10,
  Math.max(1, parseInt(process.env.MERGE_IMAGE_MAX_REFS ?? "5", 10))
);

export const MERGE_IMAGE_ASPECT_RATIO =
  process.env.MERGE_IMAGE_ASPECT_RATIO ?? "16:9";

export const MERGE_IMAGE_SIZE = process.env.MERGE_IMAGE_SIZE ?? "1K";

export function pickImageModel(hasReferences: boolean): string {
  return hasReferences ? OPENROUTER_IMAGE_MODEL_REFS : OPENROUTER_IMAGE_MODEL_TEXT;
}
