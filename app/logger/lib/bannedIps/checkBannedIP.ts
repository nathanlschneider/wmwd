import { type NextRequest } from "next/server";
import { bannedIPService } from "./BannedIPService"
import { logger } from "@erroraware/client";

export function getClientIP(req: NextRequest): string {
  // Try multiple header variations
  const ipAddress =
    // Standard proxy header
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    // Cloudflare
    req.headers.get("cf-connecting-ip") ||
    // Fastly
    req.headers.get("fastly-client-ip") ||
    // Akamai
    req.headers.get("true-client-ip") ||
    // AWS Load Balancer
    req.headers.get("x-real-ip") ||
    // Remote address from Next.js

    // Default fallback
    "0.0.0.0";

  return ipAddress;
}

export async function checkBannedIP(req: NextRequest): Promise<boolean> {
  const ip = getClientIP(req);

  try {
    if (await bannedIPService.shouldRefetch()) {
     bannedIPService.fetchBannedIPs();
    }
  } catch (error) {
    logger.error("Failed to fetch banned IPs", error);
    // Don't fail the request — just continue without updated list
  }

  const isBanned = bannedIPService.isIPBanned(ip);

  if (isBanned) {
    logger.warn(`Banned IP Request Denied (${ip})`);
    console.warn(`Banned IP Request Denied (${ip})`);
  }

  return isBanned;
}