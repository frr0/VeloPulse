export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}

/** Redirects back to the web app with a `?strava=<status>` flag the UI can read. */
export function redirectToApp(origin: string, status: string, headers: HeadersInit = {}): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: `${origin}/?strava=${encodeURIComponent(status)}`, ...headers },
  });
}

/** Custom URL scheme the phone app registers (see AndroidManifest.xml and Info.plist). */
export const APP_CALLBACK_URL = 'com.velopulse.app://strava';

/**
 * Sends the system browser back into the phone app after Strava consent.
 * `params` carries the Strava `code`, `state` and `scope` on success; the app
 * finishes the link through `/api/strava/exchange` with its own session.
 */
export function redirectToNativeApp(
  status: string,
  params: Record<string, string> = {},
  headers: HeadersInit = {}
): Response {
  const url = new URL(APP_CALLBACK_URL);
  url.searchParams.set('status', status);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return new Response(null, { status: 302, headers: { Location: url.toString(), ...headers } });
}

/**
 * Origins of the Capacitor WebView (Android serves the app from https://localhost,
 * iOS from capacitor://localhost). The web app is same-origin and needs no CORS.
 */
const NATIVE_APP_ORIGINS = new Set(['https://localhost', 'capacitor://localhost']);

/** CORS headers for a request coming from the phone app, or none. */
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin');
  if (!origin || !NATIVE_APP_ORIGINS.has(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  return token || null;
}

export function readCookie(request: Request, name: string): string | null {
  const cookies = request.headers.get('Cookie') || '';
  for (const part of cookies.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=') || null;
  }
  return null;
}
