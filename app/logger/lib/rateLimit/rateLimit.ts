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
