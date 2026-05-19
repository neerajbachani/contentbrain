import { logXaiOutputStructure, parseXaiResponsesPayload } from "./parseXResponse";
import type { XContextIntent } from "./types";
import { parseXStatusUrl } from "./xUrl";
import { logXContext } from "./logger";
import { isXaiBadCredentialsError } from "./xaiOAuthRefresh";
import { refreshUserXaiAccessToken } from "./credentials";

const XAI_BASE = process.env.XAI_BASE_URL ?? "https://api.x.ai/v1";
const XAI_MODEL = process.env.XAI_MODEL ?? "grok-4.1-fast";

export type XaiSearchError = {
  status?: number;
  message: string;
  bodyPreview?: string;
};

function buildPrompt(input: {
  intent: XContextIntent;
  rawContent: string;
  sourceUrl?: string | null;
  keyIdeas?: string[];
  tags?: string[];
  nicheKeywords?: string[];
}): string {
  const ideas = input.keyIdeas?.length ? input.keyIdeas.join(", ") : "";
  const tags = input.tags?.length ? input.tags.join(", ") : "";
  const parsed = input.sourceUrl ? parseXStatusUrl(input.sourceUrl) : null;

  if (input.intent === "enrich" && input.sourceUrl) {
    return `Use x_search to fetch the full X post and top replies for this URL: ${input.sourceUrl}. Return the main post text and 3-8 substantive reply summaries with post URLs when available.`;
  }

  if (input.intent === "research") {
    const kw = input.nicheKeywords?.slice(0, 3).join(" ") ?? tags ?? ideas;
    return `Use x_search to find the latest X posts (last 7 days) about: ${kw}. Related to: "${input.rawContent.slice(0, 200)}". Return 5-8 posts with URLs.`;
  }

  const threadHint = parsed
    ? ` Also search discussion around tweet id ${parsed.tweetId}.`
    : "";

  return `Use x_search to find what people on X are saying about this topic.${threadHint}

Post: "${input.rawContent.slice(0, 500)}"
Key ideas: ${ideas}
Tags: ${tags}

Return real reply-style summaries and cite X post URLs. Focus on diverse perspectives (support, pushback, questions).`;
}

