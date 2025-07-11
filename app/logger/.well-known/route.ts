import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '../lib/rateLimit/rateLimit';
import { logger } from '@erroraware/client';
import { publicKey } from '../lib/keyImports';
import { readFileSync } from 'fs';
import path from 'path';
import { getClientId } from '../lib/rateLimit/getClientId';

import {
  createErrorResponse,
  createRequestContext,
  convertToEntity,
  ErrorType,
  MAX_BODY_SIZE,
  securityHeaders,
} from '../lib/shared';

import {
  isVerificationPayload,
  isOwnershipPayload,
  verifyConnectionRequest,
  verifyPayload,
} from '../lib/validation';

import { checkContentLength, checkHTTPS } from '../lib/shared';

export async function POST(req: NextRequest) {
  const context = createRequestContext(req);

  const clientId = getClientId();
  if (clientId) {
    const allowed = await rateLimit(clientId, context.ip);
    if (!allowed) {
      logger.warn(`Rate limit exceeded (${context.ip})`);
      return createErrorResponse('Rate Limit Exceeded', 429);
    }
  }

  if (!checkContentLength(req, MAX_BODY_SIZE)) {
    return createErrorResponse('Request too large', 413);
  }

  if (process.env.NODE_ENV === 'production' && !checkHTTPS(req)) {
    return createErrorResponse('HTTPS required');
  }

  let requestData;
  try {
    requestData = await req.json();
  } catch {
    return createErrorResponse('Invalid JSON payload', 400);
  }

  const { payload } = requestData;
  if (!payload) return createErrorResponse('Missing payload', 400);
  if (!verifyPayload(payload)) return createErrorResponse('Invalid payload format', 400);

  if (payload.verificationType === 'connection') {
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
          'X-Request-ID': context.requestId,
          'X-Correlation-ID': context.correlationId,
          'X-Verification-Time': Date.now().toString(),
          ...securityHeaders,
        },
      }
    );
  }

  if (payload.verificationType === 'ownership') {
    if (!isOwnershipPayload(payload)) {
      return createErrorResponse('Invalid ownership payload', 400);
    }

    if (!process.env.ERROR_AWARE_KEY) {
      return createErrorResponse('ERROR_AWARE_KEY not configured', 500);
    }

    const entity = convertToEntity(process.env.ERROR_AWARE_KEY);
    if (payload.validationId !== entity.validationId) {
      return createErrorResponse('ERROR_AWARE_KEY does not match', 400);
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
          'X-Request-ID': context.requestId,
          'X-Correlation-ID': context.correlationId,
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
        'X-Request-ID': context.requestId,
        'X-Correlation-ID': context.correlationId,
        ...securityHeaders,
      },
    }
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  if (searchParams.has('clientversion')) {
    try {
      const pkgPath = path.resolve(
        process.cwd(),
        'node_modules/@erroraware/client/package.json'
      );
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      return NextResponse.json({ version: pkg.version });
    } catch (err) {
      console.log(err);
      return createErrorResponse('Failed to read client version', 500);
    }
  }

  if (searchParams.has('publickey') || searchParams.has('publicKey')) {
    return NextResponse.json({ success: true, publicKey });
  }

  return new NextResponse(null, { status: 204 });
}
