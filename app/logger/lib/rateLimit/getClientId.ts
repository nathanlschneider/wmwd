export function getClientId(): string {
  const key = process.env.ERROR_AWARE_KEY!;
  const [clientId] = Buffer.from(key, "base64").toString("utf-8").split(":");
  return clientId;
}
