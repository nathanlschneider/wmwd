import { rateLimit } from "./rateLimit";
import { getClientId } from "./getClientId";
import { securityHeaders, createErrorResponse } from "../shared";

export async function maybeRateLimit(req: Request, ip: string) {
  const clientId = getClientId();
  if (!clientId) return null;

  const allowed = await rateLimit(clientId, ip);
  if (!allowed) {
    return createErrorResponse("Rate limit exceeded", 429, {
      "Retry-After": "60",
      "Content-Type": "application/json",
    });
  }

  return null;
}
