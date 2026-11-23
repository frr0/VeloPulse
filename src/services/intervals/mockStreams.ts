import type { ActivityStream } from './api';
import { decodePolyline } from '../../utils/polyline';
import { DEMO_OUTDOOR_POLYLINE } from './mockData';

// Demo-only streams for the outdoor ride of the demonstration account
// (RF-014). The demo never calls Intervals.icu, so these streams are built
// in the app, with the same shape Intervals.icu answers with: a `type` and a
// `data` array (and `data2` for `latlng`, see below). readActivitySeries and
// every chart and histogram of the activity page then run on this data
// exactly as they run on a real answer: nothing in those functions is aware
// that the numbers are made up.
//
// Every value below comes from a fixed formula over a short list of
// hand-picked waypoints (time, value), eased with a smoothstep and textured
// with a few fixed sine terms: no Math.random anywhere. Loading the demo
// twice, or recomputing the summary of the activity from these streams,
// always gives the same numbers (RF-014 point 4).

/** The only activity of the demo that carries recorded streams. */
const DEMO_OUTDOOR_ACTIVITY_ID = 'act_100';

/**
 * Sampling step of the demo streams, in seconds. Real head units often
 * record slower than 1Hz; 5s keeps the payload small and exercises the
 * interval detection of readActivitySeries instead of relying on its 1Hz
 * default.
 */
const SAMPLE_INTERVAL_SECS = 5;

/** Moving time of the demo ride, src/services/intervals/mockData.ts act_100. */
const MOVING_TIME_SECS = 6540;

const SAMPLE_COUNT = Math.floor(MOVING_TIME_SECS / SAMPLE_INTERVAL_SECS);

interface Waypoint {
  /** Elapsed seconds from the start of the ride. */
  t: number;
  /** Value at that moment. */
  v: number;
}

/** Cosine-style ease between 0 and 1, so the curve has no sharp corners. */
function smoothstep(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

/**
 * Value of a hand-picked waypoint curve at `t`, eased between the two
 * waypoints that bracket it. Flat before the first and after the last.
 */
function waypointValue(waypoints: Waypoint[], t: number): number {
  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];
  if (t <= first.t) return first.v;
  if (t >= last.t) return last.v;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t;
      const ratio = span > 0 ? smoothstep((t - a.t) / span) : 0;
      return a.v + (b.v - a.v) * ratio;
    }
  }
  return last.v;
}

/** Fixed sine texture: deterministic, never Math.random. */
function ripple(t: number, amplitude: number, periodSecs: number, phase = 0): number {
  return amplitude * Math.sin((2 * Math.PI * t) / periodSecs + phase);
}

// Altitude (m): flat rollout, climb 1, a flat/rolling middle stretch, climb
// 2, a fast descent and a flat run home back to the start altitude (the
// loop is closed). The two climbs straddle the midpoint of the elapsed time
// (one mostly before it, one mostly after), so the two halves the aerobic
// decoupling compares carry a similar mix of climbing and flat riding: what
// moves the decoupling is the heart rate drift of buildHeartrate, not the
// terrain landing more on one half than the other. Total gain: 742m (2 on
// the rollout, 400 on climb 1, 340 on climb 2), the total_elevation_gain
// declared in mockData.ts.
const ALTITUDE_WAYPOINTS: Waypoint[] = [
  { t: 0, v: 150.0 },
  { t: 200, v: 152.0 },
  { t: 1700, v: 552.0 },
  { t: 1900, v: 532.0 },
  { t: 3270, v: 532.0 },
  { t: 4400, v: 872.0 },
  { t: 4550, v: 856.0 },
  { t: 5400, v: 190.0 },
  { t: 5550, v: 180.0 },
  { t: 6535, v: 152.0 },
];

