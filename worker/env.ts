/**
 * Bindings and secrets available to the Worker.
 *
 * Secrets are set with `wrangler secret put <NAME>` and never reach the browser.
 */
export interface Env {
  /** Static assets binding declared in wrangler.toml (`[assets] binding = "ASSETS"`). */
  ASSETS: { fetch(request: Request): Promise<Response> };

  STRAVA_CLIENT_ID?: string;
  STRAVA_CLIENT_SECRET?: string;
  /** Random secret (32+ bytes) used to sign the OAuth `state` parameter. */
  STRAVA_STATE_SECRET?: string;
  /** Token chosen by you when creating the Strava webhook subscription. */
  STRAVA_WEBHOOK_VERIFY_TOKEN?: string;
  /** Optional: id returned by Strava when the subscription was created. Events with another id are ignored. */
  STRAVA_WEBHOOK_SUBSCRIPTION_ID?: string;

  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

/** The subset of the Workers ExecutionContext the code uses. */
export interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

/** Env after the configuration check: every Strava/Supabase value is present. */
export type ConfiguredEnv = Env & {
  STRAVA_CLIENT_ID: string;
  STRAVA_CLIENT_SECRET: string;
  STRAVA_STATE_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

export function isConfigured(env: Env): env is ConfiguredEnv {
  return Boolean(
    env.STRAVA_CLIENT_ID &&
      env.STRAVA_CLIENT_SECRET &&
      env.STRAVA_STATE_SECRET &&
      env.SUPABASE_URL &&
      env.SUPABASE_SERVICE_ROLE_KEY
  );
}
