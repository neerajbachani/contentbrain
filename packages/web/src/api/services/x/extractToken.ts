/**
 * Accepts a raw pasted access token OR a full ~/.hermes/auth.json blob.
 */
export type ExtractedXaiCredentials = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
};

export function extractXaiAccessTokenFromPaste(input: string): {
  token: string | null;
  refreshToken?: string;
  expiresAt?: Date;
  error?: string;
} {
  const trimmed = input.trim().replace(/^Bearer\s+/i, "");

  if (!trimmed) {
    return { token: null, error: "Empty token" };
  }

  if (!trimmed.startsWith("{")) {
    if (trimmed.length < 20) {
      return { token: null, error: "Token too short — paste full auth.json from Hermes" };
    }
    return {
      token: trimmed,
      error:
        "Raw access_token only — paste full ~/.hermes/auth.json so refresh_token is saved (tokens expire in ~1h).",
    };
  }

  const creds = extractXaiCredentialsFromPaste(input);
  if (!creds) {
    return {
      token: null,
      error: "No access_token found in JSON — search for xai-oauth in auth.json",
    };
  }

  if (!creds.refreshToken) {
    return {
      token: creds.accessToken,
      refreshToken: undefined,
      expiresAt: creds.expiresAt,
      error:
        "No refresh_token in JSON — x_search will stop working when access_token expires. Paste full auth.json from Hermes.",
    };
  }

  return {
    token: creds.accessToken,
    refreshToken: creds.refreshToken,
    expiresAt: creds.expiresAt,
  };
}

export function extractXaiCredentialsFromPaste(input: string): ExtractedXaiCredentials | null {
  const trimmed = input.trim().replace(/^Bearer\s+/i, "");

  if (!trimmed) return null;

  if (!trimmed.startsWith("{")) {
    if (trimmed.length < 20) return null;
    return { accessToken: trimmed };
  }

  try {
    const data = JSON.parse(trimmed);
    return findCredentialsInObject(data);
  } catch {
    return null;
  }
}

function parseExpiresAt(record: Record<string, unknown>): Date | undefined {
  if (typeof record.expires_at === "string") {
    const d = new Date(record.expires_at);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (typeof record.expiresAt === "number" && record.expiresAt > 0) {
    return new Date(record.expiresAt);
  }
  if (typeof record.expires_in === "number" && record.expires_in > 0) {
    const obtained =
      typeof record.obtained_at === "string"
        ? new Date(record.obtained_at).getTime()
        : Date.now();
    return new Date(obtained + record.expires_in * 1000);
  }
  return undefined;
}

function findCredentialsInObject(obj: unknown): ExtractedXaiCredentials | null {
  if (!obj || typeof obj !== "object") return null;

  const record = obj as Record<string, unknown>;

  for (const key of ["xai-oauth", "xai_oauth", "xai-oauth-default"]) {
    const provider = record[key];
    if (provider && typeof provider === "object") {
      const fromProvider = extractFromProviderBlock(provider as Record<string, unknown>);
      if (fromProvider) return fromProvider;
    }
  }

  const providers = record.providers;
  if (providers && typeof providers === "object") {
    const p = providers as Record<string, unknown>;
    for (const key of Object.keys(p)) {
      if (!key.includes("xai")) continue;
      const entry = p[key];
      if (entry && typeof entry === "object") {
        const fromProvider = extractFromProviderBlock(entry as Record<string, unknown>);
        if (fromProvider) return fromProvider;
      }
    }
  }

  if (Array.isArray(record.credentials)) {
    for (const item of record.credentials) {
      const found = findCredentialsInObject(item);
      if (found) return found;
    }
  }

  const access = record.access_token;
  if (typeof access === "string" && access.length > 20) {
    return {
      accessToken: access,
      refreshToken:
        typeof record.refresh_token === "string" ? record.refresh_token : undefined,
      expiresAt: parseExpiresAt(record),
    };
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === "object") {
      const found = findCredentialsInObject(value);
      if (found) return found;
    }
  }

  return null;
}

function extractFromProviderBlock(
  block: Record<string, unknown>
): ExtractedXaiCredentials | null {
  const tokens = block.tokens;
  if (tokens && typeof tokens === "object") {
    const fromTokens = extractFromTokenRecord(tokens as Record<string, unknown>);
    if (fromTokens) return fromTokens;
  }

  if (typeof block.access_token === "string" && block.access_token.length > 20) {
    return {
      accessToken: block.access_token,
      refreshToken:
        typeof block.refresh_token === "string" ? block.refresh_token : undefined,
      expiresAt: parseExpiresAt(block),
    };
  }

  return null;
}

function extractFromTokenRecord(
  record: Record<string, unknown>
): ExtractedXaiCredentials | null {
  const access = record.access_token;
  if (typeof access !== "string" || access.length < 20) return null;

  return {
    accessToken: access,
    refreshToken:
      typeof record.refresh_token === "string" ? record.refresh_token : undefined,
    expiresAt: parseExpiresAt(record),
  };
}
