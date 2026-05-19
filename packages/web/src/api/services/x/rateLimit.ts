import { memCache } from "../../cache/memCache";

const DAILY_LIMIT = parseInt(process.env.X_CONTEXT_DAILY_LIMIT ?? "20", 10);

export function checkXContextDailyLimit(userId: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const key = `x_ctx_daily:${userId}:${day}`;
  const count = memCache.get<number>(key) ?? 0;
  return count < DAILY_LIMIT;
}

export function incrementXContextDailyLimit(userId: string): void {
  const day = new Date().toISOString().slice(0, 10);
  const key = `x_ctx_daily:${userId}:${day}`;
  const count = memCache.get<number>(key) ?? 0;
  memCache.set(key, count + 1, 86400);
}

export function getXContextDailyRemaining(userId: string): number {
  const day = new Date().toISOString().slice(0, 10);
  const key = `x_ctx_daily:${userId}:${day}`;
  const count = memCache.get<number>(key) ?? 0;
  return Math.max(0, DAILY_LIMIT - count);
}
