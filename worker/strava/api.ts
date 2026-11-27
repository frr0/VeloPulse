/**
 * Strava API calls and the mapping of Strava activities to `activities` rows.
 */
import type { ConfiguredEnv } from '../env';
import type { StravaConnection, SupabaseAdmin } from '../supabase';

const STRAVA_API = 'https://www.strava.com/api/v3';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

/** Only what the app needs: activities, including private ones. No profile scope. */
export const STRAVA_SCOPE = 'read,activity:read_all';

export interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id?: number | string };
}

/** Thrown when Strava says the user's authorization is gone (revoked or invalid). */
export class StravaAuthRevokedError extends Error {
  constructor() {
    super('Strava authorization has been revoked.');
  }
}

export async function exchangeCode(env: ConfiguredEnv, code: string): Promise<StravaTokens | null> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) return null;
  return (await res.json()) as StravaTokens;
}

/**
 * Returns a valid access token, refreshing and persisting it when it expires
 * within 5 minutes. Throws StravaAuthRevokedError when Strava rejects the
 * refresh token (the user revoked access from Strava).
 */
export async function ensureAccessToken(
  env: ConfiguredEnv,
  db: SupabaseAdmin,
  conn: StravaConnection
): Promise<string> {
  const expiresAtMs = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (conn.access_token && Date.now() < expiresAtMs - 5 * 60 * 1000) return conn.access_token;
  if (!conn.refresh_token) throw new StravaAuthRevokedError();

  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: conn.refresh_token,
    }),
  });
  if (res.status === 400 || res.status === 401) throw new StravaAuthRevokedError();
  if (!res.ok) throw new Error(`Strava token refresh failed (${res.status})`);

  const tokens = (await res.json()) as StravaTokens;
  await db.patchStravaConnection(conn.user_id, {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: new Date(tokens.expires_at * 1000).toISOString(),
  });
  return tokens.access_token;
}

async function stravaGet(token: string, path: string): Promise<Response> {
  const res = await fetch(`${STRAVA_API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new StravaAuthRevokedError();
  return res;
}

export async function listActivities(
  token: string,
  afterEpoch: number,
  page: number,
  perPage: number
): Promise<Array<Record<string, any>>> {
  const res = await stravaGet(
    token,
    `/athlete/activities?after=${afterEpoch}&per_page=${perPage}&page=${page}`
  );
  if (!res.ok) throw new Error(`Strava API error (${res.status})`);
  return (await res.json()) as Array<Record<string, any>>;
}

/** Fetches one activity. `null` means Strava no longer has it (deleted or not visible). */
export async function getActivity(token: string, id: string): Promise<Record<string, any> | null> {
  const res = await stravaGet(token, `/activities/${encodeURIComponent(id)}`);
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`Strava API error (${res.status})`);
  return (await res.json()) as Record<string, any>;
}

/** Revokes the app's access on Strava. Best effort: failures are ignored. */
export async function deauthorize(token: string): Promise<void> {
  await fetch('https://www.strava.com/oauth/deauthorize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

/**
 * Maps a Strava activity to an `activities` row.
 *
 * Data minimisation: only the columns the app shows are kept. The full Strava
 * payload is not stored (`raw_data` stays empty).
 */
export function mapActivityRow(userId: string, a: Record<string, any>): Record<string, unknown> {
  return {
    user_id: userId,
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
    raw_data: {},
  };
}
