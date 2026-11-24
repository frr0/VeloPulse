/**
 * Cloudflare Pages Function: GET /api/strava/callback
 * Exchanges Strava OAuth2 authorization code for tokens and saves them in
 * Supabase `provider_connections` using the service role key.
 */

interface Env {
  STRAVA_CLIENT_ID?: string;
  STRAVA_CLIENT_SECRET?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateRaw = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  if (oauthError) {
    return Response.redirect(`${url.origin}/?strava=cancelled`, 302);
  }

  if (
    !code ||
    !stateRaw ||
    !env.STRAVA_CLIENT_ID ||
    !env.STRAVA_CLIENT_SECRET ||
    !env.SUPABASE_URL ||
    !env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return Response.redirect(`${url.origin}/?strava=error`, 302);
  }

  let userId = '';
  try {
    const parsed = JSON.parse(atob(stateRaw)) as { userId?: string };
    userId = parsed.userId || '';
  } catch {
    return Response.redirect(`${url.origin}/?strava=invalid_state`, 302);
  }

  if (!userId) {
    return Response.redirect(`${url.origin}/?strava=invalid_state`, 302);
  }

  // Exchange authorization code for Strava tokens
  const tokenRes = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    return Response.redirect(`${url.origin}/?strava=token_error`, 302);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    athlete?: { id?: number | string };
  };

  // Upsert connection into Supabase `provider_connections`
  const upsertRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/provider_connections?on_conflict=user_id,provider`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        user_id: userId,
        provider: 'strava',
        status: 'connected',
        external_athlete_id: tokenData.athlete?.id ? String(tokenData.athlete.id) : null,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: new Date(tokenData.expires_at * 1000).toISOString(),
        scope: 'read,activity:read_all,profile:read_all',
        last_error: null,
      }),
    }
  );

  if (!upsertRes.ok) {
    return Response.redirect(`${url.origin}/?strava=db_error`, 302);
  }

  return Response.redirect(`${url.origin}/?strava=connected`, 302);
}
