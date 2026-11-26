import type { ActivityStream } from '../services/intervals/api';
import { HrZoneCustom } from '../types';
import { getHeartRateZoneNumber, getPowerZoneNumber, getPowerZones } from './zones';

/**
 * Streams asked to Intervals.icu for the activity page, in a single call.
 * `latlng` draws the map, the other four feed the charts over time.
 */
export const ACTIVITY_STREAM_TYPES = [
  'latlng',
  'time',
  'altitude',
  'heartrate',
  'watts',
  'cadence',
  'velocity_smooth',
] as const;

/**
 * One numeric series of an activity. A null marks a sample the device did not
 * record: the value stays missing and is never filled in.
 */
export type NumericSeries = (number | null)[];

/** The recorded series of one activity, aligned on the same sample index. */
export interface ActivitySeries {
  /** Elapsed seconds of every sample. */
  timeSecs: number[];
  /** Nominal gap between two samples, in seconds. 1 for a 1 Hz stream. */
  intervalSecs: number;
  /** Metres above sea level. null when the activity has no altitude. */
  altitude: NumericSeries | null;
  /** Beats per minute. null when the activity has no heart rate. */
  heartrate: NumericSeries | null;
  /** Watts. null when the activity has no power. */
  watts: NumericSeries | null;
  /** Revolutions per minute. null when the activity has no cadence. */
  cadence: NumericSeries | null;
  /** Speed in km/h. null when the activity has no velocity stream. */
  speed: NumericSeries | null;
  /** GPS [lat, lng] aligned 1:1 with each sample, if a `latlng` stream was present. */
  latlng?: ([number, number] | null)[] | null;
}

/**
 * Names a series can arrive with. Intervals.icu answers the `watts` request
 * with a stream named `raw_watts` in some cases, so both names are accepted.
 * Speed stream is typically `velocity_smooth` in m/s from Intervals.icu/Strava.
 */
