/**
 * Password hashing with PBKDF2-SHA256 from the Web Crypto API, which is built into
 * Cloudflare Workers (bcrypt would exceed the Workers CPU budget). Workers allow at most
 * 100,000 PBKDF2 iterations.
 *
 * Stored format: pbkdf2$<iterations>$<salt base64>$<hash base64>
 */

const ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256;
const PREFIX = "pbkdf2";

const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    KEY_LENGTH_BITS,
  );
  return new Uint8Array(bits);
}

/** Constant-time comparison of two byte arrays. */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `${PREFIX}$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export function isHashed(stored: string): boolean {
  return stored.startsWith(`${PREFIX}$`);
}

/**
 * Verifies a password. Accounts created by the first version of this app stored plain-text
 * passwords; those are compared in constant time and reported with `needsRehash` so the
 * caller can upgrade them to a hash on successful sign-in.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (!isHashed(stored)) {
    const valid = timingSafeEqual(encoder.encode(password), encoder.encode(stored));
    return { valid, needsRehash: valid };
  }
  const [, iterationsText, saltText, hashText] = stored.split("$");
  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || !saltText || !hashText) return { valid: false, needsRehash: false };
  const actual = await derive(password, fromBase64(saltText), iterations);
  const valid = timingSafeEqual(actual, fromBase64(hashText));
  return { valid, needsRehash: valid && iterations !== ITERATIONS };
}
