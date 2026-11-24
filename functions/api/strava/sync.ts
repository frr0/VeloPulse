/**
 * Cloudflare Pages Function: POST /api/strava/sync
 * Verifies the user's Supabase JWT, refreshes Strava access token if needed,
 * fetches recent Strava activities, and upserts them into Supabase `activities`.
 */

interface Env {
  STRAVA_CLIENT_ID?: string;
  STRAVA_CLIENT_SECRET?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  if (
    !env.STRAVA_CLIENT_ID ||
    !env.STRAVA_CLIENT_SECRET ||
    !env.SUPABASE_URL ||
    !env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return new Response(
      JSON.stringify({ error: 'Strava sync is not configured on this deployment.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const authHeader = request.headers.get('Authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify Supabase user
  const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });
  if (!userRes.ok) {
    return new Response(JSON.stringify({ error: 'Invalid session.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const user = (await userRes.json()) as { id: string };

  // Load Strava connection from Supabase
  const connRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/provider_connections?user_id=eq.${user.id}&provider=eq.strava&select=*`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );
  const conns = (await connRes.json()) as Array<{
    access_token: string | null;
    refresh_token: string | null;
    token_expires_at: string | null;
  }>;
  const conn = conns?.[0];

  if (!conn || !conn.refresh_token) {
    return new Response(JSON.stringify({ error: 'Strava account is not connected.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let accessToken = conn.access_token || '';
  const expiresAtMs = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;

  // Refresh token if expired or expiring within 5 minutes
  if (!accessToken || Date.now() >= expiresAtMs - 5 * 60 * 1000) {
    const refreshRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.STRAVA_CLIENT_ID,
        client_secret: env.STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: conn.refresh_token,
      }),
    });

    if (!refreshRes.ok) {
      return new Response(JSON.stringify({ error: 'Failed to refresh Strava token.' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const refreshed = (await refreshRes.json()) as {
      access_token: string;
      refresh_token: string;
      expires_at: number;
    };
    accessToken = refreshed.access_token;

    await fetch(
      `${env.SUPABASE_URL}/rest/v1/provider_connections?user_id=eq.${user.id}&provider=eq.strava`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          token_expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
        }),
      }
    );
  }

  // Fetch last 60 days of Strava activities
  const afterEpoch = Math.floor((Date.now() - 60 * 24 * 3600 * 1000) / 1000);
  const actsRes = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${afterEpoch}&per_page=100`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!actsRes.ok) {
    return new Response(JSON.stringify({ error: `Strava API error (${actsRes.status})` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const stravaActivities = (await actsRes.json()) as Array<Record<string, any>>;

  const rows = stravaActivities.map((a) => ({
    user_id: user.id,
    provider: 'strava',
    external_id: String(a.id),
    name: a.name || 'Strava Activity',
    type: a.sport_type || a.type || 'Ride',
    start_date_local: a.start_date_local || a.start_date,
    distance_m: a.distance ?? null,
    moving_time_s: a.moving_time ?? null,
    elapsed_time_s: a.elapsed_time ?? null,
    total_elevation_gain_m: a.total_elevation_gain ?? null,
    average_speed: a.average_speed ?? null,
    max_speed: a.max_speed ?? null,
    average_heartrate: a.average_heartrate ?? null,
    max_heartrate: a.max_heartrate ?? null,
    average_watts: a.average_watts ?? null,
    weighted_average_watts: a.weighted_average_watts ?? null,
    joules: a.kilojoules ? Math.round(a.kilojoules * 1000) : null,
    average_cadence: a.average_cadence ?? null,
    indoor: Boolean(a.trainer),
    trainer: Boolean(a.trainer),
    summary_polyline: a.map?.summary_polyline ?? null,
    start_latlng: a.start_latlng?.length === 2 ? a.start_latlng : null,
    end_latlng: a.end_latlng?.length === 2 ? a.end_latlng : null,
    raw_data: a,
  }));

  if (rows.length > 0) {
    const upsertRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/activities?on_conflict=user_id,provider,external_id`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(rows),
      }
    );

    if (!upsertRes.ok) {
      return new Response(JSON.stringify({ error: 'Failed to save Strava activities to database.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  await fetch(
    `${env.SUPABASE_URL}/rest/v1/provider_connections?user_id=eq.${user.id}&provider=eq.strava`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ last_synced_at: new Date().toISOString(), last_error: null }),
    }
  );

  return new Response(JSON.stringify({ synced: rows.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
