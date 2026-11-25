import {
  Activity,
  Athlete,
  CalendarEvent,
  EMPTY_POWER_CURVE,
  PowerCurveData,
  SportSettings,
  Wellness,
} from '../../types/intervals';
import {
  getActivities,
  getAthleteProfile,
  getCalendarEvents,
  getPowerCurves,
  getWellnessHistory,
} from '../intervals/api';
import { parseFitFileToActivity } from '../fit/fitParser';
import { supabase } from './client';
import { DataProvider, DbProfile, ProviderConnection } from './types';

export interface UserDatabaseBundle {
  profile: DbProfile | null;
  athlete: Athlete | null;
  connections: ProviderConnection[];
  activities: Activity[];
  wellness: Wellness[];
  events: CalendarEvent[];
  powerCurve: PowerCurveData;
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}

function mapProfileToAthlete(profile: DbProfile | null, fallbackEmail?: string | null): Athlete {
  return {
    id: profile?.id || '0',
    name: profile?.full_name || fallbackEmail?.split('@')[0] || 'Athlete',
    profile_medium: profile?.avatar_url || undefined,
    city: profile?.city || undefined,
    country: profile?.country || undefined,
    weight: profile?.weight_kg ?? undefined,
    restingHR: profile?.resting_hr ?? undefined,
    maxHR: profile?.max_hr ?? undefined,
    ftp: profile?.ftp ?? undefined,
    vo2max: profile?.vo2max ?? undefined,
    sportSettings: Array.isArray(profile?.sport_settings)
      ? (profile?.sport_settings as SportSettings[])
      : undefined,
  };
}

function mapRowToActivity(row: Record<string, any>): Activity {
  const raw = (row.raw_data && typeof row.raw_data === 'object' ? row.raw_data : {}) as Partial<Activity>;
  return {
    ...raw,
    id: String(row.external_id || row.id),
    name: row.name || raw.name || 'Activity',
    type: row.type || raw.type || 'Ride',
    start_date_local: row.start_date_local || raw.start_date_local,
    distance: row.distance_m != null ? Number(row.distance_m) : raw.distance,
    moving_time: row.moving_time_s != null ? Number(row.moving_time_s) : raw.moving_time,
    elapsed_time: row.elapsed_time_s != null ? Number(row.elapsed_time_s) : raw.elapsed_time,
    total_elevation_gain:
      row.total_elevation_gain_m != null ? Number(row.total_elevation_gain_m) : raw.total_elevation_gain,
    average_speed: row.average_speed != null ? Number(row.average_speed) : raw.average_speed,
    max_speed: row.max_speed != null ? Number(row.max_speed) : raw.max_speed,
    average_heartrate:
      row.average_heartrate != null ? Number(row.average_heartrate) : raw.average_heartrate,
    max_heartrate: row.max_heartrate != null ? Number(row.max_heartrate) : raw.max_heartrate,
    average_watts: row.average_watts != null ? Number(row.average_watts) : raw.average_watts,
    weighted_average_watts:
      row.weighted_average_watts != null
        ? Number(row.weighted_average_watts)
        : raw.weighted_average_watts,
    icu_training_load:
      row.training_load != null ? Number(row.training_load) : raw.icu_training_load,
    icu_intensity: row.intensity != null ? Number(row.intensity) : raw.icu_intensity,
    icu_ftp: row.ftp != null ? Number(row.ftp) : raw.icu_ftp,
    icu_joules: row.joules != null ? Number(row.joules) : raw.icu_joules,
    icu_average_cadence:
      row.average_cadence != null ? Number(row.average_cadence) : raw.icu_average_cadence,
    feel: row.feel != null ? Number(row.feel) : raw.feel,
    rpe: row.rpe != null ? Number(row.rpe) : raw.rpe,
    indoor: row.indoor ?? raw.indoor,
    trainer: row.trainer ?? raw.trainer,
    description: row.description ?? raw.description,
    summary_polyline: row.summary_polyline ?? raw.summary_polyline,
    start_latlng: row.start_latlng ?? raw.start_latlng,
    end_latlng: row.end_latlng ?? raw.end_latlng,
  };
}

