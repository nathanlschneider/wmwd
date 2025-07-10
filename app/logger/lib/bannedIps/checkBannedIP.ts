import { type NextRequest } from "next/server";
import { bannedIPService } from "./BannedIPService";
import { logger } from "@erroraware/client";

/**
 * Retrieves the client's IP address from a Next.js request object by checking various common headers.
 *
 * @param req - The Next.js request object.
 * @returns The detected client IP address or null if none found.
 */
export function getClientIP(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("fastly-client-ip") ||
    req.headers.get("true-client-ip") ||
    req.headers.get("x-real-ip") ||
    null
  );
}

/**
 * Checks if the client's IP address is banned.
 *
 * @param req - The Next.js request object.
 * @returns `true` if IP is banned, otherwise `false`.
 */
export async function checkBannedIP(req: NextRequest): Promise<boolean> {
  const ip = getClientIP(req);

  if (!ip) {
    // No IP found, allow or block accordingly
    return false;
  }

  try {
    if (await bannedIPService.shouldRefetch()) {
      await bannedIPService.fetchBannedIPs();
    }
  } catch (error) {
    logger.error("Failed to fetch banned IPs", error);
    // Don't fail the request — continue without updated list
  }

  const isBanned = bannedIPService.isIPBanned(ip);

  if (isBanned) {
    logger.warn(`Banned IP Request Denied (${ip})`);
    console.warn(`Banned IP Request Denied (${ip})`);
  }

  return isBanned;
}
