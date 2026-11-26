import { SessionSummary } from '../types';
import { Activity, Wellness } from '../types/intervals';
import { ActivityStream } from './intervals/api';
import { buildRouteSampler, VirtualWorldId } from './fit/fitGenerator';

const LOCAL_ACTIVITIES_KEY = 'velopulse_local_activities_v1';
const LOCAL_STREAMS_PREFIX = 'velopulse_local_streams_v1_';
const CACHED_STREAMS_PREFIX = 'velopulse_cached_streams_v1_';
const MAX_LOCAL_ACTIVITIES = 60;
const DUPLICATE_TIME_WINDOW_MS = 5 * 60 * 1000; // ±5 minutes

/**
 * Checks whether two activities represent the same ride (e.g. recorded in VeloPulse
 * and later synced from Intervals.icu, Strava, or imported via Garmin .FIT).
 */
export function isDuplicateActivity(
  a: { id?: string; start_date_local?: string; moving_time?: number },
  b: { id?: string; start_date_local?: string; moving_time?: number }
): boolean {
  if (a.id && b.id && a.id === b.id) return true;
  if (!a.start_date_local || !b.start_date_local) return false;

  const tA = new Date(a.start_date_local).getTime();
  const tB = new Date(b.start_date_local).getTime();
  if (!Number.isFinite(tA) || !Number.isFinite(tB)) return false;

  if (Math.abs(tA - tB) > DUPLICATE_TIME_WINDOW_MS) return false;

  const dA = a.moving_time ?? 0;
  const dB = b.moving_time ?? 0;
  if (dA <= 0 || dB <= 0) return true;

  const maxDur = Math.max(dA, dB);
  const tolerance = Math.max(60, maxDur * 0.25);
  return Math.abs(dA - dB) <= tolerance;
}

export function findDuplicateActivity(
  activities: Activity[],
  candidate: { id?: string; start_date_local: string; moving_time?: number },
  options?: { ignoreLocalVeloPulse?: boolean }
): Activity | null {
  for (const act of activities) {
    if (options?.ignoreLocalVeloPulse && isLocalVeloPulseActivity(act.id)) {
      continue;
    }
    if (isDuplicateActivity(act, candidate)) {
      return act;
    }
  }
  return null;
}

export function cacheActivityStreamsLocally(activityId: string, streams: ActivityStream[]): void {
  if (!activityId || !streams || streams.length === 0) return;
  try {
    localStorage.setItem(`${CACHED_STREAMS_PREFIX}${activityId}`, JSON.stringify(streams));
  } catch {
    // ignore storage quota errors
  }
}

