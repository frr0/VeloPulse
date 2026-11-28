/**
 * Strava endpoints.
 *
 *   POST /api/strava/authorize   start OAuth; returns { url } (session JWT in the Authorization header)
 *   GET  /api/strava/callback    OAuth redirect target registered on Strava
 *   POST /api/strava/exchange    phone app only: finish OAuth with the code the callback handed back
 *   POST /api/strava/sync        import recent activities, drop the ones deleted on Strava
 *   POST /api/strava/disconnect  revoke access on Strava and delete every Strava-derived row
 *   GET  /api/strava/webhook     Strava subscription validation (hub.challenge)
 *   POST /api/strava/webhook     Strava push events (create / update / delete / deauthorize)
 *
 * Strava API Policy points covered here:
 *   2.5 / 7.4  deletion on revocation, with a confirmation returned to the user
 *   6.3        deletions on Strava reflected within 48h (webhook + sync reconciliation)
 *   5.16 / 8.1 tokens stay server-side, signed state, no token in URLs
 */
import { isConfigured, type ConfiguredEnv, type Env, type WorkerContext } from '../env';
import { bearerToken, json, readCookie, redirectToApp, redirectToNativeApp } from '../http';
import { SupabaseAdmin, type StravaConnection } from '../supabase';
import {
  STRAVA_SCOPE,
  StravaAuthRevokedError,
  deauthorize,
  ensureAccessToken,
  exchangeCode,
  getActivity,
  listActivities,
  mapActivityRow,
} from './api';
import {
  STATE_COOKIE,
  STATE_TTL_SECONDS,
  clearStateCookie,
  randomNonce,
  readState,
  signState,
  stateCookie,
  verifyState,
} from './state';

const SYNC_WINDOW_DAYS = 60;
const SYNC_PAGE_SIZE = 100;
const SYNC_MAX_PAGES = 5;

const notConfigured = () =>
  json({ error: 'Strava is not configured on this deployment.' }, 503);

async function requireUser(
  request: Request,
  db: SupabaseAdmin
): Promise<{ userId: string } | { response: Response }> {
  const jwt = bearerToken(request);
  if (!jwt) return { response: json({ error: 'Missing Authorization header.' }, 401) };
  const userId = await db.userIdFromJwt(jwt);
  if (!userId) return { response: json({ error: 'Invalid session.' }, 401) };
  return { userId };
}

/** Deletes every Strava-derived row of a user (Policy 7.4). */
export async function purgeStravaData(db: SupabaseAdmin, userId: string): Promise<number> {
  const deleted = await db.deleteStravaActivities(userId);
  await db.deleteStravaConnection(userId);
  return deleted;
}

// --- OAuth ---------------------------------------------------------------------

/** Body of `/api/strava/authorize`; `{ app: true }` when the phone app starts the flow. */
async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function handleAuthorize(request: Request, env: Env): Promise<Response> {
  if (!isConfigured(env)) return notConfigured();
  const db = new SupabaseAdmin(env);
  const auth = await requireUser(request, db);
  if ('response' in auth) return auth.response;

  const fromApp = (await readJsonBody(request)).app === true;
  const origin = new URL(request.url).origin;
  const nonce = randomNonce();
  const state = await signState(
    {
      uid: auth.userId,
      nonce,
      exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
      ...(fromApp ? { app: true } : {}),
    },
    env.STRAVA_STATE_SECRET
  );

  const url = new URL('https://www.strava.com/oauth/authorize');
  url.searchParams.set('client_id', env.STRAVA_CLIENT_ID);
  url.searchParams.set('redirect_uri', `${origin}/api/strava/callback`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('approval_prompt', 'auto');
  url.searchParams.set('scope', STRAVA_SCOPE);
  url.searchParams.set('state', state);

  // The app keeps the nonce itself (the system browser that opens Strava does
  // not share cookies with the app); the web keeps it in an HttpOnly cookie.
  if (fromApp) return json({ url: url.toString(), nonce });
  return json({ url: url.toString() }, 200, { 'Set-Cookie': stateCookie(nonce) });
}

function hasActivityScope(scope: string): string[] | null {
  // Strava lets the user untick scopes on the consent page.
  const granted = scope.split(',');
  return granted.includes('activity:read_all') || granted.includes('activity:read') ? granted : null;
}

/** Exchanges the code and stores the connection. Returns the status for the UI. */
async function linkStrava(
  env: ConfiguredEnv,
  userId: string,
  code: string,
  granted: string[]
): Promise<'connected' | 'token_error' | 'db_error'> {
  const tokens = await exchangeCode(env, code);
  if (!tokens) return 'token_error';

  const db = new SupabaseAdmin(env);
  try {
    await db.upsertStravaConnection({
      user_id: userId,
      status: 'connected',
      external_athlete_id: tokens.athlete?.id != null ? String(tokens.athlete.id) : null,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(tokens.expires_at * 1000).toISOString(),
      scope: granted.join(','),
      last_error: null,
    });
  } catch {
    return 'db_error';
  }
  return 'connected';
}

export async function handleCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const origin = url.origin;
  const clear = { 'Set-Cookie': clearStateCookie() };

  if (!isConfigured(env)) return redirectToApp(origin, 'error', clear);

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // A flow started by the phone app goes back to the app, which finishes it
  // through /api/strava/exchange with its session and its nonce. Nothing is
  // linked here: the state is only read to choose where to send the browser.
  const appState = state ? await readState(state, env.STRAVA_STATE_SECRET) : null;
  if (appState?.app) {
    if (url.searchParams.get('error')) return redirectToNativeApp('cancelled');
    if (!code || !state) return redirectToNativeApp('error');
    if (!hasActivityScope(url.searchParams.get('scope') || '')) return redirectToNativeApp('missing_scope');
    return redirectToNativeApp('authorized', {
      code,
      state,
      scope: url.searchParams.get('scope') || '',
    });
  }

  if (url.searchParams.get('error')) return redirectToApp(origin, 'cancelled', clear);
  if (!code || !state) return redirectToApp(origin, 'error', clear);

  const payload = await verifyState(state, readCookie(request, STATE_COOKIE), env.STRAVA_STATE_SECRET);
  if (!payload || payload.app) return redirectToApp(origin, 'invalid_state', clear);

  const granted = hasActivityScope(url.searchParams.get('scope') || '');
  if (!granted) return redirectToApp(origin, 'missing_scope', clear);

  return redirectToApp(origin, await linkStrava(env, payload.uid, code, granted), clear);
}

