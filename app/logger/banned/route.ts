import { rateLimit } from "../lib/rateLimit/rateLimit";
import { bannedIPService } from "../lib/bannedIps/BannedIPService"; 
import { NextResponse, type NextRequest } from "next/server";
import { headers } from 'next/headers';
import { createErrorResponse, securityHeaders } from "../lib/shared";
import { getClientId } from '../lib/rateLimit/getClientId';

export async function POST(req: NextRequest) {
  try {
    // Verify request method
    if (req.method !== 'POST') {
      return createErrorResponse('Method not allowed', 405);
    }

    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for")?.split(',')[0] || 
               headersList.get("x-real-ip") || 
               '0.0.0.0';

    // Apply rate limiting
    const rateLimitResult = await rateLimit(getClientId(),ip);
    if (!rateLimitResult) {
      return NextResponse.json(
        {
          error: "Too many requests",
          message: "Please try again later"
        },
        { 
          status: 429,
          headers: {
            ...securityHeaders,
            'Retry-After': '60',
            'Content-Type': 'application/json'
          }
        }
      );
    }

    await bannedIPService.forceRefresh();
    return NextResponse.json(
      { 
        success: true,
        message: "Banned IPs refreshed successfully",
        timestamp: new Date().toISOString()
      }, 
      { 
        status: 200,
        headers: {
          ...securityHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );
  } catch (error) {
    console.error("Error refreshing banned IPs:", error);
    return NextResponse.json(
      { 
        error: "Internal Server Error", 
        message: "Failed to refresh banned IPs"
      }, 
      { 
        status: 500,
        headers: {
          ...securityHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
}
