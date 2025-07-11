import { Ratelimit, type Duration } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { clientSettingsService } from './ClientSettingsService';

const redis = new Redis({
  url: 'https://strong-egret-33354.upstash.io',
  token: 'AYJKAAIjcDE1MjM1ZTdiMmIwZTQ0NDg3YTcyYTQ5YTZjY2VlNzY2NHAxMA',
});
const settings = clientSettingsService.getSettings();
const duration: Duration = '1s'; // 1 second
const numberOfRequestsPerDuration = settings?.requestsPerDuration || 10;

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

export async function getRequestCount(
  clientId: string,
  ip: string
): Promise<number> {
  const key = `ratelimit:${clientId}:${ip}`;
  const now = Date.now();
  const oneSecondAgo = now - 1_000;

  const count = await redis.zcount(key, oneSecondAgo, now);
  return count;
}
