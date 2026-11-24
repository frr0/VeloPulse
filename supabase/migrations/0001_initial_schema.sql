-- =============================================================================
-- VeloPulse - Initial Supabase PostgreSQL Schema
-- Multi-provider athletic analytics & training database with strict RLS
-- =============================================================================

-- Enable pgcrypto for gen_random_uuid() (enabled by default in Supabase, safe guard)
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Helper: automatic updated_at trigger
-- -----------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. PROFILES (1-to-1 with auth.users)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  city text,
  country text,
  ftp integer default 250,
  weight_kg numeric(5, 2) default 75.0,
  max_hr integer default 190,
  resting_hr integer default 55,
  vo2max numeric(5, 2),
  use_imperial boolean not null default false,
  rider_settings jsonb not null default '{}'::jsonb,
  sport_settings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Automatically create a profile row when a new user signs up via Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 2. PROVIDER CONNECTIONS (Intervals.icu, Strava, Garmin)
-- -----------------------------------------------------------------------------
create table if not exists public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('intervals', 'strava', 'garmin')),
  status text not null default 'connected' check (status in ('connected', 'disconnected', 'error')),
  external_athlete_id text,
  -- Personal API key (used by Intervals.icu)
  api_key text,
  -- OAuth2 tokens (used by Strava / OAuth providers, written by backend functions)
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scope text,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.provider_connections enable row level security;

create policy "Users can view their own provider connections"
  on public.provider_connections for select
  using (auth.uid() = user_id);

create policy "Users can insert their own provider connections"
  on public.provider_connections for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own provider connections"
  on public.provider_connections for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own provider connections"
  on public.provider_connections for delete
  using (auth.uid() = user_id);

create trigger set_provider_connections_updated_at
  before update on public.provider_connections
  for each row execute function public.handle_updated_at();

create index if not exists idx_provider_connections_user
  on public.provider_connections (user_id);

-- -----------------------------------------------------------------------------
-- 3. ACTIVITIES (Normalized across Intervals.icu, Strava, Garmin FIT, Manual)
-- -----------------------------------------------------------------------------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('intervals', 'strava', 'garmin', 'manual')),
  external_id text not null,
  name text not null,
  type text not null default 'Ride',
  start_date_local timestamptz not null,
  distance_m numeric,
  moving_time_s integer,
  elapsed_time_s integer,
  total_elevation_gain_m numeric,
  average_speed numeric,
  max_speed numeric,
  average_heartrate numeric,
  max_heartrate numeric,
  average_watts numeric,
  weighted_average_watts numeric,
  training_load numeric,
  intensity numeric,
  ftp integer,
  joules numeric,
  average_cadence numeric,
  feel integer,
  rpe integer,
  indoor boolean,
  trainer boolean,
  description text,
  summary_polyline text,
  start_latlng jsonb,
  end_latlng jsonb,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, external_id)
);

alter table public.activities enable row level security;

create policy "Users can view their own activities"
  on public.activities for select
  using (auth.uid() = user_id);

create policy "Users can insert their own activities"
  on public.activities for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own activities"
  on public.activities for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own activities"
  on public.activities for delete
  using (auth.uid() = user_id);

create trigger set_activities_updated_at
  before update on public.activities
  for each row execute function public.handle_updated_at();

create index if not exists idx_activities_user_date
  on public.activities (user_id, start_date_local desc);

-- -----------------------------------------------------------------------------
-- 4. WELLNESS (Daily biometrics & CTL/ATL/TSB)
-- -----------------------------------------------------------------------------
create table if not exists public.wellness (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'intervals' check (provider in ('intervals', 'strava', 'garmin', 'manual')),
  date date not null,
  ctl numeric,
  atl numeric,
  tsb numeric,
  ramp_rate numeric,
  resting_hr integer,
  hrv numeric,
  sleep_secs integer,
  sleep_score integer,
  sleep_quality integer,
  weight_kg numeric(5, 2),
  readiness integer,
  vo2max numeric,
  soreness integer,
  fatigue integer,
  stress integer,
  mood integer,
  comments text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.wellness enable row level security;

create policy "Users can view their own wellness"
  on public.wellness for select
  using (auth.uid() = user_id);

create policy "Users can insert their own wellness"
  on public.wellness for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own wellness"
  on public.wellness for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own wellness"
  on public.wellness for delete
  using (auth.uid() = user_id);

create trigger set_wellness_updated_at
  before update on public.wellness
  for each row execute function public.handle_updated_at();

create index if not exists idx_wellness_user_date
  on public.wellness (user_id, date desc);

-- -----------------------------------------------------------------------------
-- 5. CALENDAR EVENTS (Planned workouts, targets, races)
-- -----------------------------------------------------------------------------
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'intervals' check (provider in ('intervals', 'strava', 'garmin', 'manual')),
  external_id text not null,
  start_date_local timestamptz not null,
  name text not null,
  type text,
  category text,
  moving_time_s integer,
  load numeric,
  description text,
  completed boolean not null default false,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, external_id)
);

alter table public.calendar_events enable row level security;

create policy "Users can view their own calendar events"
  on public.calendar_events for select
  using (auth.uid() = user_id);

create policy "Users can insert their own calendar events"
  on public.calendar_events for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own calendar events"
  on public.calendar_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own calendar events"
  on public.calendar_events for delete
  using (auth.uid() = user_id);

create trigger set_calendar_events_updated_at
  before update on public.calendar_events
  for each row execute function public.handle_updated_at();

create index if not exists idx_calendar_events_user_date
  on public.calendar_events (user_id, start_date_local desc);

-- -----------------------------------------------------------------------------
-- 6. POWER CURVES (Cached MMP curves per provider)
-- -----------------------------------------------------------------------------
create table if not exists public.power_curves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'intervals' check (provider in ('intervals', 'strava', 'garmin', 'manual')),
  recent jsonb,
  season jsonb,
  weight_kg numeric(5, 2),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.power_curves enable row level security;

create policy "Users can view their own power curves"
  on public.power_curves for select
  using (auth.uid() = user_id);

create policy "Users can insert their own power curves"
  on public.power_curves for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own power curves"
  on public.power_curves for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own power curves"
  on public.power_curves for delete
  using (auth.uid() = user_id);

create trigger set_power_curves_updated_at
  before update on public.power_curves
  for each row execute function public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 7. TABLE GRANTS (Required alongside RLS policies for authenticated users)
-- -----------------------------------------------------------------------------
grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on
  public.profiles,
  public.provider_connections,
  public.activities,
  public.wellness,
  public.calendar_events,
  public.power_curves
to authenticated, service_role;
