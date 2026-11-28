/**
 * Worker entry point.
 *
 * `/api/*` is handled here (wrangler.toml sets `run_worker_first = ["/api/*"]`);
 * everything else is the static web app served from the ASSETS binding.
 */
import type { Env, WorkerContext } from './env';
import { corsHeaders, json } from './http';
import {
  handleAuthorize,
  handleCallback,
  handleDisconnect,
  handleExchange,
  handleSync,
  handleWebhookEvent,
  handleWebhookValidation,
} from './strava/handlers';

type Handler = (request: Request, env: Env, ctx: WorkerContext) => Response | Promise<Response>;

const routes: Record<string, Handler> = {
  'POST /api/strava/authorize': handleAuthorize,
  'GET /api/strava/callback': handleCallback,
  'POST /api/strava/exchange': handleExchange,
  'POST /api/strava/sync': handleSync,
  'POST /api/strava/disconnect': handleDisconnect,
  'GET /api/strava/webhook': handleWebhookValidation,
  'POST /api/strava/webhook': handleWebhookEvent,
};

function withHeaders(response: Response, headers: Record<string, string>): Response {
  if (!Object.keys(headers).length || response.status === 302) return response;
  const out = new Response(response.body, response);
  for (const [key, value] of Object.entries(headers)) out.headers.set(key, value);
  return out;
}

export default {
  async fetch(request: Request, env: Env, ctx: WorkerContext): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    // The phone app calls the API from its own WebView origin (see corsHeaders).
    const cors = corsHeaders(request);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: Object.keys(cors).length ? 204 : 403, headers: cors });
    }

    const handler = routes[`${request.method} ${pathname.replace(/\/+$/, '')}`];
    if (!handler) return withHeaders(json({ error: 'Not found' }, 404), cors);

    try {
      return withHeaders(await handler(request, env, ctx), cors);
    } catch (err) {
      console.error(pathname, err);
      return withHeaders(json({ error: 'Internal error' }, 500), cors);
    }
  },
};