const SERIES_ALIASES: Record<'altitude' | 'heartrate' | 'watts' | 'cadence' | 'speed', string[]> = {
  altitude: ['altitude'],
  heartrate: ['heartrate'],
  watts: ['watts', 'raw_watts'],
  cadence: ['cadence'],
  speed: ['velocity_smooth', 'speed'],
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function findStreamData(streams: ActivityStream[], names: string[]): unknown[] | null {
  for (const name of names) {
    const stream = streams.find((candidate) => candidate.type === name);
    if (stream && Array.isArray(stream.data) && stream.data.length > 0) return stream.data;
  }
  return null;
}

/**
 * Reads the samples at the kept indexes. A real number stays as it is, anything
 * else becomes a null: a value the device did not record stays missing.
 */
function toNumericSeries(data: unknown[], keptIndexes: number[]): NumericSeries {
  return keptIndexes.map((index) => {
    const value = data[index];
    return isFiniteNumber(value) ? value : null;
  });
}

/** true when at least one sample carries a number. */
function hasAnyValue(series: NumericSeries): boolean {
  return series.some((value) => value !== null);
}

/** Median of the positive gaps between samples. 1 when there is nothing to measure. */
function medianInterval(timeSecs: number[]): number {
  const gaps: number[] = [];
  for (let i = 1; i < timeSecs.length; i++) {
    const gap = timeSecs[i] - timeSecs[i - 1];
    if (Number.isFinite(gap) && gap > 0) gaps.push(gap);
  }
  if (gaps.length === 0) return 1;
  gaps.sort((a, b) => a - b);
  const middle = Math.floor(gaps.length / 2);
  const median =
    gaps.length % 2 === 0 ? (gaps[middle - 1] + gaps[middle]) / 2 : gaps[middle];
  return median > 0 ? median : 1;
}

/**
 * Reads the recorded series of an activity from the streams of Intervals.icu.
 *
 * A grandeur the activity does not have comes back as null, so the page can
 * leave out its chart instead of drawing an empty one. Returns null when none
 * of the four series is present.
 *
 * The time axis comes from the `time` stream. When that stream is missing the
 * sample index is used, which is the 1 Hz sampling Intervals.icu returns by
 * default.
 */
export function readActivitySeries(streams: ActivityStream[]): ActivitySeries | null {
  if (!Array.isArray(streams) || streams.length === 0) return null;

  const rawAltitude = findStreamData(streams, SERIES_ALIASES.altitude);
  const rawHeartrate = findStreamData(streams, SERIES_ALIASES.heartrate);
  const rawWatts = findStreamData(streams, SERIES_ALIASES.watts);
  const rawCadence = findStreamData(streams, SERIES_ALIASES.cadence);
  const rawSpeed = findStreamData(streams, SERIES_ALIASES.speed);
  const rawTime = findStreamData(streams, ['time']);

  const length = Math.max(
    rawAltitude?.length ?? 0,
    rawHeartrate?.length ?? 0,
    rawWatts?.length ?? 0,
    rawCadence?.length ?? 0,
    rawSpeed?.length ?? 0
  );
  if (length === 0) return null;

  // A sample is kept only when its elapsed time is known and does not go back
  // in time. A sample the `time` stream does not cover is dropped instead of
  // being given a made up second, which would scramble the time axis.
  const keptIndexes: number[] = [];
  const timeSecs: number[] = [];
  for (let i = 0; i < length; i++) {
    let seconds: number;
    if (rawTime) {
      const value = rawTime[i];
      if (!isFiniteNumber(value)) continue;
      seconds = value;
    } else {
      // No `time` stream: Intervals.icu samples once a second by default.
      seconds = i;
    }
    if (timeSecs.length > 0 && seconds < timeSecs[timeSecs.length - 1]) continue;
    keptIndexes.push(i);
    timeSecs.push(seconds);
  }
  if (keptIndexes.length === 0) return null;

  const build = (data: unknown[] | null, multiplier: number = 1): NumericSeries | null => {
    if (!data) return null;
    const raw = toNumericSeries(data, keptIndexes);
    const series = multiplier === 1 ? raw : raw.map((val) => (val !== null ? val * multiplier : null));
    return hasAnyValue(series) ? series : null;
  };

  // Keep 1:1 sample-aligned GPS coordinates directly from the `latlng` stream
  const latlngStream = streams.find((candidate) => candidate.type === 'latlng');
  let alignedLatlng: ([number, number] | null)[] | null = null;
  if (latlngStream && Array.isArray(latlngStream.data) && latlngStream.data.length > 0) {
    const lats = latlngStream.data;
    const lngs = Array.isArray(latlngStream.data2) ? latlngStream.data2 : null;
    let hasValidCoord = false;
    const coords: ([number, number] | null)[] = keptIndexes.map((idx) => {
      const lat = lats[idx];
      if (lngs) {
        const lng = lngs[idx];
        if (isFiniteNumber(lat) && isFiniteNumber(lng)) {
          hasValidCoord = true;
          return [lat, lng];
        }
        return null;
      }
      if (Array.isArray(lat) && isFiniteNumber(lat[0]) && isFiniteNumber(lat[1])) {
        hasValidCoord = true;
        return [lat[0], lat[1]];
      }
      return null;
    });
    if (hasValidCoord) {
      alignedLatlng = coords;
    }
  }

  const series: ActivitySeries = {
    timeSecs,
    intervalSecs: medianInterval(timeSecs),
    altitude: build(rawAltitude),
    heartrate: build(rawHeartrate),
    watts: build(rawWatts),
    cadence: build(rawCadence),
    // Intervals.icu provides velocity in m/s; convert to km/h (1 m/s = 3.6 km/h)
    speed: build(rawSpeed, 3.6),
    latlng: alignedLatlng,
  };

  if (!series.altitude && !series.heartrate && !series.watts && !series.cadence && !series.speed) return null;
  return series;
}

/**
 * Removes prolonged stationary pauses (e.g. speed <= 1.5 km/h for >= 15s, or
 * auto-pause gaps > 15s in elapsed time) and compresses the time axis into
 * clean, continuous moving time while preserving 1:1 alignment across all
 * telemetry streams and GPS coordinates.
 */
export function trimStationaryPauses(
  series: ActivitySeries,
  minPauseSeconds: number = 15,
  minMovingKmh: number = 1.5
): ActivitySeries {
  const n = series.timeSecs.length;
  if (n < 4) return series;

  const hasSpeed = Boolean(series.speed && series.speed.some((v) => v !== null && v > minMovingKmh));
  const keep = new Array<boolean>(n).fill(true);

  if (hasSpeed && series.speed) {
    let i = 0;
    while (i < n) {
      const isStopped = (idx: number): boolean => {
        const spd = series.speed![idx];
        const watts = series.watts?.[idx];
        const cad = series.cadence?.[idx];
        const speedZero = spd === null || spd <= minMovingKmh;
        // Never treat active indoor pedaling as stopped
        const activelyPedaling =
          (watts !== null && watts !== undefined && watts > 25) ||
          (cad !== null && cad !== undefined && cad > 20);
        return speedZero && !activelyPedaling;
      };

      if (isStopped(i)) {
        const runStart = i;
        while (i < n && isStopped(i)) i++;
        const runEnd = i - 1;
        const duration = series.timeSecs[runEnd] - series.timeSecs[runStart];
        const touchesEdge = runStart === 0 || runEnd === n - 1;
        // Trim any stop >= minPauseSeconds, or dead-zero tail/lead >= 5s
        if (duration >= minPauseSeconds || (touchesEdge && duration >= 5)) {
          for (let k = runStart; k <= runEnd; k++) {
            keep[k] = false;
          }
        }
      } else {
        i++;
      }
    }
  }

  const keptIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    if (keep[i]) keptIndices.push(i);
  }

  // Safety guard: never wipe out a ride if speed data was corrupted
  if (keptIndices.length < 4 || keptIndices.length < n * 0.05) {
    return series;
  }

  // Build clean continuous moving-time axis (collapsing any pause gaps > minPauseSeconds)
  const newTimeSecs: number[] = [0];
  let accum = 0;
  for (let j = 1; j < keptIndices.length; j++) {
    const prevIdx = keptIndices[j - 1];
    const currIdx = keptIndices[j];
    const rawDt = series.timeSecs[currIdx] - series.timeSecs[prevIdx];
    const dt =
      currIdx === prevIdx + 1 && rawDt > 0 && rawDt <= minPauseSeconds
        ? rawDt
        : Math.max(0.5, Math.min(rawDt > 0 ? rawDt : series.intervalSecs, series.intervalSecs));
    accum += dt;
    newTimeSecs.push(Math.round(accum * 10) / 10);
  }

  const pickNumeric = (arr: NumericSeries | null): NumericSeries | null =>
    arr ? keptIndices.map((idx) => arr[idx]) : null;

  return {
    timeSecs: newTimeSecs,
    intervalSecs: series.intervalSecs,
    altitude: pickNumeric(series.altitude),
    heartrate: pickNumeric(series.heartrate),
    watts: pickNumeric(series.watts),
    cadence: pickNumeric(series.cadence),
    speed: pickNumeric(series.speed),
    latlng: series.latlng ? keptIndices.map((idx) => series.latlng![idx]) : null,
  };
}

