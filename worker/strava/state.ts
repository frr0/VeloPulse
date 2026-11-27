/**
 * Signed OAuth `state` for the Strava authorization flow.
 *
 * The state carries the Supabase user id, a random nonce and an expiry, signed
 * with HMAC-SHA256. The same nonce is stored in an HttpOnly cookie on the
 * browser that started the flow, so a state cannot be forged (no secret) nor
 * used from another browser (no cookie) to link a Strava account to someone
 * else's profile.
 */

export const STATE_COOKIE = 'strava_oauth_nonce';
export const STATE_TTL_SECONDS = 600;

export interface StatePayload {
  uid: string;
  nonce: string;
  exp: number;
}

const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export function randomNonce(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(24)));
}

export async function signState(payload: StatePayload, secret: string): Promise<string> {
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(body));
  return `${body}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/**
 * Returns the payload when the signature is valid, the state has not expired
 * and its nonce matches the cookie nonce. Returns null otherwise.
 */
export async function verifyState(
  state: string,
  cookieNonce: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<StatePayload | null> {
  const [body, signature, extra] = state.split('.');
  if (!body || !signature || extra !== undefined) return null;

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = base64UrlDecode(signature);
  } catch {
    return null;
  }

  // crypto.subtle.verify compares in constant time.
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    signatureBytes,
    encoder.encode(body)
  );
  if (!valid) return null;

  let payload: StatePayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as StatePayload;
  } catch {
    return null;
  }

  if (!payload.uid || !payload.nonce || typeof payload.exp !== 'number') return null;
  if (payload.exp < nowSeconds) return null;
  if (!cookieNonce || cookieNonce !== payload.nonce) return null;
  return payload;
}

export function stateCookie(nonce: string): string {
  return `${STATE_COOKIE}=${nonce}; Path=/api/strava; HttpOnly; Secure; SameSite=Lax; Max-Age=${STATE_TTL_SECONDS}`;
}

export function clearStateCookie(): string {
  return `${STATE_COOKIE}=; Path=/api/strava; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
