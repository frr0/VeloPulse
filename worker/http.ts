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
