export function getClientId(): string | undefined {
  const key = process.env.ERROR_AWARE_KEY!;
  if (!key) {
    return undefined;
  }
  const [clientId] = Buffer.from(key, "base64").toString("utf-8").split(":");
  return clientId;
}
