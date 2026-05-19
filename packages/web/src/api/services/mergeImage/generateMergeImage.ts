import { logMergeImage, truncateBodyPreview } from "../mergeImageLogger";
import {
  MERGE_IMAGE_ASPECT_RATIO,
  MERGE_IMAGE_SIZE,
  OPENROUTER_IMAGE_BASE,
  pickImageModel,
} from "./mergeImageConfig";

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY ?? "";

export type GenerateMergeImageInput = {
  prompt: string;
  referenceUrls?: string[];
  aspectRatio?: string;
};

export type GenerateMergeImageSuccess = {
  ok: true;
  imageUrl: string;
  model: string;
  latencyMs: number;
  dataUrlLength: number;
};

export type GenerateMergeImageFailure = {
  ok: false;
  error: string;
  model: string;
  status?: number;
  bodyPreview?: string;
};

export type GenerateMergeImageResult = GenerateMergeImageSuccess | GenerateMergeImageFailure;

type OpenRouterImageBlock = {
  type: "image_url";
  image_url: { url: string };
};

type OpenRouterMessageContent =
  | string
  | Array<{ type: "text"; text: string } | OpenRouterImageBlock>;

function buildUserContent(prompt: string, referenceUrls: string[]): OpenRouterMessageContent {
  if (referenceUrls.length === 0) return prompt;

  const parts: Array<{ type: "text"; text: string } | OpenRouterImageBlock> = [
  { type: "text", text: prompt },
  ];

  for (const url of referenceUrls) {
    parts.push({ type: "image_url", image_url: { url } });
  }

  return parts;
}

function extractImageUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const choices = (data as { choices?: unknown[] }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const message = (choices[0] as { message?: { images?: unknown[] } })?.message;
  const images = message?.images;
  if (!Array.isArray(images) || images.length === 0) return null;

  const first = images[0] as {
    image_url?: { url?: string };
    imageUrl?: { url?: string };
  };

  return first.image_url?.url ?? first.imageUrl?.url ?? null;
}

export async function generateMergeImage(
  input: GenerateMergeImageInput
): Promise<GenerateMergeImageResult> {
  if (!OPENROUTER_KEY) {
    logMergeImage("openrouter_image_request_failed", { message: "OPENROUTER_API_KEY not set" }, "error");
    return { ok: false, error: "Image generation is not configured", model: "" };
  }

  const referenceUrls = input.referenceUrls ?? [];
  const model = pickImageModel(referenceUrls.length > 0);
  const aspectRatio = input.aspectRatio ?? MERGE_IMAGE_ASPECT_RATIO;
  const started = Date.now();

  logMergeImage("openrouter_image_request_start", {
    model,
    modalities: ["image", "text"],
    refCount: referenceUrls.length,
    aspectRatio,
    imageSize: MERGE_IMAGE_SIZE,
  });

  try {
    const res = await fetch(`${OPENROUTER_IMAGE_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.WEBSITE_URL ?? "https://contentbrain.app",
        "X-Title": "ContentBrain",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: buildUserContent(input.prompt, referenceUrls),
          },
        ],
        modalities: ["image", "text"],
        image_config: {
          aspect_ratio: aspectRatio,
          image_size: MERGE_IMAGE_SIZE,
        },
      }),
    });

    const bodyText = await res.text();
    const latencyMs = Date.now() - started;

    if (!res.ok) {
      const bodyPreview = truncateBodyPreview(bodyText);
      logMergeImage(
        "openrouter_image_request_failed",
        { model, status: res.status, bodyPreview },
        "error"
      );
      return {
        ok: false,
        error: `OpenRouter image HTTP ${res.status}`,
        model,
        status: res.status,
        bodyPreview,
      };
    }

    let data: unknown;
    try {
      data = JSON.parse(bodyText);
    } catch {
      logMergeImage(
        "openrouter_image_request_failed",
        { model, message: "non-JSON response", bodyPreview: truncateBodyPreview(bodyText) },
        "error"
      );
      return { ok: false, error: "OpenRouter returned non-JSON response", model };
    }

    const imageUrl = extractImageUrl(data);
    if (!imageUrl) {
      logMergeImage(
        "openrouter_image_empty_response",
        { model, bodyPreview: truncateBodyPreview(bodyText) },
        "warn"
      );
      return { ok: false, error: "No image in OpenRouter response", model, bodyPreview: truncateBodyPreview(bodyText) };
    }

    logMergeImage("openrouter_image_request_ok", {
      model,
      latencyMs,
      imageCount: 1,
      dataUrlLength: imageUrl.length,
    });

    return {
      ok: true,
      imageUrl,
      model,
      latencyMs,
      dataUrlLength: imageUrl.length,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "network error";
    logMergeImage("openrouter_image_request_failed", { model, message }, "error");
    return { ok: false, error: message, model };
  }
}

export function buildDefaultImagePrompt(mergedText: string, outputType: string): string {
  const excerpt = mergedText.trim().slice(0, 600);
  return `Create a single striking social cover image for merged ${outputType} content.

Visual direction: modern, clean, high contrast, suitable for social feeds. No watermarks or logos unless described in the content.

Content to visualize:
${excerpt}`;
}
