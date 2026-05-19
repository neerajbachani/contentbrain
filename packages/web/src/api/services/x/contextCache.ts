import { db } from "../../database";
import * as schema from "../../database/schema";
import { eq, and, gt } from "drizzle-orm";
import { logXContext } from "./logger";
import { randomUUID } from "crypto";
import type { XContextIntent, XContextMode, XContextResult } from "./types";

const TTL_MS = 24 * 60 * 60 * 1000;
const AI_TTL_MS = 60 * 60 * 1000;

function ttlForMode(mode: XContextMode): number {
  return mode === "ai" ? AI_TTL_MS : TTL_MS;
}

function buildCacheKey(
  userId: string,
  intent: XContextIntent,
  inspirationId?: string,
  extra?: string
): string {
  return [userId, intent, inspirationId ?? "none", extra ?? ""].join(":");
}

export async function getCachedXContext(
  userId: string,
  intent: XContextIntent,
  inspirationId?: string,
  extra?: string
): Promise<XContextResult | null> {
  const cacheKey = buildCacheKey(userId, intent, inspirationId, extra);
  const now = new Date();

  const row = await db
    .select()
    .from(schema.xContextCache)
    .where(
      and(
        eq(schema.xContextCache.cacheKey, cacheKey),
        gt(schema.xContextCache.expiresAt, now)
      )
    )
    .get();

  if (!row) {
    logXContext("cache_miss", { intent, inspirationId: inspirationId ?? null });
    return null;
  }

  try {
    const payload = JSON.parse(row.payloadJson) as XContextResult;
    logXContext("cache_hit", { intent, mode: row.mode ?? payload.mode });
    return { ...payload, mode: (row.mode as XContextMode) ?? payload.mode };
  } catch {
    logXContext("cache_corrupt", { intent }, "warn");
    return null;
  }
}

export async function clearUserXContextCache(userId: string): Promise<void> {
  await db.delete(schema.xContextCache).where(eq(schema.xContextCache.userId, userId));
  logXContext("cache_cleared_user", { userId });
}

export async function setCachedXContext(
  userId: string,
  intent: XContextIntent,
  mode: XContextMode,
  payload: XContextResult,
  inspirationId?: string,
  extra?: string
): Promise<void> {
  const cacheKey = buildCacheKey(userId, intent, inspirationId, extra);
  const expiresAt = new Date(Date.now() + ttlForMode(mode));

  const existing = await db
    .select()
    .from(schema.xContextCache)
    .where(eq(schema.xContextCache.cacheKey, cacheKey))
    .get();

  const values = {
    mode,
    payloadJson: JSON.stringify(payload),
    expiresAt,
  };

  if (existing) {
    await db
      .update(schema.xContextCache)
      .set(values)
      .where(eq(schema.xContextCache.cacheKey, cacheKey));
  } else {
    await db.insert(schema.xContextCache).values({
      id: randomUUID(),
      userId,
      inspirationId: inspirationId ?? null,
      intent,
      cacheKey,
      ...values,
    });
  }
}
