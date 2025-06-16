class BannedIPService {
  private static instance: BannedIPService;
  private bannedIPs: Set<string> = new Set();
  private lastFetch: Date | null = null;
  private cacheDuration = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): BannedIPService {
    if (!BannedIPService.instance) {
      BannedIPService.instance = new BannedIPService();
    }
    return BannedIPService.instance;
  }

  public async fetchBannedIPs(): Promise<void> {
    if (!process.env.ERROR_AWARE_KEY) {
      throw new Error("ERROR_AWARE_KEY environment variable is not configured");
    }

    try {
      const decodedData = Buffer.from(
        process.env.ERROR_AWARE_KEY,
        "base64"
      ).toString("utf-8");

      const [vId] = decodedData.split(":");
      if (!vId) {
        throw new Error("Invalid ERROR_AWARE_KEY format");
      }

      const response = await this.fetchWithRetry(
        "https://erroraware.com/api/blockedips",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "ErrorAwareClient/2.18.0",
          },
          body: JSON.stringify({
            validationId: "0cfc6ed9-df63-437d-909b-68769ca8278f",
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("data", data);
      if (!Array.isArray(data.blockedIps)) {
        throw new Error("Invalid API response format");
      }

      this.bannedIPs.clear();
      data.blockedIps.forEach((obj: { id: string; ip: string }) => {
        if (this.isValidIP(obj.ip)) {
          this.bannedIPs.add(obj.ip);
        }
      });

      this.lastFetch = new Date();
      console.log("fetch seemed to work");
    } catch (error) {
      console.error("Failed to fetch banned IPs:", error);
      throw error; // Re-throw to allow caller to handle
    }
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
          const retryAfter = response.headers.get("Retry-After");
          await new Promise((resolve) =>
            setTimeout(resolve, parseInt(retryAfter ?? "5") * 1000)
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
    throw new Error("Max retries exceeded");
  }

  async shouldRefetch(): Promise<boolean> {
    if (!this.lastFetch) return true;
    return Date.now() - this.lastFetch.getTime() > this.cacheDuration;
  }

  isIPBanned(ip: string): boolean {
    return this.bannedIPs.has(ip);
  }

  async forceRefresh(): Promise<void> {
    await this.fetchBannedIPs();
  }

  private isValidIP(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

    if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
      return false;
    }

    if (ipv4Regex.test(ip)) {
      const parts = ip.split(".").map((part) => parseInt(part, 10));
      return parts.every((part) => part >= 0 && part <= 255);
    }

    return true;
  }
}

export const bannedIPService = BannedIPService.getInstance();
export type { BannedIPService };