async function callXaiResponses(
  accessToken: string,
  prompt: string,
  intent: XContextIntent
): Promise<{ ok: true; data: unknown } | { ok: false; error: XaiSearchError }> {
  logXContext("xai_request_start", {
    model: XAI_MODEL,
    intent,
    tokenPreview: accessToken.slice(0, 12),
  });

  const res = await fetch(`${XAI_BASE}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: XAI_MODEL,
      input: [{ role: "user", content: prompt }],
      tools: [{ type: "x_search" }],
      store: false,
    }),
  });

  const bodyText = await res.text();

  if (!res.ok) {
    let errorCode: string | undefined;
    try {
      const errJson = JSON.parse(bodyText) as { error?: { code?: string; message?: string } };
      errorCode = errJson.error?.code;
    } catch {
      /* non-json */
    }
    const err: XaiSearchError = {
      status: res.status,
      message: `xAI HTTP ${res.status}${errorCode ? ` (${errorCode})` : ""}`,
      bodyPreview: bodyText.slice(0, 400),
    };
    logXContext(
      "xai_request_failed",
      { ...err, xai_error_code: errorCode } as Record<string, unknown>,
      "error"
    );
    return { ok: false, error: err };
  }

  try {
    return { ok: true, data: JSON.parse(bodyText) };
  } catch {
    const err: XaiSearchError = {
      message: "xAI returned non-JSON response",
      bodyPreview: bodyText.slice(0, 200),
    };
    logXContext("xai_parse_json_failed", err as Record<string, unknown>, "error");
    return { ok: false, error: err };
  }
}

export async function fetchXaiSearchContext(
  accessToken: string,
  input: {
    intent: XContextIntent;
    rawContent: string;
    sourceUrl?: string | null;
    keyIdeas?: string[];
    tags?: string[];
    nicheKeywords?: string[];
    userId?: string;
  }
): Promise<{
  result: {
    comments: import("../context/redditContext").ContextComment[];
    relatedPosts: import("../context/redditContext").ContextPost[];
  } | null;
  error?: XaiSearchError;
}> {
  const prompt = buildPrompt(input);
  let token = accessToken;

  try {
    let response = await callXaiResponses(token, prompt, input.intent);

    if (
      !response.ok &&
      response.error.status === 403 &&
      isXaiBadCredentialsError(response.error.bodyPreview) &&
      input.userId
    ) {
      logXContext("xai_retry_after_refresh", { userId: input.userId }, "warn");
      const newToken = await refreshUserXaiAccessToken(input.userId);
      if (newToken) {
        token = newToken;
        response = await callXaiResponses(token, prompt, input.intent);
      }
    }

    if (!response.ok) {
      const hint = isXaiBadCredentialsError(response.error.bodyPreview)
        ? " — paste full ~/.hermes/auth.json (with refresh_token) or re-run: hermes auth add xai-oauth"
        : "";
      return {
        result: null,
        error: { ...response.error, message: response.error.message + hint },
      };
    }

    const data = response.data;
    const parsed = parseXaiResponsesPayload(data);

    if (parsed.comments.length === 0 && parsed.relatedPosts.length === 0) {
      logXaiOutputStructure(data);
      const err: XaiSearchError = {
        message: "xAI OK but no parseable text/citations in response",
        bodyPreview: JSON.stringify(data).slice(0, 300),
      };
      logXContext("xai_empty_parse", err as Record<string, unknown>, "warn");
      return { result: null, error: err };
    }

    logXContext("xai_request_ok", {
      comments: parsed.comments.length,
      posts: parsed.relatedPosts.length,
    });

    return { result: parsed };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "xAI network error";
    const error: XaiSearchError = { message };
    logXContext("xai_request_exception", error as Record<string, unknown>, "error");
    return { result: null, error };
  }
}

/** Lightweight x_search probe for connect-time validation. */
export async function probeXaiToken(accessToken: string): Promise<{
  ok: boolean;
  error?: string;
  status?: number;
}> {
  logXContext("grok_connect_probe_start", {
    model: XAI_MODEL,
    tokenPreview: accessToken.slice(0, 12),
  });

  try {
    const res = await fetch(`${XAI_BASE}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: XAI_MODEL,
        input: [
          {
            role: "user",
            content: "Use x_search to find one recent post about technology. Reply with one sentence and a URL.",
          },
        ],
        tools: [{ type: "x_search" }],
        store: false,
      }),
    });

    const bodyText = await res.text();

    if (!res.ok) {
      let message = `xAI HTTP ${res.status}`;
      try {
        const errJson = JSON.parse(bodyText) as { error?: { code?: string; message?: string } };
        if (errJson.error?.message) message = errJson.error.message;
        if (errJson.error?.code) message = `${message} (${errJson.error.code})`;
      } catch {
        if (bodyText) message = bodyText.slice(0, 200);
      }
      logXContext(
        "grok_connect_probe_failed",
        { status: res.status, message, bodyPreview: bodyText.slice(0, 200) },
        "error"
      );
      return { ok: false, error: message, status: res.status };
    }

    let data: unknown;
    try {
      data = JSON.parse(bodyText);
    } catch {
      logXContext("grok_connect_probe_failed", { message: "non-JSON response" }, "error");
      return { ok: false, error: "xAI returned non-JSON response" };
    }

    const parsed = parseXaiResponsesPayload(data);
    if (parsed.comments.length === 0 && parsed.relatedPosts.length === 0) {
      logXaiOutputStructure(data);
      logXContext("grok_connect_probe_failed", { message: "empty parse" }, "warn");
      return {
        ok: false,
        error: "xAI responded but x_search results could not be parsed — check XAI_MODEL",
      };
    }

    logXContext("grok_connect_probe_ok", {
      comments: parsed.comments.length,
      posts: parsed.relatedPosts.length,
    });
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "network error";
    logXContext("grok_connect_probe_failed", { message }, "error");
    return { ok: false, error: message };
  }
}
