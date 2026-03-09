const KEY_PREFIX = "cd_";
const KEY_RANDOM_BYTES = 16; // 16 bytes = 32 hex chars

/** Generate a raw API key: `cd_` + 32 hex chars (total 35 chars). */
export function generateApiKey(): string {
  const buf = new Uint8Array(KEY_RANDOM_BYTES);
  crypto.getRandomValues(buf);
  const hex = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
  return KEY_PREFIX + hex;
}

/** SHA-256 hash of the raw key, returned as lowercase hex. */
export async function hashKey(rawKey: string): Promise<string> {
  const data = new TextEncoder().encode(rawKey);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

/** First 12 characters of the raw key for display (e.g. `cd_a1b2c3d4`). */
export function keyPrefix(rawKey: string): string {
  return rawKey.slice(0, 12);
}

/** Extract Bearer token from the Authorization header value. */
export function extractBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}