function mapRowToWellness(row: Record<string, any>): Wellness {
  const raw = (row.raw_data && typeof row.raw_data === 'object' ? row.raw_data : {}) as Partial<Wellness>;
  return {
    ...raw,
    id: String(row.date),
    ctl: row.ctl != null ? Number(row.ctl) : raw.ctl,
    atl: row.atl != null ? Number(row.atl) : raw.atl,
    tsb: row.tsb != null ? Number(row.tsb) : raw.tsb,
    rampRate: row.ramp_rate != null ? Number(row.ramp_rate) : raw.rampRate,
    restingHR: row.resting_hr != null ? Number(row.resting_hr) : raw.restingHR,
    hrv: row.hrv != null ? Number(row.hrv) : raw.hrv,
    sleepSecs: row.sleep_secs != null ? Number(row.sleep_secs) : raw.sleepSecs,
    sleepScore: row.sleep_score != null ? Number(row.sleep_score) : raw.sleepScore,
    sleepQuality: row.sleep_quality != null ? Number(row.sleep_quality) : raw.sleepQuality,
    weight: row.weight_kg != null ? Number(row.weight_kg) : raw.weight,
    readiness: row.readiness != null ? Number(row.readiness) : raw.readiness,
    vo2max: row.vo2max != null ? Number(row.vo2max) : raw.vo2max,
    soreness: row.soreness != null ? Number(row.soreness) : raw.soreness,
    fatigue: row.fatigue != null ? Number(row.fatigue) : raw.fatigue,
    stress: row.stress != null ? Number(row.stress) : raw.stress,
    mood: row.mood != null ? Number(row.mood) : raw.mood,
    comments: row.comments ?? raw.comments,
  };
}

function mapRowToCalendarEvent(row: Record<string, any>): CalendarEvent {
  const raw = (row.raw_data && typeof row.raw_data === 'object'
    ? row.raw_data
    : {}) as Partial<CalendarEvent>;
  return {
    ...raw,
    id: row.external_id || row.id,
    start_date_local: row.start_date_local || raw.start_date_local,
    name: row.name || raw.name || 'Workout',
    type: row.type ?? raw.type,
    category: (row.category ?? raw.category) as CalendarEvent['category'],
    moving_time: row.moving_time_s != null ? Number(row.moving_time_s) : raw.moving_time,
    load: row.load != null ? Number(row.load) : raw.load,
    description: row.description ?? raw.description,
    completed: row.completed ?? raw.completed,
  };
}

/**
 * Loads the authenticated user's complete training state directly from Supabase PostgreSQL.
 */
export async function loadUserBundle(
  userId: string,
  userEmail?: string | null
): Promise<UserDatabaseBundle> {
  const client = requireSupabase();

  const [profileRes, connectionsRes, activitiesRes, wellnessRes, eventsRes, powerCurveRes] =
    await Promise.all([
      client.from('profiles').select('*').eq('id', userId).maybeSingle(),
      client.from('provider_connections').select('*').eq('user_id', userId),
      client
        .from('activities')
        .select('*')
        .eq('user_id', userId)
        .order('start_date_local', { ascending: false })
        .limit(200),
      client
        .from('wellness')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(120),
      client
        .from('calendar_events')
        .select('*')
        .eq('user_id', userId)
        .order('start_date_local', { ascending: false })
        .limit(120),
      client.from('power_curves').select('*').eq('user_id', userId).limit(1).maybeSingle(),
    ]);

  const profile = (profileRes.data as DbProfile | null) ?? null;
  const connections = (connectionsRes.data as ProviderConnection[] | null) ?? [];
  const activities = ((activitiesRes.data as Record<string, any>[] | null) ?? []).map(
    mapRowToActivity
  );
  const wellness = ((wellnessRes.data as Record<string, any>[] | null) ?? []).map(mapRowToWellness);
  const events = ((eventsRes.data as Record<string, any>[] | null) ?? []).map(
    mapRowToCalendarEvent
  );

  let powerCurve: PowerCurveData = EMPTY_POWER_CURVE;
  if (powerCurveRes.data) {
    const row = powerCurveRes.data as Record<string, any>;
    powerCurve = {
      recent: row.recent ?? null,
      season: row.season ?? null,
      weightKg: row.weight_kg != null ? Number(row.weight_kg) : null,
      simulated: false,
      error: null,
    };
  }

  return {
    profile,
    athlete: mapProfileToAthlete(profile, userEmail),
    connections,
    activities,
    wellness,
    events,
    powerCurve,
  };
}

export async function saveUserUnits(userId: string, useImperial: boolean): Promise<void> {
  const client = requireSupabase();
  await client.from('profiles').upsert({ id: userId, use_imperial: useImperial });
}

/**
 * Verifies Intervals.icu credentials, persists them in `provider_connections`,
 * fetches fresh data from Intervals.icu, and upserts everything into Supabase.
 */
