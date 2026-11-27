/**
 * Minimal Supabase access for the Worker.
 *
 * Uses the service role key, which bypasses RLS, so every query here must
 * filter by the user id it was given. Never forward these responses to the
 * browser as they are.
 *
 * OAuth tokens are encrypted before they are written and decrypted after they
 * are read (see crypto.ts): callers only ever handle plaintext tokens, the
 * database only ever stores ciphertext.
 */
import { decryptToken, encryptToken, isEncrypted } from './crypto';
import type { ConfiguredEnv } from './env';

export interface StravaConnection {
  user_id: string;
  external_athlete_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
}

const TOKEN_FIELDS = ['access_token', 'refresh_token'] as const;
const CONNECTION_COLUMNS = 'user_id,external_athlete_id,access_token,refresh_token,token_expires_at';

export class SupabaseAdmin {
  constructor(private readonly env: ConfiguredEnv) {}

  /** Returns a copy of `fields` with token values encrypted for `userId`. */
  private async encryptTokens(
    userId: string,
    fields: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const out = { ...fields };
    for (const name of TOKEN_FIELDS) {
      const value = out[name];
      if (typeof value === 'string' && value) {
        out[name] = await encryptToken(value, this.env.STRAVA_TOKEN_KEY, userId);
      }
    }
    return out;
  }

  /** Decrypts a stored row; legacy plaintext tokens are re-encrypted in place. */
  private async decryptConnection(row: StravaConnection | undefined): Promise<StravaConnection | null> {
    if (!row) return null;
    const conn = { ...row };
    let legacy = false;
    for (const name of TOKEN_FIELDS) {
      const value = conn[name];
      if (!value) continue;
      if (!isEncrypted(value)) legacy = true;
      conn[name] = await decryptToken(value, this.env.STRAVA_TOKEN_KEY, conn.user_id);
    }
    if (legacy) {
      await this.patchStravaConnection(conn.user_id, {
        access_token: conn.access_token,
        refresh_token: conn.refresh_token,
      }).catch(() => undefined);
    }
    return conn;
  }

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
        `&select=${CONNECTION_COLUMNS}`
    );
    const rows = (await res.json()) as StravaConnection[];
    return this.decryptConnection(rows[0]);
  }

  async getStravaConnectionByAthlete(athleteId: string): Promise<StravaConnection | null> {
    const res = await this.rest(
      `provider_connections?external_athlete_id=eq.${encodeURIComponent(athleteId)}&provider=eq.strava` +
        `&select=${CONNECTION_COLUMNS}`
    );
    const rows = (await res.json()) as StravaConnection[];
    return this.decryptConnection(rows[0]);
  }

  async upsertStravaConnection(row: Record<string, unknown> & { user_id: string }): Promise<void> {
    const body = await this.encryptTokens(row.user_id, { ...row, provider: 'strava' });
    await this.rest('provider_connections?on_conflict=user_id,provider', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(body),
    });
  }

  async patchStravaConnection(userId: string, patch: Record<string, unknown>): Promise<void> {
    const body = await this.encryptTokens(userId, patch);
    await this.rest(
      `provider_connections?user_id=eq.${encodeURIComponent(userId)}&provider=eq.strava`,
      { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) }
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