export function loadCachedActivityStreams(activityId: string): ActivityStream[] | null {
  try {
    const raw =
      localStorage.getItem(`${LOCAL_STREAMS_PREFIX}${activityId}`) ||
      localStorage.getItem(`${CACHED_STREAMS_PREFIX}${activityId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ActivityStream[]) : null;
  } catch {
    return null;
  }
}

const WORLD_LABELS: Record<VirtualWorldId, string> = {
  valley: 'Dolomites Valley',
  newyork: 'New York',
  roma: 'Rome',
  paris: 'Paris',
};

export function isLocalVeloPulseActivity(activityId: string | undefined): boolean {
  return typeof activityId === 'string' && activityId.startsWith('vp-local-');
}

export function loadLocalActivities(): Activity[] {
  try {
    const raw = localStorage.getItem(LOCAL_ACTIVITIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Activity[]) : [];
  } catch {
    return [];
  }
}

export function loadLocalActivityStreams(activityId: string): ActivityStream[] | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_STREAMS_PREFIX}${activityId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ActivityStream[]) : null;
  } catch {
    return null;
  }
}

/**
 * Deduplicates a list of activities across providers (Intervals.icu, Strava, Garmin, VeloPulse)
 * and merges locally saved VeloPulse activities without creating duplicates.
 * If a remote activity matches a local VeloPulse ride (±5 min & similar duration),
 * the remote one wins (preserving the local virtual GPS track if remote has none).
 */
export function mergeWithLocalActivities(remoteActivities: Activity[]): Activity[] {
  const local = loadLocalActivities();
  const deduped: Activity[] = [];

  for (const act of remoteActivities) {
    const existingIdx = deduped.findIndex((existing) => isDuplicateActivity(existing, act));
    if (existingIdx === -1) {
      deduped.push(act);
    } else if (!deduped[existingIdx].icu_latlng && act.icu_latlng) {
      deduped[existingIdx] = { ...deduped[existingIdx], icu_latlng: act.icu_latlng };
    }
  }

  for (const localAct of local) {
    const matchIdx = deduped.findIndex((existing) => isDuplicateActivity(existing, localAct));
    if (matchIdx === -1) {
      deduped.push(localAct);
    } else if (!deduped[matchIdx].icu_latlng && localAct.icu_latlng) {
      deduped[matchIdx] = {
        ...deduped[matchIdx],
        icu_latlng: localAct.icu_latlng,
        velopulse_streams: deduped[matchIdx].velopulse_streams || loadLocalActivityStreams(localAct.id) || undefined,
      };
    }
  }

  return deduped.sort(
    (a, b) => new Date(b.start_date_local).getTime() - new Date(a.start_date_local).getTime()
  );
}

/**
 * Applies today's local VeloPulse TSS into the wellness series (Banister CTL/ATL/TSB)
 * so Fitness & Form charts immediately reflect local rides even without uploading externally.
 */
export function applyLocalLoadToWellness(wellness: Wellness[], addedTss: number, startTime: Date): Wellness[] {
  if (!addedTss || addedTss <= 0) return wellness;

  const pad = (n: number) => String(n).padStart(2, '0');
  const dayId = `${startTime.getFullYear()}-${pad(startTime.getMonth() + 1)}-${pad(startTime.getDate())}`;

  const sorted = [...wellness].sort((a, b) => a.id.localeCompare(b.id));
  const idx = sorted.findIndex((w) => w.id === dayId);

  if (idx >= 0) {
    const cur = sorted[idx];
    const prevCtl = cur.ctl ?? 0;
    const prevAtl = cur.atl ?? 0;
    const nextCtl = Number((prevCtl + addedTss / 42).toFixed(1));
    const nextAtl = Number((prevAtl + addedTss / 7).toFixed(1));
    sorted[idx] = {
      ...cur,
      ctl: nextCtl,
      atl: nextAtl,
      tsb: Number((nextCtl - nextAtl).toFixed(1)),
      ctlLoad: Math.round((cur.ctlLoad || 0) + addedTss),
      atlLoad: Math.round((cur.atlLoad || 0) + addedTss),
    };
    return sorted;
  }

  const prev = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  const prevCtl = prev?.ctl ?? 0;
  const prevAtl = prev?.atl ?? 0;
  const nextCtl = Number((prevCtl + (addedTss - prevCtl) / 42).toFixed(1));
  const nextAtl = Number((prevAtl + (addedTss - prevAtl) / 7).toFixed(1));

  sorted.push({
    id: dayId,
    ctl: nextCtl,
    atl: nextAtl,
    tsb: Number((nextCtl - nextAtl).toFixed(1)),
    ctlLoad: Math.round(addedTss),
    atlLoad: Math.round(addedTss),
  });
  return sorted;
}

/**
 * Converts a completed real Ride Studio session into a full VeloPulse Activity + Streams
 * and persists both in localStorage so it immediately shows up in Activities, Dashboard,
 * Fitness charts, and ActivityDetailView (with GPS map and full telemetry charts).
 */
export function saveLocalWorkoutSession(
  summary: SessionSummary,
  workoutTitle?: string,
  ftp?: number
): Activity {
  const startDate =
    summary.startTime instanceof Date ? summary.startTime : new Date(summary.startTime || Date.now());
  const id = `vp-local-${startDate.getTime()}`;
  const world: VirtualWorldId = summary.virtualWorld || 'valley';
  const sampler = buildRouteSampler(world);

  const timeData: number[] = [];
  const wattsData: number[] = [];
  const hrData: number[] = [];
  const cadenceData: number[] = [];
  const speedData: number[] = [];
  const altData: number[] = [];
  const latData: number[] = [];
  const lonData: number[] = [];
  const trackCoords: [number, number][] = [];

  let elevationGain = 0;
  let lastAlt: number | null = null;

  const samples = summary.samples || [];
  // Thin stored GPS polyline slightly if very long to keep localStorage lightweight
  const trackStep = Math.max(1, Math.floor(samples.length / 400));

  samples.forEach((s, i) => {
    const gps = sampler(s.distanceMeters || 0);
    timeData.push(s.elapsedSeconds);
    wattsData.push(Math.round(s.power || 0));
    hrData.push(Math.round(s.heartRate || 0));
    cadenceData.push(Math.round(s.cadence || 0));
    speedData.push(Number((s.speedMps || 0).toFixed(2)));
    altData.push(gps.altitude);
    latData.push(Number(gps.lat.toFixed(6)));
    lonData.push(Number(gps.lon.toFixed(6)));

    if (i % trackStep === 0 || i === samples.length - 1) {
      trackCoords.push([Number(gps.lat.toFixed(6)), Number(gps.lon.toFixed(6))]);
    }

    if (lastAlt !== null && gps.altitude > lastAlt) {
      elevationGain += gps.altitude - lastAlt;
    }
    lastAlt = gps.altitude;
  });

  const worldLabel = WORLD_LABELS[world];
  const activityName = workoutTitle
    ? `${workoutTitle} • ${worldLabel}`
    : `VeloPulse Ride • ${worldLabel}`;

  const activity: Activity = {
    id,
    start_date_local: startDate.toISOString(),
    name: activityName,
    type: 'VirtualRide',
    description: `Recorded locally in VeloPulse 3D Studio (${worldLabel}).`,
    moving_time: Math.max(1, Math.round(summary.totalTimerTimeSeconds)),
    elapsed_time: Math.max(1, Math.round(summary.totalElapsedTimeSeconds)),
    distance: Math.round(summary.totalDistanceMeters || 0),
    total_elevation_gain: Math.round(elevationGain),
    average_speed: Number(((summary.avgSpeedKmh || 0) / 3.6).toFixed(2)),
    max_speed: Number(((summary.maxSpeedKmh || 0) / 3.6).toFixed(2)),
    average_watts: Math.round(summary.avgPowerWatts || 0),
    weighted_average_watts: Math.round(summary.normalizedPowerWatts || summary.avgPowerWatts || 0),
    average_heartrate: summary.avgHeartRateBpm > 0 ? Math.round(summary.avgHeartRateBpm) : undefined,
    max_heartrate: summary.maxHeartRateBpm > 0 ? Math.round(summary.maxHeartRateBpm) : undefined,
    icu_average_cadence: summary.avgCadenceRpm > 0 ? Math.round(summary.avgCadenceRpm) : undefined,
    icu_training_load: Math.round(summary.trainingStressScore || 0),
    icu_intensity: Math.round((summary.intensityFactor || 0) * 100),
    icu_ftp: ftp || undefined,
    icu_joules: Math.round((summary.totalWorkKj || 0) * 1000),
    icu_latlng: trackCoords.length > 1 ? trackCoords : undefined,
    start_latlng: trackCoords.length > 0 ? trackCoords[0] : undefined,
    end_latlng: trackCoords.length > 0 ? trackCoords[trackCoords.length - 1] : undefined,
    indoor: true,
    trainer: true,
  };

  const streams: ActivityStream[] = [
    { type: 'time', data: timeData },
    { type: 'watts', data: wattsData },
    { type: 'velocity_smooth', data: speedData },
    { type: 'altitude', data: altData },
    { type: 'latlng', data: latData, data2: lonData },
  ];
  if (hrData.some((v) => v > 0)) {
    streams.push({ type: 'heartrate', data: hrData });
  }
  if (cadenceData.some((v) => v > 0)) {
    streams.push({ type: 'cadence', data: cadenceData });
  }

  // Persist activity list (keep latest MAX_LOCAL_ACTIVITIES)
  const existing = loadLocalActivities();
  const nextList = [activity, ...existing.filter((a) => a.id !== id)].slice(0, MAX_LOCAL_ACTIVITIES);

  try {
    localStorage.setItem(LOCAL_ACTIVITIES_KEY, JSON.stringify(nextList));
    localStorage.setItem(`${LOCAL_STREAMS_PREFIX}${id}`, JSON.stringify(streams));
  } catch (err) {
    console.warn('Could not save local workout streams to localStorage:', err);
  }

  return activity;
}
