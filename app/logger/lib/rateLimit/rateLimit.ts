import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: "https://strong-egret-33354.upstash.io",
  token: "AYJKAAIjcDE1MjM1ZTdiMmIwZTQ0NDg3YTcyYTQ5YTZjY2VlNzY2NHAxMA",
});

const duration: Duration = "1m";
const numberOfRequestsPerDuration = 500;

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(numberOfRequestsPerDuration, duration),
  analytics: true,
});

export async function rateLimit(
  clientId: string,
  ip: string
): Promise<boolean> {
  const namespacedKey = `${clientId}:${ip}`;
  const { success } = await ratelimit.limit(namespacedKey);
  return success;
}

// NEW: Get current request count in the sliding window
export async function getRequestCount(
  clientId: string,
  ip: string
): Promise<number> {
  const key = `ratelimit:${clientId}:${ip}`;
  const now = Date.now();
  const oneMinuteAgo = now - 60_000; // 1 minute in ms (match your duration)

  // Count the number of requests in the last minute window
  const count = await redis.zcount(key, oneMinuteAgo, now);
  return count;
}
