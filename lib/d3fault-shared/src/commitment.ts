/**
 * D3FAULT Commitment-Nullifier Scheme
 *
 * Protocol:
 *   secret   = random 32 bytes (known only to link creator + holder)
 *   commitment = sha256(secret)  — stored on-chain at deposit time
 *
 * At claim:
 *   Holder submits secret (proves preimage knowledge).
 *   Program verifies sha256(secret) == stored commitment.
 *   Program creates NullifierRecord PDA seeded by commitment (prevents replay).
 *
 * Claim URL:  /claim#<secretHex>   (hash fragment — never sent to servers)
 */

/** Generate a random 32-byte secret using the Web Crypto API */
export function generateSecret(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

/** Compute commitment = sha256(secret) using Web Crypto API */
export async function computeCommitment(secret: Uint8Array): Promise<Uint8Array> {
  // Slice ensures the buffer is a plain ArrayBuffer, not SharedArrayBuffer
  const buf = secret.buffer.slice(
    secret.byteOffset,
    secret.byteOffset + secret.byteLength
  ) as ArrayBuffer;
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return new Uint8Array(hash);
}

/** Encode Uint8Array as lowercase hex string */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Decode a hex string to Uint8Array */
export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("Invalid hex string");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Build a claim URL: /claim#<secretHex> */
export function buildClaimUrl(origin: string, secret: Uint8Array): string {
  return `${origin}/claim#${toHex(secret)}`;
}

/** Parse a claim URL fragment: returns { secret } or null if invalid */
export function parseClaimHash(hash: string): { secret: string } | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (raw.length === 64 && /^[0-9a-f]+$/i.test(raw)) {
    return { secret: raw.toLowerCase() };
  }
  return null;
}
