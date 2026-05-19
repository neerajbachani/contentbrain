import { db } from "../../database";
import * as schema from "../../database/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { XDataSource } from "./types";

export async function getOrCreateUserProfile(userId: string) {
  let profile = await db
    .select()
    .from(schema.userProfiles)
    .where(eq(schema.userProfiles.userId, userId))
    .get();

  if (!profile) {
    const today = new Date().toISOString().slice(0, 10);
    [profile] = await db.insert(schema.userProfiles).values({
      id: randomUUID(),
      userId,
      niche: "[]",
      plan: "free",
      xDataSource: "auto",
      remixCount: 0,
      mergeCount: 0,
      trendCount: 0,
      lastResetDate: today,
    }).returning();
  }

  return profile;
}

export function parseXDataSource(value: unknown): XDataSource {
  if (value === "xai" || value === "apify" || value === "auto") return value;
  return "auto";
}
