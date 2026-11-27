/**
 * Encryption of OAuth tokens at rest (AES-256-GCM).
 *
 * The key lives only in the Worker secret STRAVA_TOKEN_KEY (32 random bytes,
 * base64), never in Supabase: a database dump, a backup or the Supabase
 * dashboard only show ciphertext.
 *
 * Format: "v1:" + base64(iv[12] || ciphertext+tag). The row's user id is used
 * as additional authenticated data, so a ciphertext copied to another user's
 * row does not decrypt.
 *
 * Values without the "v1:" prefix are legacy plaintext from before encryption
 * existed; they are returned as they are and re-encrypted by the caller.
 */

const PREFIX = 'v1:';
const encoder = new TextEncoder();
const keyCache = new Map<string, Promise<CryptoKey>>();

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function importKey(secret: string): Promise<CryptoKey> {
  let key = keyCache.get(secret);
  if (!key) {
    const raw = fromBase64(secret.trim());
    if (raw.length !== 32) throw new Error('STRAVA_TOKEN_KEY must be 32 bytes, base64-encoded.');
    key = crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
    keyCache.set(secret, key);
  }
  return key;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export async function encryptToken(plaintext: string, secret: string, userId: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(userId) },
    await importKey(secret),
    encoder.encode(plaintext)
  );
  const out = new Uint8Array(iv.length + ciphertext.byteLength);
  out.set(iv);
  out.set(new Uint8Array(ciphertext), iv.length);
  return PREFIX + toBase64(out);
}

/** Decrypts a stored token. Legacy plaintext is returned unchanged. Throws on tampering or wrong key. */
export async function decryptToken(stored: string, secret: string, userId: string): Promise<string> {
  if (!isEncrypted(stored)) return stored;
  const bytes = fromBase64(stored.slice(PREFIX.length));
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes.slice(0, 12), additionalData: encoder.encode(userId) },
    await importKey(secret),
    bytes.slice(12)
  );
  return new TextDecoder().decode(plaintext);
}