// Power (W): endurance pace on the flats, 250-290W on the two climbs, an
// easy recovery stretch between them and a long coast on the fast descent.
// The recovery stretch (1700-2600s) keeps the first half of the ride from
// averaging much higher than the second (which carries the coast of the
// descent): see the note on ALTITUDE_WAYPOINTS above.
const POWER_WAYPOINTS: Waypoint[] = [
  { t: 0, v: 140 },
  { t: 120, v: 165 },
  { t: 200, v: 185 },
  { t: 500, v: 255 },
  { t: 900, v: 275 },
  { t: 1300, v: 265 },
  { t: 1700, v: 245 },
  { t: 1800, v: 140 },
  { t: 2000, v: 95 },
  { t: 2300, v: 100 },
  { t: 2600, v: 170 },
  { t: 3270, v: 200 },
  { t: 3400, v: 230 },
  { t: 3800, v: 270 },
  { t: 4200, v: 290 },
  { t: 4400, v: 285 },
  { t: 4550, v: 160 },
  { t: 4650, v: 110 },
  { t: 4750, v: 130 },
  { t: 5000, v: 100 },
  { t: 5400, v: 90 },
  { t: 5550, v: 150 },
  { t: 5750, v: 200 },
  { t: 6535, v: 190 },
];

// Cadence (rpm): a bit lower on the climbs, lowest while coasting the fast
// descent.
const CADENCE_WAYPOINTS: Waypoint[] = [
  { t: 0, v: 75 },
  { t: 150, v: 86 },
  { t: 200, v: 89 },
  { t: 1700, v: 83 },
  { t: 1800, v: 78 },
  { t: 1900, v: 72 },
  { t: 2100, v: 87 },
  { t: 3270, v: 88 },
  { t: 3400, v: 83 },
  { t: 4400, v: 80 },
  { t: 4550, v: 76 },
  { t: 4650, v: 65 },
  { t: 4750, v: 74 },
  { t: 5000, v: 50 },
  { t: 5300, v: 30 },
  { t: 5550, v: 74 },
  { t: 5750, v: 89 },
  { t: 6535, v: 88 },
];

// Speed (m/s), as Intervals.icu reports velocity_smooth: slow on the two
// climbs, a peak on the fast descent, steady on the flats.
const VELOCITY_WAYPOINTS: Waypoint[] = [
  { t: 0, v: 3.5 },
  { t: 150, v: 7.0 },
  { t: 250, v: 7.8 },
  { t: 1700, v: 3.3 },
  { t: 1800, v: 6.0 },
  { t: 1900, v: 10.2 },
  { t: 2100, v: 7.5 },
  { t: 3270, v: 7.8 },
  { t: 3400, v: 5.0 },
  { t: 4400, v: 3.0 },
  { t: 4550, v: 5.5 },
  { t: 4650, v: 9.8 },
  { t: 4750, v: 8.3 },
  { t: 5000, v: 12.3 },
  { t: 5200, v: 15.8 },
  { t: 5300, v: 16.8 },
  { t: 5400, v: 14.8 },
  { t: 5550, v: 9.8 },
  { t: 5750, v: 8.8 },
  { t: 6535, v: 9.3 },
];

function buildTimeSecs(): number[] {
  return Array.from({ length: SAMPLE_COUNT }, (_, i) => i * SAMPLE_INTERVAL_SECS);
}

function buildAltitude(timeSecs: number[]): number[] {
  return timeSecs.map(
    (t) => Math.round((waypointValue(ALTITUDE_WAYPOINTS, t) + ripple(t, 0.15, 55, 0.3)) * 10) / 10
  );
}

function buildPower(timeSecs: number[]): number[] {
  return timeSecs.map((t) => {
    const value = waypointValue(POWER_WAYPOINTS, t) + ripple(t, 15, 23, 0.6) + ripple(t, 6, 7, 1.4);
    return Math.max(0, Math.round(value));
  });
}

function buildCadence(timeSecs: number[]): number[] {
  return timeSecs.map((t) => {
    const value = waypointValue(CADENCE_WAYPOINTS, t) + ripple(t, 3, 11, 0.9);
    return Math.max(0, Math.round(value));
  });
}

