import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "../lib/rateLimit/rateLimit";
import { logger } from "@erroraware/client";
import { publicKey } from "../lib/keyImports";
import { readFileSync } from "fs";
import path from "path";
import { getClientId} from "../lib/rateLimit/getClientId";

import type {
  OwnershipPayload,
  RequestPayload,
  VerificationPayload,
} from "../lib/types";
import {
  convertToEntity,
  createErrorResponse,
  createRequestContext,
  ErrorType,
  MAX_BODY_SIZE,
  securityHeaders,
} from "../lib/shared";
function isVerificationPayload(
  payload: unknown
): payload is VerificationPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    (payload as VerificationPayload).verificationType === "connection" &&
    typeof (payload as VerificationPayload).timestamp === "number"
  );
}

function isOwnershipPayload(payload: unknown): payload is OwnershipPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    (payload as OwnershipPayload).verificationType === "ownership" &&
    typeof (payload as OwnershipPayload).validationId === "string"
  );
}

function verifyConnectionRequest(payload: Record<string, unknown>): boolean {
  if (!isVerificationPayload(payload)) {
    return false;
  }

  const timestampAge = Date.now() - payload.timestamp;
  const ALLOWED_CLOCK_SKEW = 30000; // 30 seconds
  return timestampAge <= 300000 + ALLOWED_CLOCK_SKEW; // 5 minutes + skew
}

function verifyPayload(payload: Record<string, unknown>): boolean {
  const MAX_STRING_LENGTH = 1000;

  return Object.entries(payload).every(([value]) => {
    if (typeof value === "string") {
      return value.length <= MAX_STRING_LENGTH;
    }
    return true;
  });
}

export async function POST(req: NextRequest) {
  const context = createRequestContext(req);

  const allowed = await rateLimit(getClientId(),context.ip);
  if (!allowed) {
    logger.warn(`Rate limit exceeded (${context.ip})`);
    return createErrorResponse("Rate Limit Exceeded", 429);
  }

  if (
    req.headers.get("content-length") &&
    parseInt(req.headers.get("content-length")!) > MAX_BODY_SIZE
  ) {
    return createErrorResponse("Request too large", 413);
  }

  if (req.headers.get("x-forwarded-proto") !== "https") {
    return createErrorResponse("HTTPS required");
  }

  let requestData: RequestPayload;
  try {
    requestData = await req.json();
  } catch {
    return createErrorResponse("Invalid JSON payload", 400);
  }

  const { payload } = requestData;
  if (!payload) {
    return createErrorResponse("Missing payload", 400);
  }

  if (!verifyPayload(payload)) {
    return createErrorResponse("Invalid payload format", 400);
  }

  if (payload.verificationType === "connection") {
    if (!isVerificationPayload(payload)) {
      return createErrorResponse(ErrorType.INVALID_VERIFICATION, 400);
    }

    if (!verifyConnectionRequest(payload)) {
      return createErrorResponse(ErrorType.CONNECTION_ERROR, 400);
    }

    return NextResponse.json(
      {
        success: true,
        verified: true,
        platformId: payload.platformId,
        requestId: context.requestId,
        correlationId: context.correlationId,
      },
      {
        headers: {
          "X-Request-ID": context.requestId,
          "X-Correlation-ID": context.correlationId,
          "X-Verification-Time": Date.now().toString(),
          ...securityHeaders,
        },
      }
    );
  }

  if (payload.verificationType === "ownership") {
    if (!isOwnershipPayload(payload)) {
      return createErrorResponse("Invalid ownership payload", 400);
    }

    if (!process.env.ERROR_AWARE_KEY) {
      return NextResponse.json({
        success: false,
        error: "ERROR_AWARE_KEY not configured",
        status: 500,
      });
    }

    const entity = convertToEntity(process.env.ERROR_AWARE_KEY);

    console.log(
      payload.validationId,
      entity.validationId,
      payload.validationId !== entity.validationId
    );

    if (payload.validationId !== entity.validationId) {
      return NextResponse.json({
        success: false,
        error: "ERROR_AWARE_KEY does not match",
        status: 400,
      });
    }
    return NextResponse.json(
      {
        success: true,
        verified: true,
        ownership: true,
        requestId: context.requestId,
        correlationId: context.correlationId,
      },
      {
        headers: {
          "X-Request-ID": context.requestId,
          "X-Correlation-ID": context.correlationId,
          ...securityHeaders,
        },
      }
    );
  }

  return NextResponse.json(
    {
      success: true,
      received: payload,
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    {
      headers: {
        "X-Request-ID": context.requestId,
        "X-Correlation-ID": context.correlationId,
        ...securityHeaders,
      },
    }
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  if (searchParams.has("clientversion")) {
    try {
      const pkgPath = path.resolve(
        process.cwd(),
        "node_modules/@erroraware/client/package.json"
      );
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      return NextResponse.json({ version: pkg.version });
    } catch (err) {
      return NextResponse.json(
        { error: "Failed to read client version" },
        { status: 500 }
      );
    }
  }

  if (searchParams.has("publickey") || searchParams.has("publicKey")) {
    return NextResponse.json({ success: true, publicKey });
  }

  return new NextResponse(null, { status: 204 });
}