/** One drawn point: the elapsed time and the value recorded at that moment. */
export interface ChartPoint {
  /** Elapsed seconds. */
  t: number;
  /** Recorded value, or null where the device recorded nothing. */
  v: number | null;
  /** Background altitude in meters, if available. */
  alt?: number | null;
  /** Latitude and Longitude at this point, if available. */
  latlng?: [number, number] | null;
}

/** Points a chart draws at most. Above this the page slows down on a phone. */
export const MAX_CHART_POINTS = 900;

/**
 * Dropout & momentary pause threshold (in seconds).
 *
 * In cycling analytics, momentary gaps where power or cadence drops to zero/null
 * (due to sensor packet loss, gear shifting, brief freewheel coasting, or cornering)
 * are smoothed via interpolation to prevent artificial vertical plunges to zero on charts.
 * Configured to 10 seconds to cover brief pauses and sensor hiccups.
 *
 * True pauses/stops longer than this threshold (> 10s, like red lights or long descents)
 * are genuine rests and are preserved as zero.
 */
export const DROPOUT_THRESHOLD_SECONDS = 10;

/**
 * Fills short dropouts / micro-pauses (<= maxDropoutSeconds) in a power or cadence series
 * by linear interpolation between surrounding active non-zero samples.
 *
 * Runs of zero or null lasting longer than maxDropoutSeconds remain untouched (true zero).
 */
