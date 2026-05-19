import { logXContext } from "./logger";

const XAI_OAUTH_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
const XAI_OAUTH_DISCOVERY_URL = "https://auth.x.ai/.well-known/openid-configuration";
const REFRESH_SKEW_MS = 120_000;

let cachedTokenEndpoint: string | null = null;

async function getTokenEndpoint(): Promise<string> {
  if (cachedTokenEndpoint) return cachedTokenEndpoint;

  const res = await fetch(XAI_OAUTH_DISCOVERY_URL, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`xAI OAuth discovery failed: HTTP ${res.status}`);
  }

  const data = (await res.json()) as { token_endpoint?: string };
  const endpoint = data.token_endpoint?.trim();
  if (!endpoint || !endpoint.includes("x.ai")) {
    throw new Error("xAI OAuth discovery missing token_endpoint");
  }

  cachedTokenEndpoint = endpoint;
  return endpoint;
}

export async function refreshXaiOAuthAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt?: Date;
}> {
  const tokenEndpoint = await getTokenEndpoint();

  logXContext("grok_token_refresh_start", {});

  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: XAI_OAUTH_CLIENT_ID,
      refresh_token: refreshToken,
    }),
  });

  const bodyText = await res.text();

  if (!res.ok) {
    logXContext(
      "grok_token_refresh_failed",
      { status: res.status, preview: bodyText.slice(0, 200) },
      "error"
    );
    throw new Error(
      `Grok token refresh failed (HTTP ${res.status}). Re-run: hermes auth add xai-oauth`
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    throw new Error("Grok token refresh returned invalid JSON");
  }

  const accessToken = String(payload.access_token ?? "").trim();
  if (!accessToken) {
    throw new Error("Grok token refresh missing access_token");
  }

  const newRefresh = String(payload.refresh_token ?? refreshToken).trim();
  let expiresAt: Date | undefined;
  const expiresIn = payload.expires_in;
  if (typeof expiresIn === "number" && expiresIn > 0) {
    expiresAt = new Date(Date.now() + expiresIn * 1000);
  }

  logXContext("grok_token_refresh_ok", {
    expiresAt: expiresAt?.toISOString() ?? null,
    tokenLen: accessToken.length,
  });

  return { accessToken, refreshToken: newRefresh, expiresAt };
}

export function xaiAccessTokenNeedsRefresh(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() - Date.now() < REFRESH_SKEW_MS;
}

export function isXaiBadCredentialsError(bodyPreview?: string): boolean {
  if (!bodyPreview) return false;
  const lower = bodyPreview.toLowerCase();
  return (
    lower.includes("bad-credentials") ||
    lower.includes("could not be validated") ||
    lower.includes("unauthenticated")
  );
}
