import {
  Activity,
  Athlete,
  CalendarEvent,
  EMPTY_POWER_CURVE,
  PowerCurveData,
  PowerCurveReading,
  PowerCurveSample,
  PowerCurveSeries,
  SportSettings,
  Wellness,
} from '../../types/intervals';
import { HrZoneCustom } from '../../types';
import { getDefaultHrZones } from '../../utils/zones';

// Use Vite reverse proxy /api in development, or direct URL
const BASE_URL = import.meta.env.DEV ? '/api/v1' : 'https://intervals.icu/api/v1';

export class IntervalsApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'IntervalsApiError';
    this.status = status;
  }
}

/**
 * One stream (time series) of an activity, as Intervals.icu returns it.
 * `data2` is filled only by the `latlng` stream, which splits the track in two
 * series: the latitudes in `data` and the longitudes in `data2`.
 */
export interface ActivityStream {
  type: string;
  name?: string;
  data?: unknown[];
  data2?: unknown[];
}

/**
 * Outcome of a streams request. The caller tells three cases apart:
 * - `ok` with a stream of the wanted type: the data is there;
 * - `ok` without that type (or with an empty list): the activity has no such
 *   series on Intervals.icu;
 * - `failed`: the call did not produce data, and `reason` says why.
 */
export type ActivityStreamsResult =
  | { status: 'ok'; streams: ActivityStream[] }
  | { status: 'failed'; reason: string };

function getAuthHeader(apiKey: string): string {
  const cleanKey = apiKey.trim();
  return `Basic ${btoa(`API_KEY:${cleanKey}`)}`;
}

async function request<T>(endpoint: string, apiKey: string): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: getAuthHeader(apiKey),
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new IntervalsApiError(
        'Invalid API Key or unauthorized access. Please verify your Intervals.icu API Key.',
        response.status
      );
    }
    if (response.status === 404) {
      throw new IntervalsApiError('Athlete or resource not found on Intervals.icu.', response.status);
    }
    throw new IntervalsApiError(`Intervals.icu API error (HTTP ${response.status})`, response.status);
  }

  return response.json();
}

export async function getAthleteProfile(apiKey: string, athleteId = '0'): Promise<Athlete> {
  const id = athleteId.trim() || '0';
  return request<Athlete>(`/athlete/${id}`, apiKey);
}

export async function getWellnessHistory(
  apiKey: string,
  athleteId = '0',
  oldestDate?: string,
  newestDate?: string
): Promise<Wellness[]> {
  const id = athleteId.trim() || '0';
  const params = new URLSearchParams();

  const today = new Date();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(today.getDate() - 90);

  params.append('oldest', oldestDate || ninetyDaysAgo.toISOString().split('T')[0]);
  params.append('newest', newestDate || today.toISOString().split('T')[0]);

  const list = await request<Wellness[]>(`/athlete/${id}/wellness?${params.toString()}`, apiKey);

  return list.map((item) => ({
    ...item,
    tsb:
      item.tsb !== undefined
        ? item.tsb
        : item.ctl !== undefined && item.atl !== undefined
        ? Math.round((item.ctl - item.atl) * 10) / 10
        : undefined,
  }));
}

export async function getActivities(
  apiKey: string,
  athleteId = '0',
  oldestDate?: string,
  newestDate?: string
): Promise<Activity[]> {
  const id = athleteId.trim() || '0';
  const params = new URLSearchParams();

  const today = new Date();
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(today.getDate() - 60);

  params.append('oldest', oldestDate || sixtyDaysAgo.toISOString().split('T')[0]);
  params.append('newest', newestDate || today.toISOString().split('T')[0]);

  const list = await request<Activity[]>(`/athlete/${id}/activities?${params.toString()}`, apiKey);

  return list.sort(
    (a, b) => new Date(b.start_date_local).getTime() - new Date(a.start_date_local).getTime()
  );
}

export async function getActivityDetails(apiKey: string, activityId: string): Promise<Activity> {
  return request<Activity>(`/activity/${activityId}`, apiKey);
}

