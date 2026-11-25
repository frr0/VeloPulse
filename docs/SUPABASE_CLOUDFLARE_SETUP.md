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
2. Go to **Authentication → URL Configuration**:
   - **Site URL**: `https://<your-cloudflare-domain>`
   - **Redirect URLs**: add both `https://<your-cloudflare-domain>/**` and `http://localhost:5173/**`.

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

## 4. (Optional) Enable Strava OAuth via Cloudflare Pages Functions

The repository includes ready-to-use **Cloudflare Pages Functions** in `functions/api/strava/`:
- `GET /api/strava/auth`
- `GET /api/strava/callback`
- `POST /api/strava/sync`

To enable them:
1. Create an app at [strava.com/settings/api](https://www.strava.com/settings/api) and set **Authorization Callback Domain** to your Cloudflare domain.
2. Add encrypted environment variables on Cloudflare Pages:
   - `STRAVA_CLIENT_ID`
   - `STRAVA_CLIENT_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Redeploy to activate the **Connect Strava** button in Profile.
