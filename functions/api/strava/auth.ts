/**
 * Cloudflare Pages Function: GET /api/strava/auth
 * Redirects the authenticated VeloPulse user to Strava OAuth2 authorization.
 *
 * Required Cloudflare Pages Environment Variables:
 * - STRAVA_CLIENT_ID
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

interface Env {
  STRAVA_CLIENT_ID?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const accessToken = url.searchParams.get('token');

  if (!env.STRAVA_CLIENT_ID || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({
        error: 'Strava OAuth is not configured on this Cloudflare deployment yet.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!accessToken) {
    return new Response(JSON.stringify({ error: 'Missing Supabase session token.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify the Supabase JWT to extract user_id safely
  const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });

  if (!userRes.ok) {
    return new Response(JSON.stringify({ error: 'Invalid Supabase session.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = (await userRes.json()) as { id: string };
  const redirectUri = `${url.origin}/api/strava/callback`;
  const state = btoa(JSON.stringify({ userId: user.id, origin: url.origin }));

  const stravaAuthUrl = new URL('https://www.strava.com/oauth/authorize');
  stravaAuthUrl.searchParams.set('client_id', env.STRAVA_CLIENT_ID);
  stravaAuthUrl.searchParams.set('redirect_uri', redirectUri);
  stravaAuthUrl.searchParams.set('response_type', 'code');
  stravaAuthUrl.searchParams.set('approval_prompt', 'auto');
  stravaAuthUrl.searchParams.set('scope', 'read,activity:read_all,profile:read_all');
  stravaAuthUrl.searchParams.set('state', state);

  return Response.redirect(stravaAuthUrl.toString(), 302);
}