function describeStreamsError(err: unknown): string {
  if (err instanceof IntervalsApiError) {
    if (err.status === 401 || err.status === 403) {
      return 'Intervals.icu ha rifiutato la richiesta: controlla la chiave API.';
    }
    if (err.status === 404) {
      return 'Intervals.icu non trova questa attività.';
    }
    return `Intervals.icu non ha risposto correttamente (HTTP ${err.status}).`;
  }
  return 'Non ho raggiunto Intervals.icu, oppure la risposta non era leggibile.';
}

/**
 * Streams (time series) of an activity.
 *
 * Endpoint: `GET /api/v1/activity/{id}/streams?types=a,b,c`. The answer is a
 * list of streams, one per type asked for, each with `type` and `data`. A type
 * the activity does not have is simply missing from the list: only the types in
 * `types` are returned, so nothing comes back unless it is asked for.
 *
 * The function never throws and never invents a series: a failure comes back as
 * `status: 'failed'` with the reason, so the caller can tell it apart from an
 * activity that has no such series.
 */
export async function getActivityStreams(
  apiKey: string,
  activityId: string,
  types: string | string[] = 'latlng'
): Promise<ActivityStreamsResult> {
  const wanted = (Array.isArray(types) ? types : types.split(','))
    .map((type) => type.trim())
    .filter((type) => type.length > 0);

  if (wanted.length === 0) {
    return { status: 'failed', reason: 'Nessuna serie richiesta a Intervals.icu.' };
  }

  const params = new URLSearchParams({ types: wanted.join(',') });

  let data: unknown;
  try {
    data = await request<unknown>(`/activity/${activityId}/streams?${params.toString()}`, apiKey);
  } catch (err) {
    return { status: 'failed', reason: describeStreamsError(err) };
  }

  if (!Array.isArray(data)) {
    return {
      status: 'failed',
      reason: 'Intervals.icu ha risposto con le serie in un formato inatteso.',
    };
  }

  const streams: ActivityStream[] = [];
  for (const item of data) {
    const obj = asRecord(item);
    if (!obj || typeof obj.type !== 'string') continue;
    streams.push({
      type: obj.type,
      name: typeof obj.name === 'string' ? obj.name : undefined,
      data: Array.isArray(obj.data) ? obj.data : undefined,
      data2: Array.isArray(obj.data2) ? obj.data2 : undefined,
    });
  }

  return { status: 'ok', streams };
}

/**
 * Coordinates of the `latlng` stream, as `[lat, lng]` pairs.
 *
 * Intervals.icu splits the track in two series: the latitudes in `data` and the
 * longitudes in `data2`. Reading `data` alone gives a list of latitudes, which
 * is not a track and draws nothing on a map.
 *
 * Only the points that carry both numbers are kept: no coordinate is completed
 * or guessed.
 */
export function latlngStreamToCoordinates(
  stream: ActivityStream | null | undefined
): [number, number][] {
  if (!stream || !Array.isArray(stream.data)) return [];

  const lats = stream.data;
  const lngs = Array.isArray(stream.data2) ? stream.data2 : null;
  const points: [number, number][] = [];

  for (let i = 0; i < lats.length; i++) {
    const lat = lats[i];

    if (lngs) {
      const lng = lngs[i];
      if (isFiniteNumber(lat) && isFiniteNumber(lng)) points.push([lat, lng]);
      continue;
    }

    // Without `data2` the only usable shape is a pair already inside `data`.
    if (Array.isArray(lat) && isFiniteNumber(lat[0]) && isFiniteNumber(lat[1])) {
      points.push([lat[0], lat[1]]);
    }
  }

  return points;
}

export async function getCalendarEvents(
  apiKey: string,
  athleteId = '0',
  oldestDate?: string,
  newestDate?: string
): Promise<CalendarEvent[]> {
  const id = athleteId.trim() || '0';
  const params = new URLSearchParams();

  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 7);
  const twoWeeksAhead = new Date();
  twoWeeksAhead.setDate(today.getDate() + 14);

  params.append('oldest', oldestDate || weekAgo.toISOString().split('T')[0]);
  params.append('newest', newestDate || twoWeeksAhead.toISOString().split('T')[0]);

  return request<CalendarEvent[]>(`/athlete/${id}/events?${params.toString()}`, apiKey);
}