function buildVelocity(timeSecs: number[]): number[] {
  return timeSecs.map((t) => {
    const value = waypointValue(VELOCITY_WAYPOINTS, t) + ripple(t, 0.35, 13, 0.4);
    return Math.max(0.2, Math.round(value * 100) / 100);
  });
}

/**
 * Heart rate (bpm): a first-order lag of the power, so the heart rate trails
 * the effort by a few tens of seconds like a real athlete, plus a slow
 * upward drift over the ride so the same power costs a bit more heart rate
 * near the end. The drift is what makes the aerobic decoupling of this ride
 * come out positive and small, instead of being written in directly.
 */
function buildHeartrate(timeSecs: number[], power: number[]): number[] {
  const tauSecs = 40;
  const totalSecs = timeSecs[timeSecs.length - 1];
  const heartrate: number[] = [];
  let value = 92;

  for (let i = 0; i < timeSecs.length; i++) {
    const t = timeSecs[i];
    const driftBpm = 6 * (t / totalSecs);
    const target = Math.min(184, Math.max(62, 94 + power[i] * 0.27 + driftBpm));
    const dt = i === 0 ? SAMPLE_INTERVAL_SECS : t - timeSecs[i - 1];
    const alpha = dt / (tauSecs + dt);
    value = value + (target - value) * alpha;
    heartrate.push(Math.round(value));
  }

  return heartrate;
}

/**
 * Resamples the decoded polyline to `sampleCount` points by linear
 * interpolation on the point index of the 221-point loop: the same source
 * the map draws from, so the charts can never show a different path.
 */
function buildLatLng(sampleCount: number): { lat: number[]; lng: number[] } {
  const points = decodePolyline(DEMO_OUTDOOR_POLYLINE);
  const lastIndex = points.length - 1;
  const lat: number[] = [];
  const lng: number[] = [];

  for (let i = 0; i < sampleCount; i++) {
    const position = (i / (sampleCount - 1)) * lastIndex;
    const low = Math.floor(position);
    const high = Math.min(lastIndex, low + 1);
    const ratio = position - low;
    const [lowLat, lowLng] = points[low];
    const [highLat, highLng] = points[high];
    lat.push(lowLat + (highLat - lowLat) * ratio);
    lng.push(lowLng + (highLng - lowLng) * ratio);
  }

  return { lat, lng };
}

/**
 * Streams of the demo outdoor ride (RF-014), shaped exactly like the answer
 * of `GET /activity/{id}/streams` on Intervals.icu: a list of
 * `{ type, data }`, with `data2` carrying the longitudes of the `latlng`
 * stream. `readActivitySeries` and the rest of the activity page read these
 * like a real answer, so the demo draws its charts, histograms, W'bal and
 * decoupling with the very same code that runs on a real Intervals.icu key.
 *
 * Returns null for every activity other than the one outdoor ride: the other
 * demo activities keep showing the "no recorded data" message of RF-014
 * point 5.
 */
export function getDemoActivityStreams(activityId: string): ActivityStream[] | null {
  if (activityId !== DEMO_OUTDOOR_ACTIVITY_ID) return null;

  const timeSecs = buildTimeSecs();
  const altitude = buildAltitude(timeSecs);
  const power = buildPower(timeSecs);
  const cadence = buildCadence(timeSecs);
  const velocity = buildVelocity(timeSecs);
  const heartrate = buildHeartrate(timeSecs, power);
  const { lat, lng } = buildLatLng(timeSecs.length);

  return [
    { type: 'latlng', data: lat, data2: lng },
    { type: 'time', data: timeSecs },
    { type: 'altitude', data: altitude },
    { type: 'heartrate', data: heartrate },
    { type: 'watts', data: power },
    { type: 'cadence', data: cadence },
    { type: 'velocity_smooth', data: velocity },
  ];
}