export function smoothShortDropouts(
  timeSecs: number[],
  series: NumericSeries | null,
  maxDropoutSeconds: number = DROPOUT_THRESHOLD_SECONDS
): NumericSeries | null {
  if (!series || series.length === 0) return null;

  const result: NumericSeries = [...series];
  const length = Math.min(timeSecs.length, series.length);

  let i = 0;
  while (i < length) {
    const val = result[i];
    const isZeroOrMissing = val === null || val === 0;

    if (isZeroOrMissing) {
      const startIndex = i;
      while (i < length && (result[i] === null || result[i] === 0)) {
        i++;
      }
      const endIndex = i - 1;

      // Check if bounded by valid positive values on both sides
      const prevIndex = startIndex - 1;
      const nextIndex = i;

      if (prevIndex >= 0 && nextIndex < length) {
        const prevVal = result[prevIndex];
        const nextVal = result[nextIndex];

        if (prevVal !== null && prevVal > 0 && nextVal !== null && nextVal > 0) {
          const gapDuration = timeSecs[nextIndex] - timeSecs[prevIndex];

          // If the pause / zero duration is <= maxDropoutSeconds (e.g. up to 10s), interpolate!
          if (gapDuration <= maxDropoutSeconds + 1) {
            const timeSpan = timeSecs[nextIndex] - timeSecs[prevIndex];
            const valDiff = nextVal - prevVal;

            for (let k = startIndex; k <= endIndex; k++) {
              const fraction = timeSpan > 0 ? (timeSecs[k] - timeSecs[prevIndex]) / timeSpan : 0.5;
              result[k] = Math.round(prevVal + fraction * valDiff);
            }
          }
        }
      }
    } else {
      i++;
    }
  }

  return result;
}

/**
 * Thins a series for drawing, keeping one sample every N.
 *
 * The kept points are real pairs of time and value, so the tooltip always
 * reports a number the device recorded at that very second. No value is
 * averaged, smoothed or filled in. The analyses (zones, W'bal, decoupling) run
 * on the full series, never on this thinned copy.
 */
export function thinSeriesForChart(
  timeSecs: number[],
  series: NumericSeries,
  maxPoints: number = MAX_CHART_POINTS,
  altitude?: NumericSeries | null,
  latlngSeries?: ([number, number] | null)[] | null
): ChartPoint[] {
  const length = Math.min(timeSecs.length, series.length);
  if (length === 0) return [];

  const step = Math.max(1, Math.ceil(length / Math.max(1, maxPoints)));
  const points: ChartPoint[] = [];

  if (step === 1) {
    for (let i = 0; i < length; i++) {
      points.push({
        t: timeSecs[i],
        v: series[i],
        alt: altitude && altitude[i] !== undefined ? altitude[i] : null,
        latlng: latlngSeries && latlngSeries[i] ? latlngSeries[i] : null,
      });
    }
    return points;
  }

  // Bucket-average each window to eliminate 1-sample aliasing spikes while
  // keeping exact time & GPS coordinate alignment
  for (let start = 0; start < length; start += step) {
    const end = Math.min(length, start + step);
    const mid = Math.floor((start + end - 1) / 2);

    let vSum = 0;
    let vCount = 0;
    let altSum = 0;
    let altCount = 0;
    let coord: [number, number] | null = null;

    for (let i = start; i < end; i++) {
      const val = series[i];
      if (val !== null && val !== undefined && Number.isFinite(val)) {
        vSum += val;
        vCount++;
      }
      if (altitude) {
        const a = altitude[i];
        if (a !== null && a !== undefined && Number.isFinite(a)) {
          altSum += a;
          altCount++;
        }
      }
      if (!coord && latlngSeries && latlngSeries[i]) {
        coord = latlngSeries[i];
      }
    }

    points.push({
      t: timeSecs[mid],
      v: vCount > 0 ? vSum / vCount : null,
      alt: altCount > 0 ? altSum / altCount : null,
      latlng: coord,
    });
  }

  return points;
}

/** Time spent in one zone. */
export interface ZoneBucket {
  /** Zone number, starting at 1. */
  zone: number;
  /** Name shown to the user. */
  label: string;
  /** Colour of the zone, taken from the zones of the app or of the user. */
  color: string;
  /** Range of the zone in its own unit, for example `150-200 W`. */
  range: string;
  /** Seconds recorded in the zone. */
  seconds: number;
  /** Share of the recorded time, from 0 to 100. */
  percent: number;
}

/** Histogram of the time spent in every zone, computed on the recorded series. */
export interface ZoneHistogram {
  kind: 'power' | 'hr';
  buckets: ZoneBucket[];
  /** Sum of the counted samples, in seconds. */
  totalSeconds: number;
  /** Number of samples that carried a value. */
  samples: number;
}

/**
 * Counts how long a series stayed in each zone.
 *
 * Every sample that carries a value counts for one sampling interval. A gap in
 * the recording is not attributed to any zone, so the total is the time the
 * device really measured, and the percentages are shares of that time.
 */