/** Curves asked to Intervals.icu: last 42 days and current season. */
const RECENT_CURVE_ID = '42d';
const SEASON_CURVE_ID = 's0';

const CURVE_LABELS: Record<string, string> = {
  '42d': 'Recent 42D',
  s0: 'Season',
};

function curveLabel(id: string): string {
  return CURVE_LABELS[id] ?? id.toUpperCase();
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/** Weight Intervals.icu used for a curve, in kg. null when the curve has none. */
function curveWeightKg(obj: Record<string, unknown>): number | null {
  return isFiniteNumber(obj.weight) && obj.weight > 0 ? obj.weight : null;
}

/** Curve id reported by Intervals.icu, for example `42d` or `s0`. */
function readCurveId(obj: Record<string, unknown> | null): string | null {
  if (!obj) return null;
  for (const key of ['id', 'curve']) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/**
 * Reads the durations and the power of one curve of the Intervals.icu response.
 *
 * In the answer (`DataCurve`) the durations are in `secs` and the power is in
 * `values`. `watts` is accepted as an alternative name, because the scripting
 * model of Intervals.icu uses that one.
 *
 * Returns null when the object is not a curve, an empty list when the curve
 * carries no usable number. No value is ever filled in.
 */
function parseCurveSamples(value: unknown, weightKg: number | null): PowerCurveSample[] | null {
  const obj = asRecord(value);
  if (!obj) return null;
  if (!Array.isArray(obj.secs)) return null;

  const watts = Array.isArray(obj.values)
    ? obj.values
    : Array.isArray(obj.watts)
    ? obj.watts
    : null;
  if (!watts) return null;

  const secs = obj.secs;
  const wkgArray = Array.isArray(obj.watts_per_kg) ? obj.watts_per_kg : null;
  // The answer has no W/kg column: the weight of the curve is the real source.
  const curveWeight = curveWeightKg(obj) ?? weightKg;
  const length = Math.min(secs.length, watts.length);
  const samples: PowerCurveSample[] = [];

  for (let i = 0; i < length; i++) {
    const sec = secs[i];
    const watt = watts[i];
    if (!isFiniteNumber(sec) || !isFiniteNumber(watt)) continue;

    // Round first, then check: a duration under half a second would round to 0,
    // and a 0 breaks the logarithmic time axis and powerAtSecs (log(0)).
    const roundedSecs = Math.round(sec);
    const roundedWatts = Math.round(watt);
    if (roundedSecs <= 0 || roundedWatts <= 0) continue;

    const rawWkg = wkgArray ? wkgArray[i] : undefined;
    let wkg: number | null = null;
    if (isFiniteNumber(rawWkg) && rawWkg > 0) {
      wkg = rawWkg;
    } else if (curveWeight !== null) {
      wkg = watt / curveWeight;
    }

    samples.push({ secs: roundedSecs, watts: roundedWatts, wkg });
  }

  samples.sort((a, b) => a.secs - b.secs);
  return samples;
}

interface CurveEntry {
  id: string;
  samples: PowerCurveSample[];
  /** Weight Intervals.icu used for this curve, in kg. */
  weightKg: number | null;
}

/**
 * Finds the curves in the response.
 *
 * The documented answer is `{ "list": [ curve, ... ], "activities": { ... } }`,
 * one entry per curve asked for in `curves`. The other shapes are kept as a
 * fallback, so a usable curve is never thrown away.
 * Returns null when the shape is not recognised.
 */
function collectCurves(data: unknown, weightKg: number | null): CurveEntry[] | null {
  const requestedIds = [RECENT_CURVE_ID, SEASON_CURVE_ID];

  const fromList = (list: unknown[]): CurveEntry[] | null => {
    const entries: CurveEntry[] = [];
    for (const item of list) {
      const samples = parseCurveSamples(item, weightKg);
      if (samples === null) continue;
      const obj = asRecord(item);
      entries.push({
        id: readCurveId(obj) ?? requestedIds[entries.length] ?? `curve-${entries.length + 1}`,
        samples,
        weightKg: obj ? curveWeightKg(obj) : null,
      });
    }
    return entries.length > 0 ? entries : null;
  };

  if (Array.isArray(data)) {
    return fromList(data);
  }

  const obj = asRecord(data);
  if (!obj) return null;

  // Documented shape of the answer.
  if (Array.isArray(obj.list)) {
    return fromList(obj.list);
  }

  if (Array.isArray(obj.curves)) {
    return fromList(obj.curves);
  }

  // Object with one key per curve, for example { "42d": {...}, "s0": {...} }.
  const keyed: CurveEntry[] = [];
  for (const id of requestedIds) {
    const samples = parseCurveSamples(obj[id], weightKg);
    if (samples === null) continue;
    const curve = asRecord(obj[id]);
    keyed.push({ id, samples, weightKg: curve ? curveWeightKg(curve) : null });
  }
  if (keyed.length > 0) return keyed;

  const single = parseCurveSamples(obj, weightKg);
  if (single !== null) {
    return [{ id: requestedIds[0], samples: single, weightKg: curveWeightKg(obj) }];
  }

  return null;
}

function describePowerCurveError(err: unknown): string {
  if (err instanceof IntervalsApiError) {
    if (err.status === 401 || err.status === 403) {
      return 'Intervals.icu refused the request. Please check your API key.';
    }
    if (err.status === 404) {
      return 'Intervals.icu has no power curves for this athlete.';
    }
    return `Intervals.icu did not answer correctly (HTTP ${err.status}).`;
  }
  return 'Intervals.icu did not answer. Please check the connection and try again.';
}

/**
 * Power at a given duration.
 * Exact sample when the curve has that duration, otherwise linear
 * interpolation on the logarithm of the time between the two samples that
 * bracket it. Outside the range of the curve the value does not exist.
 */
export function powerAtSecs(
  samples: PowerCurveSample[],
  targetSecs: number
): PowerCurveReading | null {
  if (!Array.isArray(samples) || samples.length === 0 || targetSecs <= 0) return null;

  for (const sample of samples) {
    if (sample.secs === targetSecs) {
      return { secs: targetSecs, watts: sample.watts, wkg: sample.wkg, interpolated: false };
    }
  }

  for (let i = 0; i < samples.length - 1; i++) {
    const low = samples[i];
    const high = samples[i + 1];
    if (low.secs >= targetSecs || targetSecs >= high.secs) continue;

    const span = Math.log(high.secs) - Math.log(low.secs);
    if (span <= 0) return null;
    const ratio = (Math.log(targetSecs) - Math.log(low.secs)) / span;
    const watts = low.watts + (high.watts - low.watts) * ratio;
    const wkg =
      low.wkg !== null && high.wkg !== null ? low.wkg + (high.wkg - low.wkg) * ratio : null;

    return { secs: targetSecs, watts: Math.round(watts), wkg, interpolated: true };
  }

  return null;
}

/**
 * Power curves of the athlete, exactly as Intervals.icu reports them.
 * When the call fails, or the athlete has no power data, the curves stay empty
 * and `error` says why: the app never shows made up watts.
 */
export async function getPowerCurves(
  apiKey: string,
  athleteId = '0',
  athleteWeightKg: number | null = null,
  sportType = 'Ride'
): Promise<PowerCurveData> {
  const id = athleteId.trim() || '0';
  const weightKg =
    isFiniteNumber(athleteWeightKg) && athleteWeightKg > 0 ? athleteWeightKg : null;
  const params = new URLSearchParams({
    curves: `${RECENT_CURVE_ID},${SEASON_CURVE_ID}`,
    type: sportType,
  });

  let data: unknown;
  try {
    data = await request<unknown>(`/athlete/${id}/power-curves?${params.toString()}`, apiKey);
  } catch (err) {
    console.warn('Intervals.icu power curves request failed:', err);
    return { ...EMPTY_POWER_CURVE, weightKg, error: describePowerCurveError(err) };
  }

  const curves = collectCurves(data, weightKg);
  if (!curves) {
    return {
      ...EMPTY_POWER_CURVE,
      weightKg,
      error: 'Intervals.icu answered with power curves in an unexpected format.',
    };
  }

  const toSeries = (entry: CurveEntry | undefined): PowerCurveSeries | null => {
    if (!entry || entry.samples.length === 0) return null;
    return { id: entry.id, label: curveLabel(entry.id), samples: entry.samples };
  };

  // Match each curve by the id Intervals.icu reports: the answer can list the
  // curves in any order, and matching by position would swap the two buttons.
  const findCurve = (wantedId: string): CurveEntry | undefined =>
    curves.find((entry) => entry.id === wantedId);

  // With no weight on the athlete profile, the weight reported on the curves is
  // the only real source for W/kg.
  const reportedWeightKg =
    weightKg ?? curves.reduce<number | null>((found, entry) => found ?? entry.weightKg, null);

  let recent = toSeries(findCurve(RECENT_CURVE_ID));
  let season = toSeries(findCurve(SEASON_CURVE_ID));

  // The answer carries only curves with ids we did not ask for: keep them in
  // the order they arrived, so a usable curve is never thrown away.
  if (!recent && !season) {
    recent = toSeries(curves[0]);
    season = toSeries(curves[1]);
  }

  if (!recent && !season) {
    return {
      ...EMPTY_POWER_CURVE,
      weightKg: reportedWeightKg,
      error: 'Intervals.icu has no power data in this period.',
    };
  }

  return { recent, season, weightKg: reportedWeightKg, simulated: false, error: null };
}

export async function getAthleteSportSettings(
  apiKey: string,
  athleteId = '0',
  sport = 'Ride'
): Promise<SportSettings | null> {
  const id = athleteId.trim() || '0';
  try {
    const data = await request<SportSettings>(`/athlete/${id}/sport-settings/${sport}`, apiKey);
    if (data && data.hr_zones && data.hr_zones.length > 0) {
      return data;
    }
  } catch {
    // Specific endpoint fallback
  }

  try {
    const athlete = await getAthleteProfile(apiKey, id);
    if (athlete.sportSettings && Array.isArray(athlete.sportSettings)) {
      const match = athlete.sportSettings.find((s) => s.types?.includes(sport) || s.id === sport);
      if (match && match.hr_zones && match.hr_zones.length > 0) {
        return match;
      }
      if (athlete.sportSettings[0]?.hr_zones?.length) {
        return athlete.sportSettings[0];
      }
    }
  } catch {
    // Athlete profile fallback
  }

  return null;
}

export function sportSettingsToHrZones(
  sportSettings: SportSettings | null | undefined,
  maxHr = 190,
  restingHr = 55
): HrZoneCustom[] {
  if (!sportSettings || !sportSettings.hr_zones || sportSettings.hr_zones.length === 0) {
    return getDefaultHrZones(maxHr, restingHr);
  }

  const zoneColors = ['#94a3b8', '#38bdf8', '#4ade80', '#facc15', '#ef4444', '#fb923c', '#c084fc'];
  const defaultNames = [
    'Recovery',
    'Aerobic Base',
    'Tempo',
    'Threshold',
    'VO2 Max / Anaerobic',
    'Anaerobic Capacity',
    'Neuromuscular',
  ];

  const bounds = sportSettings.hr_zones; // Upper thresholds in BPM, e.g. [126, 148, 164, 178, 192]
  const names = sportSettings.hr_zone_names || [];

  return bounds.map((upperBpm, idx) => {
    const minBpm = idx === 0 ? Math.round(restingHr) : bounds[idx - 1];
    return {
      zone: idx + 1,
      name: names[idx] || defaultNames[idx] || `Zone ${idx + 1}`,
      minBpm,
      maxBpm: upperBpm,
      color: zoneColors[idx % zoneColors.length],
    };
  });
}