export async function connectAndSyncIntervals(
  userId: string,
  apiKey: string,
  athleteId = '0',
  userEmail?: string | null
): Promise<UserDatabaseBundle> {
  const client = requireSupabase();
  const cleanKey = apiKey.trim();
  const cleanId = athleteId.trim() || '0';

  // 1. Fetch from Intervals.icu
  const [fetchedAthlete, fetchedWellness, fetchedActivities, fetchedEvents] = await Promise.all([
    getAthleteProfile(cleanKey, cleanId),
    getWellnessHistory(cleanKey, cleanId),
    getActivities(cleanKey, cleanId),
    getCalendarEvents(cleanKey, cleanId),
  ]);

  const fetchedPowerCurve = await getPowerCurves(
    cleanKey,
    cleanId,
    fetchedAthlete?.weight ?? null
  );

  // 2. Save provider connection
  const { error: connErr } = await client.from('provider_connections').upsert(
    {
      user_id: userId,
      provider: 'intervals',
      status: 'connected',
      external_athlete_id: fetchedAthlete?.id || cleanId,
      api_key: cleanKey,
      last_synced_at: new Date().toISOString(),
      last_error: null,
    },
    { onConflict: 'user_id,provider' }
  );
  if (connErr) throw new Error(`Failed to save connection: ${connErr.message}`);

  // 3. Upsert profile
  await client.from('profiles').upsert({
    id: userId,
    email: userEmail ?? undefined,
    full_name: fetchedAthlete?.name || undefined,
    avatar_url: fetchedAthlete?.profile_medium || undefined,
    city: fetchedAthlete?.city || undefined,
    country: fetchedAthlete?.country || undefined,
    ftp: fetchedAthlete?.ftp ? Math.round(fetchedAthlete.ftp) : undefined,
    weight_kg: fetchedAthlete?.weight ?? undefined,
    max_hr: fetchedAthlete?.maxHR ? Math.round(fetchedAthlete.maxHR) : undefined,
    resting_hr: fetchedAthlete?.restingHR ? Math.round(fetchedAthlete.restingHR) : undefined,
    vo2max: fetchedAthlete?.vo2max ?? undefined,
    sport_settings: fetchedAthlete?.sportSettings ?? [],
  });

  // 4. Upsert activities
  if (fetchedActivities.length > 0) {
    const activityRows = fetchedActivities.map((a) => ({
      user_id: userId,
      provider: 'intervals',
      external_id: String(a.id),
      name: a.name || 'Intervals Activity',
      type: a.type || 'Ride',
      start_date_local: a.start_date_local,
      distance_m: a.distance ?? null,
      moving_time_s: a.moving_time != null ? Math.round(a.moving_time) : null,
      elapsed_time_s: a.elapsed_time != null ? Math.round(a.elapsed_time) : null,
      total_elevation_gain_m: a.total_elevation_gain ?? null,
      average_speed: a.average_speed ?? null,
      max_speed: a.max_speed ?? null,
      average_heartrate: a.average_heartrate ?? null,
      max_heartrate: a.max_heartrate ?? null,
      average_watts: a.average_watts ?? null,
      weighted_average_watts: a.weighted_average_watts ?? null,
      training_load: a.icu_training_load ?? null,
      intensity: a.icu_intensity ?? null,
      ftp: a.icu_ftp != null ? Math.round(a.icu_ftp) : null,
      joules: a.icu_joules ?? null,
      average_cadence: a.icu_average_cadence ?? null,
      feel: a.feel != null ? Math.round(a.feel) : null,
      rpe: a.rpe != null ? Math.round(a.rpe) : null,
      indoor: a.indoor ?? null,
      trainer: a.trainer ?? null,
      description: a.description ?? null,
      summary_polyline: a.summary_polyline || a.map?.summary_polyline || a.polyline || null,
      start_latlng: a.start_latlng ?? null,
      end_latlng: a.end_latlng ?? null,
      raw_data: a,
    }));

    const { error: actErr } = await client
      .from('activities')
      .upsert(activityRows, { onConflict: 'user_id,provider,external_id' });
    if (actErr) console.warn('Activities upsert warning:', actErr.message);
  }

  // 5. Upsert wellness
  if (fetchedWellness.length > 0) {
    const wellnessRows = fetchedWellness.map((w) => ({
      user_id: userId,
      provider: 'intervals',
      date: w.id,
      ctl: w.ctl ?? null,
      atl: w.atl ?? null,
      tsb: w.tsb ?? null,
      ramp_rate: w.rampRate ?? null,
      resting_hr: w.restingHR != null ? Math.round(w.restingHR) : null,
      hrv: w.hrv ?? null,
      sleep_secs: w.sleepSecs != null ? Math.round(w.sleepSecs) : null,
      sleep_score: w.sleepScore != null ? Math.round(w.sleepScore) : null,
      sleep_quality: w.sleepQuality != null ? Math.round(w.sleepQuality) : null,
      weight_kg: w.weight ?? null,
      readiness: w.readiness != null ? Math.round(w.readiness) : null,
      vo2max: w.vo2max ?? null,
      soreness: w.soreness != null ? Math.round(w.soreness) : null,
      fatigue: w.fatigue != null ? Math.round(w.fatigue) : null,
      stress: w.stress != null ? Math.round(w.stress) : null,
      mood: w.mood != null ? Math.round(w.mood) : null,
      comments: w.comments ?? null,
      raw_data: w,
    }));

    const { error: wellErr } = await client
      .from('wellness')
      .upsert(wellnessRows, { onConflict: 'user_id,date' });
    if (wellErr) console.warn('Wellness upsert warning:', wellErr.message);
  }

  // 6. Upsert calendar events
  if (fetchedEvents.length > 0) {
    const eventRows = fetchedEvents.map((ev) => ({
      user_id: userId,
      provider: 'intervals',
      external_id: String(ev.id),
      start_date_local: ev.start_date_local,
      name: ev.name || 'Workout',
      type: ev.type ?? null,
      category: ev.category ?? null,
      moving_time_s: ev.moving_time != null ? Math.round(ev.moving_time) : null,
      load: ev.load ?? null,
      description: ev.description ?? null,
      completed: Boolean(ev.completed),
      raw_data: ev,
    }));

    const { error: evErr } = await client
      .from('calendar_events')
      .upsert(eventRows, { onConflict: 'user_id,provider,external_id' });
    if (evErr) console.warn('Events upsert warning:', evErr.message);
  }

  // 7. Upsert power curve
  if (fetchedPowerCurve.recent || fetchedPowerCurve.season) {
    await client.from('power_curves').upsert(
      {
        user_id: userId,
        provider: 'intervals',
        recent: fetchedPowerCurve.recent,
        season: fetchedPowerCurve.season,
        weight_kg: fetchedPowerCurve.weightKg,
      },
      { onConflict: 'user_id,provider' }
    );
  }

  return loadUserBundle(userId, userEmail);
}

