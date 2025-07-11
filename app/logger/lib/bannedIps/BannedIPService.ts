/**
 * Singleton service for managing and caching a list of banned IP addresses fetched from the ErrorAware API.
 */

class BannedIPService {
  private static instance: BannedIPService;
  private bannedIPs: Set<string> = new Set();
  private lastFetch: Date | null = null;
  private cacheDuration = 5 * 60 * 1000; // 5 minutes
  private pendingFetch: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): BannedIPService {
    if (!BannedIPService.instance) {
      BannedIPService.instance = new BannedIPService();
    }
    return BannedIPService.instance;
  }

  public async fetchBannedIPs(): Promise<void> {
    if (this.pendingFetch) return this.pendingFetch;

    const shouldRefetch = await this.shouldRefetch();
    if (!shouldRefetch) return;

    const errorAwareKey = process.env.ERROR_AWARE_KEY;
    if (!errorAwareKey) {
      throw new Error('ERROR_AWARE_KEY environment variable is not configured');
    }

    this.pendingFetch = (async () => {
      try {
        const decodedData = Buffer.from(errorAwareKey, 'base64').toString(
          'utf-8'
        );

        const [vId] = decodedData.split(':');
        if (!vId) {
          throw new Error('Invalid ERROR_AWARE_KEY format');
        }
     
        const host =
          process.env.NODE_ENV === 'production'
            ? 'erroraware.com'
            : 'localhost:3002';

        const response = await this.fetchWithRetry(
          `https://${host}/api/blockedips?vid=${vId}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'ErrorAwareClient/2.18.0',
            },
          }
        );

        if (response.status === 404) {
          const msg = 'Blocked IP list not found (404). Skipping IP bans.';
          if (process.env.NODE_ENV === 'production') {
            console.error(msg);
          } else {
            console.warn(msg);
          }
          this.bannedIPs.clear();
          this.lastFetch = new Date();
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch banned IPs: ${response.statusText}`);
        }

        const data = await response.json();

        if (!Array.isArray(data.blockedIps)) {
          throw new Error('Invalid API response format');
        }

        this.bannedIPs.clear();
        data.blockedIps.forEach((obj: { id: string; ip: string }) => {
          if (process.env.NODE_ENV === 'development') {
            console.log(`Banned IP: ${obj.ip}`);
          }
          this.bannedIPs.add(obj.ip.trim());
        });

        this.lastFetch = new Date();
      } catch (error) {
        console.error('Failed to fetch banned IPs:', error);
        throw error;
      } finally {
        this.pendingFetch = null;
      }
    })();

    return this.pendingFetch;
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = 3
  ): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) return response;

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          await new Promise((resolve) =>
            setTimeout(resolve, parseInt(retryAfter ?? '5') * 1000)
          );
          continue;
        }

        throw new Error(`HTTP error! status: ${response.status}`);
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, i))
        );
      }
    }
    throw new Error('Max retries exceeded');
  }

  async shouldRefetch(): Promise<boolean> {
    if (!this.lastFetch) return true;
    return Date.now() - this.lastFetch.getTime() > this.cacheDuration;
  }

  isIPBanned(ip: string): boolean {
    return this.bannedIPs.has(ip.trim());
  }

  async forceRefresh(): Promise<void> {
    console.log('Forcing refresh of banned IPs');
    await this.fetchBannedIPs();
  }

  public getBannedIPs(): string[] {
    return Array.from(this.bannedIPs);
  }
}

export const bannedIPService = BannedIPService.getInstance();
export type { BannedIPService };
