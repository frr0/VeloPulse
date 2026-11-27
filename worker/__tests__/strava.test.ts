import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../index';
import type { ConfiguredEnv } from '../env';
import { decryptToken, encryptToken } from '../crypto';
import { handleWebhookValidation, processWebhookEvent } from '../strava/handlers';
import { signState, verifyState } from '../strava/state';

const SECRET = 'test-secret-test-secret-test-secret';
const TOKEN_KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
const OTHER_KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));

const env: ConfiguredEnv = {
  ASSETS: { fetch: async () => new Response('asset') },
  STRAVA_CLIENT_ID: '1',
  STRAVA_CLIENT_SECRET: 'cs',
  STRAVA_STATE_SECRET: SECRET,
  STRAVA_TOKEN_KEY: TOKEN_KEY,
  STRAVA_WEBHOOK_VERIFY_TOKEN: 'verify-me',
  SUPABASE_URL: 'https://db.example',
  SUPABASE_SERVICE_ROLE_KEY: 'srk',
};

afterEach(() => vi.unstubAllGlobals());

describe('OAuth state', () => {
  const now = 1_000_000;
  const payload = { uid: 'user-1', nonce: 'n1', exp: now + 600 };

  it('accepts a valid state with the matching cookie nonce', async () => {
    const state = await signState(payload, SECRET);
    expect(await verifyState(state, 'n1', SECRET, now)).toEqual(payload);
  });

  it('rejects a state opened in another browser (no or different cookie)', async () => {
    const state = await signState(payload, SECRET);
    expect(await verifyState(state, null, SECRET, now)).toBeNull();
    expect(await verifyState(state, 'other', SECRET, now)).toBeNull();
  });

  it('rejects expired, tampered or unsigned states', async () => {
    const state = await signState(payload, SECRET);
    expect(await verifyState(state, 'n1', SECRET, now + 601)).toBeNull();
    expect(await verifyState(state, 'n1', 'wrong-secret', now)).toBeNull();

    const forgedBody = btoa(JSON.stringify({ ...payload, uid: 'victim' })).replace(/=+$/, '');
    expect(await verifyState(`${forgedBody}.${state.split('.')[1]}`, 'n1', SECRET, now)).toBeNull();
    expect(await verifyState(btoa(JSON.stringify(payload)), 'n1', SECRET, now)).toBeNull();
  });
});

describe('token encryption', () => {
  it('round-trips and never stores the plaintext', async () => {
    const stored = await encryptToken('secret-token', TOKEN_KEY, 'user-1');
    expect(stored.startsWith('v1:')).toBe(true);
    expect(stored).not.toContain('secret-token');
    expect(await decryptToken(stored, TOKEN_KEY, 'user-1')).toBe('secret-token');
  });

  it('uses a fresh IV for every encryption', async () => {
    const a = await encryptToken('same', TOKEN_KEY, 'user-1');
    const b = await encryptToken('same', TOKEN_KEY, 'user-1');
    expect(a).not.toBe(b);
  });

  it('fails with the wrong key or when copied to another user row', async () => {
    const stored = await encryptToken('secret-token', TOKEN_KEY, 'user-1');
    await expect(decryptToken(stored, OTHER_KEY, 'user-1')).rejects.toThrow();
    await expect(decryptToken(stored, TOKEN_KEY, 'user-2')).rejects.toThrow();
  });

  it('passes legacy plaintext through and re-encrypts it in the database', async () => {
    expect(await decryptToken('old-plain', TOKEN_KEY, 'user-1')).toBe('old-plain');

    const calls = stubBackend({ activityOnStrava: true });
    await processWebhookEvent(env, event({}));
    const patch = calls.bodies.find((b) => b.includes('refresh_token'));
    expect(patch).toBeDefined();
    const parsed = JSON.parse(patch!);
    expect(parsed.access_token.startsWith('v1:')).toBe(true);
    expect(parsed.refresh_token.startsWith('v1:')).toBe(true);
    expect(await decryptToken(parsed.refresh_token, TOKEN_KEY, 'user-1')).toBe('rt');
  });
});

describe('webhook validation', () => {
  const url = (token: string) =>
    `https://app.example/api/strava/webhook?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=abc`;

  it('echoes the challenge only with the right verify token', async () => {
    const ok = handleWebhookValidation(new Request(url('verify-me')), env);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ 'hub.challenge': 'abc' });
    expect(handleWebhookValidation(new Request(url('nope')), env).status).toBe(403);
  });
});