/**
 * Phone app only. Finishes the OAuth flow the callback handed back to the app.
 * The state must be signed, unexpired, issued for the app, carry the nonce the
 * app kept, and belong to the signed-in user: a consent link started by someone
 * else cannot attach their Strava account to this profile, nor this one to theirs.
 */
export async function handleExchange(request: Request, env: Env): Promise<Response> {
  if (!isConfigured(env)) return notConfigured();
  const db = new SupabaseAdmin(env);
  const auth = await requireUser(request, db);
  if ('response' in auth) return auth.response;

  const body = await readJsonBody(request);
  const str = (key: string) => (typeof body[key] === 'string' ? (body[key] as string) : '');
  const code = str('code');
  const state = str('state');
  if (!code || !state) return json({ error: 'Missing code or state.' }, 400);

  const payload = await verifyState(state, str('nonce') || null, env.STRAVA_STATE_SECRET);
  if (!payload || !payload.app || payload.uid !== auth.userId) {
    return json({ status: 'invalid_state', error: 'The Strava authorization expired or was started elsewhere.' }, 400);
  }

  const granted = hasActivityScope(str('scope'));
  if (!granted) return json({ status: 'missing_scope', error: 'Strava activity permission was not granted.' }, 400);

  const status = await linkStrava(env, auth.userId, code, granted);
  if (status !== 'connected') return json({ status, error: 'Could not finish connecting Strava.' }, 502);
  return json({ status });
}

// --- Sync ----------------------------------------------------------------------

export async function handleSync(request: Request, env: Env): Promise<Response> {
  if (!isConfigured(env)) return notConfigured();
  const db = new SupabaseAdmin(env);
  const auth = await requireUser(request, db);
  if ('response' in auth) return auth.response;

  const conn = await db.getStravaConnection(auth.userId);
  if (!conn) return json({ error: 'Strava account is not connected.' }, 404);

  try {
    const result = await syncUser(env, db, conn);
    return json(result);
  } catch (err) {
    if (err instanceof StravaAuthRevokedError) {
      const deleted = await purgeStravaData(db, auth.userId);
      return json(
        {
          error:
            'Strava access was revoked from Strava. Your Strava data has been deleted from this app.',
          deleted_activities: deleted,
        },
        410
      );
    }
    const message = err instanceof Error ? err.message : 'Strava sync failed.';
    await db.patchStravaConnection(auth.userId, { last_error: message }).catch(() => undefined);
    return json({ error: message }, 502);
  }
}

