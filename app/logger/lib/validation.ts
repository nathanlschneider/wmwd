import type { OwnershipPayload, VerificationPayload } from './types';

export function isVerificationPayload(
  payload: unknown
): payload is VerificationPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as VerificationPayload).verificationType === 'connection' &&
    typeof (payload as VerificationPayload).timestamp === 'number'
  );
}

export function isOwnershipPayload(
  payload: unknown
): payload is OwnershipPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as OwnershipPayload).verificationType === 'ownership' &&
    typeof (payload as OwnershipPayload).validationId === 'string'
  );
}

export function verifyConnectionRequest(payload: VerificationPayload): boolean {
  if (!isVerificationPayload(payload)) return false;
  const timestampAge = Date.now() - payload.timestamp;
  const ALLOWED_CLOCK_SKEW = 30_000;
  return timestampAge <= 300_000 + ALLOWED_CLOCK_SKEW;
}

export function verifyPayload(payload: Record<string, unknown>): boolean {
  const MAX_STRING_LENGTH = 1000;
  return Object.values(payload).every((value) =>
    typeof value === 'string' ? value.length <= MAX_STRING_LENGTH : true
  );
}
