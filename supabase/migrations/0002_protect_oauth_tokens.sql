-- =============================================================================
-- 0002 - Keep OAuth tokens server-side
--
-- Strava access/refresh tokens are written and read only by the Worker with
-- the service role key. Signed-in users keep full access to the other columns
-- of their own rows (RLS still applies), but can no longer read or write the
-- token columns from the browser (Strava API Policy 5.16 / 8.1).
--
-- Column privileges only take effect once the table-level privilege is gone,
-- hence the revoke + per-column grant.
-- =============================================================================

revoke select, insert, update on public.provider_connections from authenticated;
-- Supabase's default privileges also grant the table to `anon` (RLS already
-- hides every row from it; this removes the privilege itself).
revoke all on public.provider_connections from anon;

grant select (
  id, user_id, provider, status, external_athlete_id, api_key,
  token_expires_at, scope, last_synced_at, last_error, created_at, updated_at
) on public.provider_connections to authenticated;

grant insert (
  user_id, provider, status, external_athlete_id, api_key, last_synced_at, last_error
) on public.provider_connections to authenticated;

-- user_id/provider are included because client upserts (Intervals.icu, Garmin)
-- send them in the ON CONFLICT DO UPDATE; RLS still forces user_id = auth.uid().
grant update (
  user_id, provider, status, external_athlete_id, api_key, last_synced_at, last_error
) on public.provider_connections to authenticated;

-- Strava rows are owned by the backend: the browser must not create, change or
-- delete them (disconnect goes through /api/strava/disconnect, which also
-- revokes access on Strava and deletes the activities).
drop policy if exists "Users can insert their own provider connections" on public.provider_connections;
drop policy if exists "Users can update their own provider connections" on public.provider_connections;
drop policy if exists "Users can delete their own provider connections" on public.provider_connections;

create policy "Users can insert their own non-OAuth provider connections"
  on public.provider_connections for insert
  with check (auth.uid() = user_id and provider <> 'strava');

create policy "Users can update their own non-OAuth provider connections"
  on public.provider_connections for update
  using (auth.uid() = user_id and provider <> 'strava')
  with check (auth.uid() = user_id and provider <> 'strava');

create policy "Users can delete their own non-OAuth provider connections"
  on public.provider_connections for delete
  using (auth.uid() = user_id and provider <> 'strava');

-- Webhook events identify the user by Strava athlete id.
create index if not exists idx_provider_connections_athlete
  on public.provider_connections (provider, external_athlete_id);
