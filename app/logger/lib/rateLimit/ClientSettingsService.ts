type ClientSettings = {
  rateLimit: {
    requestsPerDuration: number;
    banThreshold: number;
    softBanDuration: number;
    softBanViolations: number;
    allowEmptyUserAgents: boolean;
    enableHoneypot: boolean;
    checkRefererHeader: boolean;
    checkOriginHeader: boolean;
    checkAcceptHeader: boolean;
    limitExceededWarn: boolean;
    limitExceededBan: boolean;
    securityPolicy: 'none' | 'strict' | 'moderate';
    blockedCountryCodes: null | string[];
    lastSyncedAt: string;
  };
};

class ClientSettingsService {
  private static instance: ClientSettingsService;
  private settings: ClientSettings['rateLimit'] | null = null;
  private lastFetch: Date | null = null;
  private cacheDuration = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): ClientSettingsService {
    if (!ClientSettingsService.instance) {
      ClientSettingsService.instance = new ClientSettingsService();
    }
    return ClientSettingsService.instance;
  }

  public async blockThisIP(ip: string): Promise<void> {
    const host =
      process.env.NODE_ENV === 'production'
        ? 'erroraware.com'
        : 'localhost:3002';
    const protocol =
      process.env.NODE_ENV === 'development' && host.includes('localhost')
        ? 'http'
        : 'https';

    await fetch(`${protocol}://${host}/api/blockedips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ErrorAwareClient/2.18.0',
      },
      body: JSON.stringify({
        validationId: process.env.ERROR_AWARE_KEY || '',
        ip,
      }),
    });
  }

  public async fetchSettings(): Promise<void> {
    if (!process.env.ERROR_AWARE_KEY) {
      throw new Error('ERROR_AWARE_KEY not set');
    }

    const decoded = Buffer.from(process.env.ERROR_AWARE_KEY, 'base64').toString(
      'utf-8'
    );
    const [clientId] = decoded.split(':');
    const host =
      process.env.NODE_ENV === 'production'
        ? 'erroraware.com'
        : 'localhost:3002';
    const protocol =
      process.env.NODE_ENV === 'development' && host.includes('localhost')
        ? 'http'
        : 'https';

    const res = await fetch(`${protocol}://${host}/api/clientconfigs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ErrorAwareClient/2.18.0',
      },
      body: JSON.stringify({
        validationId: clientId,
      }),
    });

    this.lastFetch = new Date();

    if (!res.ok) {
      const cloned = res.clone();
      const json = await cloned.json();
      this.settings = json.error;
    } else {
      const json = await res.json();

      if (!json?.entity?.rateLimit) {
        throw new Error('Invalid response from /clientconfigs');
      }

      const data: ClientSettings['rateLimit'] = json.entity.rateLimit;

      this.settings = {
        requestsPerDuration: data.requestsPerDuration,
        banThreshold: data.banThreshold,
        softBanDuration: data.softBanDuration,
        softBanViolations: data.softBanViolations,
        allowEmptyUserAgents: data.allowEmptyUserAgents,
        enableHoneypot: data.enableHoneypot,
        checkRefererHeader: data.checkRefererHeader,
        checkOriginHeader: data.checkOriginHeader,
        checkAcceptHeader: data.checkAcceptHeader,
        limitExceededWarn: data.limitExceededWarn,
        limitExceededBan: data.limitExceededBan,
        securityPolicy: data.securityPolicy,
        blockedCountryCodes: data.blockedCountryCodes,
        lastSyncedAt: data.lastSyncedAt,
      };
    }
  }

  public async shouldRefetch(): Promise<boolean> {
    if (!this.lastFetch) return true;
    return Date.now() - this.lastFetch.getTime() > this.cacheDuration;
  }

  public getSettings(): ClientSettings | null {
    return this.settings ? { rateLimit: this.settings } : null;
  }

  public async forceRefresh(): Promise<void> {
    await this.fetchSettings();
  }

  public async getInitializedSettings(): Promise<ClientSettings> {
    if (!this.settings || (await this.shouldRefetch())) {
      await this.fetchSettings();
    }

    if (!this.settings) {
      throw new Error('Settings not initialized');
    }

    return { rateLimit: this.settings };
  }
}

export const clientSettingsService = ClientSettingsService.getInstance();
export type { ClientSettings };
