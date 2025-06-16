type ClientSettings = {
  rateLimit: {
    requests: number;
    duration: string; // e.g. "10s"
  };
  blockBlankUserAgents: boolean;
  suspiciousPatterns: string[];
  customRules?: Record<string, any>;
};

class ClientSettingsService {
  private static instance: ClientSettingsService;
  private settings: ClientSettings | null = null;
  private lastFetch: Date | null = null;
  private cacheDuration = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): ClientSettingsService {
    if (!ClientSettingsService.instance) {
      ClientSettingsService.instance = new ClientSettingsService();
    }
    return ClientSettingsService.instance;
  }

  public async fetchSettings(): Promise<void> {
    if (!process.env.ERROR_AWARE_KEY) {
      throw new Error("ERROR_AWARE_KEY not set");
    }

    const decoded = Buffer.from(process.env.ERROR_AWARE_KEY, "base64").toString(
      "utf-8"
    );
    const [clientId] = decoded.split(":");

    const res = await fetch(`https://erroraware.com/api/entities?where[validationId][equals]=${clientId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "ErrorAwareClient/2.18.0",
      },
      });

    if (!res.ok) {
      throw new Error(`Failed to fetch settings: ${res.status}`);
    }

    const data = await res.json();

    this.settings = {
      rateLimit: {
        requests: data.rateLimit?.requests ?? 5,
        duration: data.rateLimit?.duration ?? "10s",
      },
      blockBlankUserAgents: !!data.blockBlankUserAgents,
      suspiciousPatterns: data.suspiciousPatterns ?? [],
      customRules: data.customRules ?? {},
    };

    this.lastFetch = new Date();
  }

  public async shouldRefetch(): Promise<boolean> {
    if (!this.lastFetch) return true;
    return Date.now() - this.lastFetch.getTime() > this.cacheDuration;
  }

  public getSettings(): ClientSettings | null {
    return this.settings;
  }

  public async forceRefresh(): Promise<void> {
    await this.fetchSettings();
  }
}

export const clientSettingsService = ClientSettingsService.getInstance();
export type { ClientSettings };