async function syncUser(
  env: ConfiguredEnv,
  db: SupabaseAdmin,
  conn: StravaConnection
): Promise<{ synced: number; removed: number }> {
  const token = await ensureAccessToken(env, db, conn);
  const afterEpoch = Math.floor((Date.now() - SYNC_WINDOW_DAYS * 86400 * 1000) / 1000);

  const fetched: Array<Record<string, any>> = [];
  let complete = false;
  for (let page = 1; page <= SYNC_MAX_PAGES; page++) {
    const batch = await listActivities(token, afterEpoch, page, SYNC_PAGE_SIZE);
    fetched.push(...batch);
    if (batch.length < SYNC_PAGE_SIZE) {
      complete = true;
      break;
    }
  }

  await db.upsertActivities(fetched.map((a) => mapActivityRow(conn.user_id, a)));

  // Reconciliation (Policy 6.3): rows in the window that Strava no longer
  // returns were deleted (or made invisible) on Strava. Only safe when the
  // whole window was read. One day of margin avoids time zone edge cases.
  let removed = 0;
  if (complete) {
    const since = new Date((afterEpoch + 86400) * 1000).toISOString();
    const stored = await db.listStravaActivityIdsSince(conn.user_id, since);
    const live = new Set(fetched.map((a) => String(a.id)));
    removed = await db.deleteStravaActivities(
      conn.user_id,
      stored.filter((id) => !live.has(id))
    );
  }

  await db.patchStravaConnection(conn.user_id, {
    status: 'connected',
    last_synced_at: new Date().toISOString(),
    last_error: null,
  });
  return { synced: fetched.length, removed };
}

// --- Disconnect ----------------------------------------------------------------

export async function handleDisconnect(request: Request, env: Env): Promise<Response> {
  if (!isConfigured(env)) return notConfigured();
  const db = new SupabaseAdmin(env);
  const auth = await requireUser(request, db);
  if ('response' in auth) return auth.response;

  const conn = await db.getStravaConnection(auth.userId);
  if (conn) {
    try {
      await deauthorize(await ensureAccessToken(env, db, conn));
    } catch {
      // Already revoked or Strava unreachable: the local deletion below still runs.
    }
  }

  const deleted = await purgeStravaData(db, auth.userId);
  const deletedAt = new Date().toISOString();
  return json({
    disconnected: true,
    deleted_activities: deleted,
    deleted_at: deletedAt,
    message: `Strava disconnected. ${deleted} Strava activities and your Strava tokens were permanently deleted on ${deletedAt}.`,
  });
}

// --- Webhook -------------------------------------------------------------------

export function handleWebhookValidation(request: Request, env: Env): Response {
  const params = new URL(request.url).searchParams;
  const token = env.STRAVA_WEBHOOK_VERIFY_TOKEN;
  if (
    !token ||
    params.get('hub.mode') !== 'subscribe' ||
    params.get('hub.verify_token') !== token ||
    !params.get('hub.challenge')
  ) {
    return json({ error: 'Forbidden' }, 403);
  }
  return json({ 'hub.challenge': params.get('hub.challenge') });
}

export interface StravaWebhookEvent {
  object_type: 'activity' | 'athlete';
  object_id: number;
  aspect_type: 'create' | 'update' | 'delete';
  owner_id: number;
  subscription_id: number;
  updates?: Record<string, string>;
}

export async function handleWebhookEvent(
  request: Request,
  env: Env,
  ctx: WorkerContext
): Promise<Response> {
  if (!isConfigured(env)) return notConfigured();

  let event: StravaWebhookEvent;
  try {
    event = (await request.json()) as StravaWebhookEvent;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (
    env.STRAVA_WEBHOOK_SUBSCRIPTION_ID &&
    String(event.subscription_id) !== env.STRAVA_WEBHOOK_SUBSCRIPTION_ID
  ) {
    return json({ ignored: true });
  }

  // Strava wants a 200 within 2 seconds; the work continues in the background.
  ctx.waitUntil(processWebhookEvent(env, event).catch(() => undefined));
  return json({ received: true });
}

/**
 * Webhook events are not signed by Strava, so the event is never trusted on
 * its own: every action is confirmed against the Strava API first. A forged
 * "delete" or "deauthorize" therefore cannot remove data that still exists.
 */
export async function processWebhookEvent(
  env: ConfiguredEnv,
  event: StravaWebhookEvent
): Promise<void> {
  const db = new SupabaseAdmin(env);
  const conn = await db.getStravaConnectionByAthlete(String(event.owner_id));
  if (!conn) return;

  let token: string;
  try {
    token = await ensureAccessToken(env, db, conn);
  } catch (err) {
    if (err instanceof StravaAuthRevokedError) await purgeStravaData(db, conn.user_id);
    return;
  }

  try {
    if (event.object_type === 'athlete') {
      if (event.updates?.authorized === 'false') {
        // Confirm: with access revoked, Strava rejects the token.
        const res = await fetch('https://www.strava.com/api/v3/athlete', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) await purgeStravaData(db, conn.user_id);
      }
      return;
    }

    if (event.object_type === 'activity') {
      const id = String(event.object_id);
      const activity = await getActivity(token, id);
      if (activity) {
        if (event.aspect_type !== 'delete') {
          await db.upsertActivities([mapActivityRow(conn.user_id, activity)]);
        }
      } else {
        await db.deleteStravaActivities(conn.user_id, [id]);
      }
    }
  } catch (err) {
    if (err instanceof StravaAuthRevokedError) await purgeStravaData(db, conn.user_id);
    else throw err;
  }
}