function accumulate(
  series: NumericSeries,
  intervalSecs: number,
  zoneCount: number,
  zoneOf: (value: number) => number,
  accept: (value: number) => boolean
): { seconds: number[]; total: number; samples: number } {
  const seconds = new Array<number>(zoneCount).fill(0);
  let total = 0;
  let samples = 0;

  for (const value of series) {
    if (value === null || !Number.isFinite(value) || !accept(value)) continue;
    const index = Math.min(zoneCount, Math.max(1, zoneOf(value))) - 1;
    seconds[index] += intervalSecs;
    total += intervalSecs;
    samples += 1;
  }

  return { seconds, total, samples };
}

/**
 * Histogram of the time in the power zones, computed by the app on the recorded
 * series. The zones are the ones of the app applied to the FTP of the user, so
 * an indoor session that Intervals.icu did not split still gets its histogram.
 *
 * Returns null, with no fallback number, when there is no power series or no
 * usable FTP.
 */
export function computePowerZoneHistogram(
  series: ActivitySeries | null,
  ftpWatts: number | null | undefined
): ZoneHistogram | null {
  if (!series || !series.watts) return null;
  if (!isFiniteNumber(ftpWatts) || ftpWatts <= 0) return null;

  const zones = getPowerZones(ftpWatts);
  const { seconds, total, samples } = accumulate(
    series.watts,
    series.intervalSecs,
    zones.length,
    (value) => getPowerZoneNumber(value, ftpWatts),
    (value) => value >= 0
  );
  if (total <= 0) return null;

  const buckets: ZoneBucket[] = zones.map((zone, index) => ({
    zone: zone.zone,
    label: `Z${zone.zone} ${zone.name}`,
    color: zone.color,
    range:
      index === zones.length - 1
        ? `> ${zones[index - 1]?.maxWatts ?? zone.minWatts} W`
        : `${index === 0 ? 0 : zones[index - 1].maxWatts}-${zone.maxWatts} W`,
    seconds: seconds[index],
    percent: (seconds[index] / total) * 100,
  }));

  return { kind: 'power', buckets, totalSeconds: total, samples };
}

/**
 * Histogram of the time in the heart rate zones, computed by the app on the
 * recorded series. The zones are the ones the user set in the settings, so a
 * change in the settings changes the histogram.
 *
 * Returns null when there is no heart rate series or no zones to apply.
 */
export function computeHrZoneHistogram(
  series: ActivitySeries | null,
  hrZones: HrZoneCustom[] | null | undefined,
  maxHeartRate: number | null | undefined
): ZoneHistogram | null {
  if (!series || !series.heartrate) return null;
  if (!Array.isArray(hrZones) || hrZones.length === 0) return null;

  const maxHr = isFiniteNumber(maxHeartRate) && maxHeartRate > 0 ? maxHeartRate : 0;
  const { seconds, total, samples } = accumulate(
    series.heartrate,
    series.intervalSecs,
    hrZones.length,
    (value) => {
      const zoneNumber = getHeartRateZoneNumber(value, maxHr, hrZones);
      const index = hrZones.findIndex((zone) => zone.zone === zoneNumber);
      return index >= 0 ? index + 1 : hrZones.length;
    },
    (value) => value > 0
  );
  if (total <= 0) return null;

  const fallbackColors = ['#94A3B8', '#38BDF8', '#4ADE80', '#FACC15', '#EF4444', '#FB923C', '#C084FC'];
  const buckets: ZoneBucket[] = hrZones.map((zone, index) => ({
    zone: zone.zone,
    label: `Z${zone.zone} ${zone.name}`,
    color: zone.color || fallbackColors[index % fallbackColors.length],
    range: `${zone.minBpm}-${zone.maxBpm} bpm`,
    seconds: seconds[index],
    percent: (seconds[index] / total) * 100,
  }));

  return { kind: 'hr', buckets, totalSeconds: total, samples };
}

/** Shortest activity the decoupling is computed on, in seconds. */
export const DECOUPLING_MIN_SECS = 1800;
/** Above this percentage the aerobic endurance does not hold the duration yet. */
export const DECOUPLING_THRESHOLD_PERCENT = 5;

/** Average power and heart rate of one half of the activity. */
export interface DecouplingHalf {
  /** Average power of the half, in watts. */
  watts: number;
  /** Average heart rate of the half, in bpm. */
  bpm: number;
  /** Watts per beat: the efficiency of the half. */
  ratio: number;
  /** Samples that carried both values. */
  samples: number;
}

