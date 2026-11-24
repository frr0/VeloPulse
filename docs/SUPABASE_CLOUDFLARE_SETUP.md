# Guida Setup da Zero: Supabase (Auth + DB) + Cloudflare Pages

Questa guida ti permette di configurare da zero la webapp autenticata di **VeloPulse** su **Supabase** + **Cloudflare Pages**, mantenendo completamente separati:
- la landing page su GitHub Pages (`docs/` → `frr0.github.io/VeloPulse`)
- la demo pubblica bloccata (`VITE_DEMO_ONLY=1` → `velopulse-demo.institorai.app`)

---

## 1. Crea il progetto su Supabase (gratis)

1. Vai su [supabase.com](https://supabase.com) e crea un account / accedi.
2. Clicca **New Project**, scegli un nome (es. `velopulse`), imposta una password per Postgres e scegli la region più vicina (es. `eu-central-1` / Francoforte).
3. Attendi 1-2 minuti che il database sia pronto.

### 1.1 Applica lo schema del database
1. Nel pannello Supabase apri **SQL Editor** → **New query**.
2. Copia l'intero contenuto del file `supabase/migrations/0001_initial_schema.sql` di questo repository.
3. Incollalo nell'editor e clicca **Run**.
4. Verifica in **Table Editor** che siano state create le 6 tabelle protette da Row Level Security (RLS):
   - `profiles`
   - `provider_connections`
   - `activities`
   - `wellness`
   - `calendar_events`
   - `power_curves`

### 1.2 Recupera URL e Chiavi API
1. Vai in **Project Settings → API**.
2. Copia:
   - **Project URL** (`https://xxxxx.supabase.co`) → sarà `VITE_SUPABASE_URL`
   - **anon / public key** → sarà `VITE_SUPABASE_ANON_KEY`
   - *(solo se attivi Strava OAuth)* **service_role key** → sarà `SUPABASE_SERVICE_ROLE_KEY` (solo lato server su Cloudflare, mai nel frontend!)

### 1.3 Configura l'autenticazione
1. Vai in **Authentication → Providers**:
   - **Email** è attivo di default (Email + Password).
   - *(Opzionale)* Puoi abilitare **Google** inserendo Client ID/Secret da Google Cloud Console.
2. Vai in **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:5173` (poi cambierai con il tuo dominio Cloudflare, es. `https://velopulse-app.pages.dev`).
   - **Redirect URLs**: aggiungi sia `http://localhost:5173/**` che `https://<tuo-dominio-cloudflare>/**`.

---

## 2. Test in locale

1. Copia `.env.example` in `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Inserisci in `.env.local` i valori del tuo progetto Supabase:
   ```env
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
3. Avvia la webapp:
   ```bash
   npm run dev
   ```
4. Apri `http://localhost:5173`: vedrai la schermata di **Login / Registrazione Supabase**.
5. Dopo aver creato l'account e fatto login, vai su **Profile → Sorgenti Dati (Supabase DB)**:
   - **Intervals.icu**: incolla la tua API Key e clicca *Salva e Sincronizza* → tutti i dati vengono salvati nel tuo database Postgres su Supabase.
   - **Garmin (.FIT)**: carica qualsiasi file `.fit` esportato da Garmin Connect o dal ciclocomputer → viene parsato e salvato su Supabase.
   - **Strava**: funziona dopo il deploy su Cloudflare Pages con le variabili Strava configurate (vedi sezione 4).

---

## 3. Deploy della Webapp su Cloudflare Pages (gratis)

1. Vai su [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Seleziona il repository `Cycling` e il branch (es. `feat/supabase-db-auth` o `master` dopo il merge).
3. Imposta i parametri di build:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. In **Environment Variables** (Production & Preview) aggiungi:
   - `VITE_SUPABASE_URL` = `https://xxxxx.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOi...`
   - *(Non impostare `VITE_DEMO_ONLY`!)*
5. Clicca **Save and Deploy**.
6. Copia l'URL assegnato da Cloudflare (es. `https://velopulse-app.pages.dev` o un tuo dominio custom) e aggiungilo in **Supabase → Authentication → URL Configuration** (Site URL + Redirect URLs).

---

## 4. (Opzionale) Attivare Strava OAuth su Cloudflare Pages

Il progetto include già le **Cloudflare Pages Functions** pronte in `functions/api/strava/`:
- `GET /api/strava/auth`
- `GET /api/strava/callback`
- `POST /api/strava/sync`

Per attivarle:
1. Vai su [strava.com/settings/api](https://www.strava.com/settings/api) e crea una nuova app.
2. Imposta **Authorization Callback Domain** con il tuo dominio Cloudflare (es. `velopulse-app.pages.dev`).
3. Su **Cloudflare Pages → Settings → Environment Variables** aggiungi (come **Encrypted / Secret**):
   - `STRAVA_CLIENT_ID`
   - `STRAVA_CLIENT_SECRET`
   - `SUPABASE_URL` (lo stesso Project URL di Supabase)
   - `SUPABASE_SERVICE_ROLE_KEY` (la service_role key di Supabase)
4. Fai un re-deploy su Cloudflare Pages: il pulsante **Collega Strava** nella pagina Profile funzionerà end-to-end.
