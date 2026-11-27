/**
 * Minimal Supabase access for the Worker.
 *
 * Uses the service role key, which bypasses RLS, so every query here must
 * filter by the user id it was given. Never forward these responses to the
 * browser as they are.
 */
import type { ConfiguredEnv } from './env';

export interface StravaConnection {
  user_id: string;
  external_athlete_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
}

export class SupabaseAdmin {
  constructor(private readonly env: ConfiguredEnv) {}

  private headers(extra: HeadersInit = {}): HeadersInit {
    return {
      'Content-Type': 'application/json',
      apikey: this.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${this.env.SUPABASE_SERVICE_ROLE_KEY}`,
      ...extra,
    };
  }

  private async rest(path: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetch(`${this.env.SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      headers: this.headers(init.headers),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Supabase ${init.method || 'GET'} ${path.split('?')[0]} failed (${res.status}) ${detail}`);
    }
    return res;
  }

  /** Verifies a Supabase session JWT and returns the user id, or null. */
  async userIdFromJwt(jwt: string): Promise<string | null> {
    const res = await fetch(`${this.env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${jwt}`, apikey: this.env.SUPABASE_SERVICE_ROLE_KEY },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: string };
    return user.id || null;
  }

  async getStravaConnection(userId: string): Promise<StravaConnection | null> {
    const res = await this.rest(
      `provider_connections?user_id=eq.${encodeURIComponent(userId)}&provider=eq.strava` +
        '&select=user_id,external_athlete_id,access_token,refresh_token,token_expires_at'
    );
    const rows = (await res.json()) as StravaConnection[];
    return rows[0] ?? null;
  }

  async getStravaConnectionByAthlete(athleteId: string): Promise<StravaConnection | null> {
    const res = await this.rest(
      `provider_connections?external_athlete_id=eq.${encodeURIComponent(athleteId)}&provider=eq.strava` +
        '&select=user_id,external_athlete_id,access_token,refresh_token,token_expires_at'
    );
    const rows = (await res.json()) as StravaConnection[];
    return rows[0] ?? null;
  }

  async upsertStravaConnection(row: Record<string, unknown>): Promise<void> {
    await this.rest('provider_connections?on_conflict=user_id,provider', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ ...row, provider: 'strava' }),
    });
  }

  async patchStravaConnection(userId: string, patch: Record<string, unknown>): Promise<void> {
    await this.rest(
      `provider_connections?user_id=eq.${encodeURIComponent(userId)}&provider=eq.strava`,
      { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) }
    );
  }

  async upsertActivities(rows: Record<string, unknown>[]): Promise<void> {
    if (rows.length === 0) return;
    await this.rest('activities?on_conflict=user_id,provider,external_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    });
  }

  /** External ids of the user's Strava activities that started on or after `sinceIso`. */
  async listStravaActivityIdsSince(userId: string, sinceIso: string): Promise<string[]> {
    const res = await this.rest(
      `activities?user_id=eq.${encodeURIComponent(userId)}&provider=eq.strava` +
        `&start_date_local=gte.${encodeURIComponent(sinceIso)}&select=external_id`
    );
    const rows = (await res.json()) as Array<{ external_id: string }>;
    return rows.map((r) => r.external_id);
  }

  /** Deletes some (or, without ids, all) of the user's Strava activities. Returns how many. */
  async deleteStravaActivities(userId: string, externalIds?: string[]): Promise<number> {
    if (externalIds && externalIds.length === 0) return 0;
    let path = `activities?user_id=eq.${encodeURIComponent(userId)}&provider=eq.strava`;
    if (externalIds) {
      const list = externalIds.map((id) => encodeURIComponent(id.replace(/[^0-9]/g, ''))).join(',');
      path += `&external_id=in.(${list})`;
    }
    const res = await this.rest(`${path}&select=id`, {
      method: 'DELETE',
      headers: { Prefer: 'return=representation' },
    });
    const deleted = (await res.json()) as unknown[];
    return deleted.length;
  }

  async deleteStravaConnection(userId: string): Promise<void> {
    await this.rest(
      `provider_connections?user_id=eq.${encodeURIComponent(userId)}&provider=eq.strava`,
      { method: 'DELETE', headers: { Prefer: 'return=minimal' } }
    );
  }
}