/** Aerobic decoupling of an activity, or the reason why it is not available. */
export type DecouplingResult =
  | {
      status: 'ok';
      /** Drop of the power to heart rate ratio, in percent. Positive means drift. */
      percent: number;
      first: DecouplingHalf;
      second: DecouplingHalf;
      /** Span covered by the samples used, in seconds. */
      durationSecs: number;
    }
  | { status: 'unavailable'; reason: string };

/**
 * Aerobic decoupling: how much the power to heart rate ratio falls between the
 * first and the second half of the ride.
 *
 * Metric of Joe Friel (Pw:Hr for cycling), computed on the efficiency factor of
 * each half: EF = average power / average heart rate, and
 *
 *     decoupling = (EF of the first half - EF of the second half) / EF of the
 *                  first half * 100
 *
 * A positive value means the heart rate climbed for the same power, or the
 * power fell for the same heart rate. Friel puts the reference at 5 percent for
 * a long steady effort.
 *
 * Only the samples that carry both a power and a heart rate enter the average,
 * and the halves are split on the real elapsed time of those samples. Nothing
 * is estimated: a ride shorter than 30 minutes, or missing one of the two
 * series, gets a reason instead of a number.
 */
export function computeAerobicDecoupling(series: ActivitySeries | null): DecouplingResult {
  if (!series) {
    return {
      status: 'unavailable',
      reason: 'Mancano i dati registrati di questa attività.',
    };
  }
  if (!series.watts && !series.heartrate) {
    return {
      status: 'unavailable',
      reason: 'Questa attività non ha né la serie della potenza né quella del battito.',
    };
  }
  if (!series.watts) {
    return {
      status: 'unavailable',
      reason: 'Questa attività non ha la serie della potenza: serve per il confronto.',
    };
  }
  if (!series.heartrate) {
    return {
      status: 'unavailable',
      reason: 'Questa attività non ha la serie del battito: serve per il confronto.',
    };
  }

  const watts = series.watts;
  const heartrate = series.heartrate;
  const length = Math.min(series.timeSecs.length, watts.length, heartrate.length);

  const pairs: { t: number; watts: number; bpm: number }[] = [];
  for (let i = 0; i < length; i++) {
    const t = series.timeSecs[i];
    const power = watts[i];
    const bpm = heartrate[i];
    if (!Number.isFinite(t)) continue;
    if (power === null || !Number.isFinite(power) || power < 0) continue;
    if (bpm === null || !Number.isFinite(bpm) || bpm <= 0) continue;
    pairs.push({ t, watts: power, bpm });
  }

  if (pairs.length < 2) {
    return {
      status: 'unavailable',
      reason: 'Troppi pochi campioni con potenza e battito insieme.',
    };
  }

  const startT = pairs[0].t;
  const endT = pairs[pairs.length - 1].t;
  const durationSecs = endT - startT;
  if (durationSecs < DECOUPLING_MIN_SECS) {
    return {
      status: 'unavailable',
      reason:
        'Il disaccoppiamento si misura su almeno 30 minuti con potenza e battito insieme: in questa attività sono meno.',
    };
  }

  const middleT = startT + durationSecs / 2;
  const average = (part: typeof pairs): DecouplingHalf | null => {
    if (part.length === 0) return null;
    let sumWatts = 0;
    let sumBpm = 0;
    for (const pair of part) {
      sumWatts += pair.watts;
      sumBpm += pair.bpm;
    }
    const avgWatts = sumWatts / part.length;
    const avgBpm = sumBpm / part.length;
    if (avgBpm <= 0) return null;
    return { watts: avgWatts, bpm: avgBpm, ratio: avgWatts / avgBpm, samples: part.length };
  };

  const first = average(pairs.filter((pair) => pair.t < middleT));
  const second = average(pairs.filter((pair) => pair.t >= middleT));

  if (!first || !second) {
    return {
      status: 'unavailable',
      reason: 'Una delle due metà dell’uscita non ha campioni con potenza e battito.',
    };
  }
  if (first.ratio <= 0) {
    return {
      status: 'unavailable',
      reason: 'La potenza media della prima metà è zero: il rapporto non si può calcolare.',
    };
  }

  return {
    status: 'ok',
    percent: ((first.ratio - second.ratio) / first.ratio) * 100,
    first,
    second,
    durationSecs,
  };
}

/** Elapsed time as `h:mm:ss`, or `m:ss` under an hour. */
export function formatElapsed(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return '--';
  const total = Math.round(secs);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
