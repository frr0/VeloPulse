/**
 * Worker entry point.
 *
 * `/api/*` is handled here (wrangler.toml sets `run_worker_first = ["/api/*"]`);
 * everything else is the static web app served from the ASSETS binding.
 */
import type { Env, WorkerContext } from './env';
import { json } from './http';
import {
  handleAuthorize,
  handleCallback,
  handleDisconnect,
  handleSync,
  handleWebhookEvent,
  handleWebhookValidation,
} from './strava/handlers';

type Handler = (request: Request, env: Env, ctx: WorkerContext) => Response | Promise<Response>;

const routes: Record<string, Handler> = {
  'POST /api/strava/authorize': handleAuthorize,
  'GET /api/strava/callback': handleCallback,
  'POST /api/strava/sync': handleSync,
  'POST /api/strava/disconnect': handleDisconnect,
  'GET /api/strava/webhook': handleWebhookValidation,
  'POST /api/strava/webhook': handleWebhookEvent,
};

export default {
  async fetch(request: Request, env: Env, ctx: WorkerContext): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    const handler = routes[`${request.method} ${pathname.replace(/\/+$/, '')}`];
    if (!handler) return json({ error: 'Not found' }, 404);

    try {
      return await handler(request, env, ctx);
    } catch (err) {
      console.error(pathname, err);
      return json({ error: 'Internal error' }, 500);
    }
  },
};