/** Fake Supabase + Strava backed by in-memory state, recording every call. */
function stubBackend(opts: { activityOnStrava: boolean; tokenRevoked?: boolean }) {
  const calls: string[] = [];
  const bodies: string[] = [];
  const connection = {
    user_id: 'user-1',
    external_athlete_id: '42',
    access_token: 'at',
    refresh_token: 'rt',
    token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
  };
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || 'GET';
    calls.push(`${method} ${url}`);
    if (typeof init?.body === 'string') bodies.push(init.body);
    if (url.startsWith('https://db.example/rest/v1/provider_connections') && method === 'GET') {
      return Response.json([connection]);
    }
    if (url.startsWith('https://db.example/rest/v1/') && method === 'DELETE') {
      return Response.json([{ id: 'x' }]);
    }
    if (url.startsWith('https://db.example/rest/v1/')) return new Response(null, { status: 201 });
    if (url === 'https://www.strava.com/api/v3/athlete') {
      return new Response(null, { status: opts.tokenRevoked ? 401 : 200 });
    }
    if (url.startsWith('https://www.strava.com/api/v3/activities/')) {
      return opts.activityOnStrava
        ? Response.json({ id: 7, name: 'Ride', start_date_local: '2026-11-20T08:00:00Z' })
        : new Response(null, { status: 404 });
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  });
  return Object.assign(calls, { bodies });
}

const event = (over: Partial<Parameters<typeof processWebhookEvent>[1]>) => ({
  object_type: 'activity' as const,
  object_id: 7,
  aspect_type: 'create' as const,
  owner_id: 42,
  subscription_id: 1,
  ...over,
});

describe('webhook events', () => {
  it('imports a created activity after fetching it from Strava', async () => {
    const calls = stubBackend({ activityOnStrava: true });
    await processWebhookEvent(env, event({}));
    expect(calls.some((c) => c.startsWith('POST https://db.example/rest/v1/activities'))).toBe(true);
  });

  it('deletes an activity only when Strava confirms it is gone', async () => {
    const goneCalls = stubBackend({ activityOnStrava: false });
    await processWebhookEvent(env, event({ aspect_type: 'delete' }));
    expect(goneCalls.some((c) => c.startsWith('DELETE https://db.example/rest/v1/activities'))).toBe(true);

    const forgedCalls = stubBackend({ activityOnStrava: true });
    await processWebhookEvent(env, event({ aspect_type: 'delete' }));
    expect(forgedCalls.some((c) => c.startsWith('DELETE'))).toBe(false);
  });

  it('purges all Strava data on a confirmed deauthorization', async () => {
    const calls = stubBackend({ activityOnStrava: true, tokenRevoked: true });
    await processWebhookEvent(
      env,
      event({ object_type: 'athlete', aspect_type: 'update', updates: { authorized: 'false' } })
    );
    expect(calls.some((c) => c.startsWith('DELETE https://db.example/rest/v1/activities'))).toBe(true);
    expect(calls.some((c) => c.startsWith('DELETE https://db.example/rest/v1/provider_connections'))).toBe(true);
  });

  it('ignores a forged deauthorization while the token still works', async () => {
    const calls = stubBackend({ activityOnStrava: true, tokenRevoked: false });
    await processWebhookEvent(
      env,
      event({ object_type: 'athlete', aspect_type: 'update', updates: { authorized: 'false' } })
    );
    expect(calls.some((c) => c.startsWith('DELETE'))).toBe(false);
  });
});

describe('router', () => {
  const ctx = { waitUntil: () => undefined };

  it('serves the app for non-API paths and 404s unknown API routes', async () => {
    const page = await worker.fetch(new Request('https://app.example/activities'), env, ctx);
    expect(await page.text()).toBe('asset');
    const missing = await worker.fetch(new Request('https://app.example/api/nope'), env, ctx);
    expect(missing.status).toBe(404);
  });

  it('requires a session for authorize, sync and disconnect', async () => {
    for (const path of ['authorize', 'sync', 'disconnect']) {
      const res = await worker.fetch(
        new Request(`https://app.example/api/strava/${path}`, { method: 'POST' }),
        env,
        ctx
      );
      expect(res.status).toBe(401);
    }
  });
});