export async function disconnectProviderConnection(
  userId: string,
  provider: DataProvider
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('provider_connections')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider);
  if (error) throw new Error(error.message);
}

/**
 * Parses a Garmin `.FIT` file and persists it in Supabase `activities`.
 */
export async function importFitFileToDatabase(userId: string, file: File): Promise<Activity> {
  const client = requireSupabase();
  const parsed = await parseFitFileToActivity(file);

  const { error } = await client.from('activities').upsert(
    {
      user_id: userId,
      provider: 'garmin',
      external_id: parsed.id,
      name: parsed.name,
      type: parsed.type,
      start_date_local: parsed.start_date_local,
      distance_m: parsed.distance ?? null,
      moving_time_s: parsed.moving_time ?? null,
      elapsed_time_s: parsed.elapsed_time ?? null,
      total_elevation_gain_m: parsed.total_elevation_gain ?? null,
      average_speed: parsed.average_speed ?? null,
      max_speed: parsed.max_speed ?? null,
      average_heartrate: parsed.average_heartrate ?? null,
      max_heartrate: parsed.max_heartrate ?? null,
      average_watts: parsed.average_watts ?? null,
      weighted_average_watts: parsed.weighted_average_watts ?? null,
      training_load: parsed.icu_training_load ?? null,
      intensity: parsed.icu_intensity ?? null,
      joules: parsed.icu_joules ?? null,
      average_cadence: parsed.icu_average_cadence ?? null,
      indoor: parsed.indoor ?? null,
      trainer: parsed.trainer ?? null,
      description: parsed.description ?? null,
      start_latlng: parsed.start_latlng ?? null,
      end_latlng: parsed.end_latlng ?? null,
      raw_data: parsed,
    },
    { onConflict: 'user_id,provider,external_id' }
  );

  if (error) throw new Error(`Failed to save .FIT activity: ${error.message}`);

  await client.from('provider_connections').upsert(
    {
      user_id: userId,
      provider: 'garmin',
      status: 'connected',
      last_synced_at: new Date().toISOString(),
      last_error: null,
    },
    { onConflict: 'user_id,provider' }
  );

  return parsed;
}

/**
 * Calls the Cloudflare Pages Function `/api/strava/sync` using the user's Supabase JWT.
 */
export async function syncStravaViaBackend(): Promise<{ synced: number }> {
  const client = requireSupabase();
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Session expired. Please sign in again.');

  const res = await fetch('/api/strava/sync', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (payload as { error?: string }).error || `Strava sync error (HTTP ${res.status})`
    );
  }
  return { synced: Number((payload as { synced?: number }).synced || 0) };
}
