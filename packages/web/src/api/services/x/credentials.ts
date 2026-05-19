import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { db } from "../../database";
import * as schema from "../../database/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { logXContext } from "./logger";
import {
  refreshXaiOAuthAccessToken,
  xaiAccessTokenNeedsRefresh,
} from "./xaiOAuthRefresh";

const ALGO = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const raw =
    process.env.CREDENTIALS_ENCRYPTION_KEY ??
    process.env.BETTER_AUTH_SECRET ??
    "contentbrain-dev-key";
  return createHash("sha256").update(raw).digest();
}

function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

function decrypt(payload: string): string {
  const key = getEncryptionKey();
  const [ivB64, tagB64, dataB64] = payload.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

async function refreshStoredCredentials(
  userId: string,
  refreshTokenEncrypted: string
): Promise<{ accessToken: string; expiresAt?: Date } | null> {
  try {
    const refreshToken = decrypt(refreshTokenEncrypted);
    const refreshed = await refreshXaiOAuthAccessToken(refreshToken);
    await saveUserXaiCredentials(
      userId,
      refreshed.accessToken,
      refreshed.refreshToken,
      refreshed.expiresAt
    );
    return { accessToken: refreshed.accessToken, expiresAt: refreshed.expiresAt };
  } catch (err) {
    logXContext(
      "grok_token_refresh_failed",
      { userId, error: err instanceof Error ? err.message : "refresh failed" },
      "error"
    );
    return null;
  }
}

export async function getUserXaiAccessToken(userId: string): Promise<string | null> {
  const row = await db
    .select()
    .from(schema.userXaiCredentials)
    .where(eq(schema.userXaiCredentials.userId, userId))
    .get();

  if (!row) {
    logXContext("grok_token_missing", { userId }, "warn");
    return null;
  }

  const hasRefresh = !!row.refreshTokenEncrypted;

  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    logXContext("grok_token_expired", { userId, expiresAt: row.expiresAt.toISOString() }, "warn");
    if (hasRefresh) {
      const refreshed = await refreshStoredCredentials(userId, row.refreshTokenEncrypted!);
      if (refreshed) return refreshed.accessToken;
    }
    return null;
  }

  if (hasRefresh && xaiAccessTokenNeedsRefresh(row.expiresAt ?? undefined)) {
    const refreshed = await refreshStoredCredentials(userId, row.refreshTokenEncrypted!);
    if (refreshed) return refreshed.accessToken;
  }

  try {
    const token = decrypt(row.accessTokenEncrypted);
    logXContext("grok_token_loaded", {
      userId,
      tokenLen: token.length,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      hasRefresh,
    });
    return token;
  } catch (err) {
    logXContext(
      "grok_token_decrypt_failed",
      { userId, error: err instanceof Error ? err.message : "decrypt failed" },
      "error"
    );
    return null;
  }
}

/** Refresh Grok OAuth and return a new access token (e.g. after xAI 403 bad-credentials). */
export async function refreshUserXaiAccessToken(userId: string): Promise<string | null> {
  const row = await db
    .select()
    .from(schema.userXaiCredentials)
    .where(eq(schema.userXaiCredentials.userId, userId))
    .get();

  if (!row?.refreshTokenEncrypted) {
    logXContext("grok_refresh_skipped_no_refresh_token", { userId }, "warn");
    return null;
  }

  const refreshed = await refreshStoredCredentials(userId, row.refreshTokenEncrypted);
  return refreshed?.accessToken ?? null;
}

export async function saveUserXaiCredentials(
  userId: string,
  accessToken: string,
  refreshToken?: string,
  expiresAt?: Date
): Promise<void> {
  const existing = await db
    .select()
    .from(schema.userXaiCredentials)
    .where(eq(schema.userXaiCredentials.userId, userId))
    .get();

  const values = {
    accessTokenEncrypted: encrypt(accessToken),
    refreshTokenEncrypted: refreshToken ? encrypt(refreshToken) : null,
    expiresAt: expiresAt ?? null,
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(schema.userXaiCredentials)
      .set(values)
      .where(eq(schema.userXaiCredentials.userId, userId));
  } else {
    await db.insert(schema.userXaiCredentials).values({
      id: randomUUID(),
      userId,
      ...values,
    });
  }
}

export async function deleteUserXaiCredentials(userId: string): Promise<void> {
  await db
    .delete(schema.userXaiCredentials)
    .where(eq(schema.userXaiCredentials.userId, userId));
}

export async function hasUserXaiCredentials(userId: string): Promise<boolean> {
  const token = await getUserXaiAccessToken(userId);
  return !!token;
}
