import { NextResponse, type NextRequest } from 'next/server';
import { bannedIPService } from '../lib/bannedIps/BannedIPService';
import { getClientIp, logError, securityHeaders } from '../lib/shared';
import { maybeRateLimit } from '../lib/rateLimit/enforceRateLimit';
import { clientSettingsService } from '../lib/rateLimit/ClientSettingsService';

export async function POST(req: NextRequest) {
  try {
    const ip = await getClientIp();

    const rateLimitResponse = await maybeRateLimit(req, ip);
    if (rateLimitResponse) return rateLimitResponse;

    await Promise.all([
      bannedIPService.forceRefresh(),
      clientSettingsService.forceRefresh(),
    ]);

    return NextResponse.json(
      {
        success: true,
        message: 'Security settings and banned IPs refreshed successfully',
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          ...securityHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    logError('Error refreshing security settings', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'Failed to refresh security settings',
      },
      {
        status: 500,
        headers: {
          ...securityHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
