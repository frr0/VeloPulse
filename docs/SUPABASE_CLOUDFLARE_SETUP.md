# Setup Guide from Scratch: Supabase (Auth + DB) + Cloudflare

This guide walks through configuring the authenticated **VeloPulse** webapp on **Supabase** + **Cloudflare**, keeping the landing page (`docs/` → `frr0.github.io/VeloPulse`) and public demo (`/demo`) cleanly separated.

---

## 1. Create a Supabase Project (Free Tier)

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New Project**, choose a name (e.g. `velopulse`), set a Postgres password, and pick the closest region (e.g. `eu-central-1` / Frankfurt).
3. Wait 1–2 minutes for the database to provision.

### 1.1 Apply the Database Schema
1. In the Supabase dashboard, open **SQL Editor → New query**.
2. Paste the full contents of `supabase/migrations/0001_initial_schema.sql`.
3. Click **Run**.
4. Verify in **Table Editor** that all 6 RLS-protected tables exist:
   - `profiles`
   - `provider_connections`
   - `activities`
   - `wellness`
   - `calendar_events`
   - `power_curves`

### 1.2 Retrieve Project URL and API Keys
1. Go to **Project Settings → API**.
2. Copy:
   - **Project URL** (`https://xxxxx.supabase.co`) → `VITE_SUPABASE_URL`
   - **Publishable / anon key** (`sb_publishable_...`) → `VITE_SUPABASE_ANON_KEY`
   - *(Optional, for server-side Strava OAuth)* **Secret / service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (server-side only, never expose in frontend!)

### 1.3 Configure Authentication
1. Go to **Authentication → Providers**:
   - **Email** is enabled by default (Email + Password).
   - *(Optional)* Enable **Google** by adding your Client ID/Secret from Google Cloud Console.
     In Google Cloud the OAuth client is a **Web application** whose only authorized redirect URI
     is `https://<project-ref>.supabase.co/auth/v1/callback` (the web app and the phone app share it).
2. Go to **Authentication → URL Configuration**:
   - **Site URL**: `https://<your-cloudflare-domain>`
   - **Redirect URLs**: add `https://<your-cloudflare-domain>/**`, `http://localhost:5173/**`, and
     `com.velopulse.app://auth-callback` (Google sign-in in the Android/iOS app returns through this link;
     without it Supabase sends the phone back to the Site URL and the app never signs in).

---

## 2. Local Development

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Add your Supabase values to `.env.local`:
   ```env
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_...
   ```
3. Start the webapp (directly or via Docker):
   ```bash
   npm run dev   # or: make up
   ```
4. Open `http://localhost:5173` to sign up / sign in, then go to **Profile → Data Sources (Supabase DB)** to connect **Intervals.icu** or import **Garmin `.FIT`** files.

---

## 3. Deploy to Cloudflare

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → connect your GitHub repository (`frr0/VeloPulse`).
2. Configure build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
3. Add **Build variables**:
   - `VITE_SUPABASE_URL` = `https://xxxxx.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `sb_publishable_...`
   - *(Do not set `VITE_DEMO_ONLY`!)*
4. Save and deploy, then make sure your Cloudflare URL is listed in **Supabase → Authentication → URL Configuration**.

---

## 4. (Optional) Enable Strava

The Worker in `worker/` serves the web app and the Strava backend (`wrangler.toml`
routes `/api/*` to it). Until a custom domain is bought, the app runs on
`velopulse.<your-account>.workers.dev` (the `name` in `wrangler.toml`).

| Endpoint | Purpose |
| :--- | :--- |
| `POST /api/strava/authorize` | Returns the Strava consent URL (signed `state` + browser-bound cookie) |
| `GET /api/strava/callback` | OAuth redirect target; stores tokens server-side (web), or sends the phone back to the app through `com.velopulse.app://strava` |
| `POST /api/strava/exchange` | Phone app only: finishes the link with the code, the app session, and the nonce the app kept |
| `POST /api/strava/sync` | Imports the last 60 days; removes activities deleted on Strava |
| `POST /api/strava/disconnect` | Revokes access on Strava and deletes all Strava data, returns a confirmation |
| `GET/POST /api/strava/webhook` | Strava push events: new/updated/deleted activities, deauthorization |

Steps:

1. Apply `supabase/migrations/0002_protect_oauth_tokens.sql` (tokens become unreadable from the browser).
   Strava tokens are also encrypted (AES-256-GCM) by the Worker with `STRAVA_TOKEN_KEY`, which never
   reaches Supabase: the dashboard and database dumps only show `v1:…` ciphertext. Losing or rotating
   the key only means users have to press "Connect Strava" again.
2. Create an app at [strava.com/settings/api](https://www.strava.com/settings/api).
   **Authorization Callback Domain** = the host only, e.g. `velopulse.<your-account>.workers.dev`
   (`localhost` is always allowed for local testing). When you switch to a custom domain, change it here.
3. Set the secrets:
   ```bash
   npx wrangler secret put STRAVA_CLIENT_ID
   npx wrangler secret put STRAVA_CLIENT_SECRET
   openssl rand -base64 32 | npx wrangler secret put STRAVA_STATE_SECRET
   openssl rand -base64 32 | npx wrangler secret put STRAVA_TOKEN_KEY   # encrypts Strava tokens in the DB
   openssl rand -hex 16    | npx wrangler secret put STRAVA_WEBHOOK_VERIFY_TOKEN   # note the value
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   ```
4. Deploy: every push to `master` is deployed by `.github/workflows/deploy.yml`
   (tests, build, `wrangler deploy`). It needs, in GitHub -> Settings -> Secrets and variables -> Actions:
   - secret `CLOUDFLARE_API_TOKEN` (Cloudflare token from the "Edit Cloudflare Workers" template)
   - variables `CLOUDFLARE_ACCOUNT_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (public values)

   Manual deploy from a local checkout is still possible with `npm run worker:deploy`.
5. Register the webhook once (one subscription per Strava app):
   ```bash
   curl -X POST https://www.strava.com/api/v3/push_subscriptions \
     -F client_id=$STRAVA_CLIENT_ID -F client_secret=$STRAVA_CLIENT_SECRET \
     -F callback_url=https://velopulse.<your-account>.workers.dev/api/strava/webhook \
     -F verify_token=<the STRAVA_WEBHOOK_VERIFY_TOKEN value>
   ```
   Strava answers `{"id": N}`; optionally store it with
   `npx wrangler secret put STRAVA_WEBHOOK_SUBSCRIPTION_ID` so other events are ignored.
   After a domain change: delete the subscription (`DELETE /push_subscriptions/N`) and create it again.
6. Local testing: put the same values in `.dev.vars` and run `npm run worker:dev`
   (the Vite dev server alone does not run `/api/*`).
