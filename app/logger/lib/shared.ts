import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { publicKey } from './keyImports';
import type { RequestContext } from './types';
import { privateKey } from './keyImports';
import { headers } from 'next/headers';

export const MAX_BODY_SIZE = 1024 * 1024; // 1MB
export const TIMEOUT = 5000; // 5 seconds
export const RATE_LIMIT_WINDOW = 60000; // 1 minute window
export const MAX_REQUESTS = 20; // Max requests per minute
export const MAX_RATE_LIMIT_ENTRIES = 10000; // Max IPs to track
export const home = process.cwd();

export function verifySignature(
  payload: Record<string, unknown>,
  signature: string
): boolean {
  try {
    const data = JSON.stringify(payload);
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(data);
    return verify.verify(publicKey, Buffer.from(signature, 'base64'));
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

export function objectProperyRemover(
  obj: Record<string, unknown>,
  keys: string[]
): object {
  keys.forEach((key) => {
    delete obj[key];
  });
  return obj;
}

export function getClientIP(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}


export function createErrorResponse(
  message: string,
  status: number = 403,
  headers: Record<string, string> = {}
): NextResponse {
  const requestId = generateRequestId();
  return NextResponse.json(
    { success: false, error: message, requestId },
    {
      status,
      headers: {
        'X-Request-ID': requestId,
        ...securityHeaders,
        ...headers,
      },
    }
  );
}

export function generateRequestId(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function createRequestContext(req: NextRequest): RequestContext {
  const now = Date.now();
  const requestId = generateRequestId();
  return {
    requestId,
    correlationId: req.headers.get('x-correlation-id') || requestId,
    timestamp: now,
    ip: getClientIP(req),
    startTime: now,
  };
}

export const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store',
};

export const enum ErrorType {
  RATE_LIMIT = 'Rate limit exceeded',
  INVALID_IP = 'Unauthorized IP',
  INVALID_PROTOCOL = 'HTTPS required',
  INVALID_SIGNATURE = 'Invalid signature',
  TIMEOUT = 'Request timeout',
  PAYLOAD_TOO_LARGE = 'Request too large',
  INVALID_JSON = 'Invalid JSON payload',
  MISSING_FIELDS = 'Missing payload or signature',
  INTERNAL_ERROR = 'Internal server error',
  INVALID_VERIFICATION = 'Invalid verification token',
  CONNECTION_ERROR = 'Connection verification failed',
}

export const convertToEntity = (base64String: string) => {
  const originalString = Buffer.from(base64String, 'base64').toString('utf8');
  const [validationId, host] = originalString.split(':');
  return { validationId, host };
};

export function signPayload(payload: unknown): string {
  const data = JSON.stringify(payload);
  const signature = crypto.sign('RSA-SHA256', Buffer.from(data), privateKey);
  return signature.toString('base64');
}

export async function getClientIp(): Promise<string> {
  const headersList = await headers();
  return (
    headersList.get('x-forwarded-for')?.split(',')[0] ||
    headersList.get('x-real-ip') ||
    '0.0.0.0'
  );
}

export function checkContentLength(req: Request, maxSize: number): boolean {
  const contentLength = req.headers.get('content-length');
  return !contentLength || parseInt(contentLength) <= maxSize;
}

export function checkHTTPS(req: Request): boolean {
  return req.headers.get('x-forwarded-proto') === 'https';
}

export function ensureEnvVar(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`${name} is not set`);
  return val;
}

export function logError(message: string, err: unknown) {
  console.error(`${message}:`, err instanceof Error ? err.message : err);
}

export function authorizeRequest(req: Request, validationId: string): boolean {
  const authHeader = req.headers.get("Authorization");
  return authHeader === `Bearer ${validationId}`;
}
