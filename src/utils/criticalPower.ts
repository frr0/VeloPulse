import { PowerCurveSample } from '../types/intervals';

/** Shortest effort used to fit the critical power model, in seconds. */
export const CP_MIN_SECS = 120;
/** Longest effort used to fit the critical power model, in seconds. */
export const CP_MAX_SECS = 1200;

/** CP and W' fitted on a mean maximal power curve. Both values are estimates. */
export interface CriticalPowerEstimate {
  /** Critical power, in watts. */
  cpWatts: number;
  /** Finite work capacity above CP, in joules. */
  wPrimeJoules: number;
  /** Durations of the curve that entered the fit, in seconds, ascending. */
  durationsSecs: number[];
  /** Label of the curve the fit used, for example `Recent 42D`. */
  sourceLabel: string;
}

/**
 * Why there is no estimate. A code, not a sentence: the power section writes in
 * English and the activity page in Italian, so each one writes its own text.
 *
 * - `no-curve`: Intervals.icu returned no power curve at all;
 * - `durations-missing`: fewer than two durations between 2 and 20 minutes;
 * - `durations-too-close`: the durations do not spread enough to fit a line;
 * - `model-not-applicable`: the fit returned a non positive CP or W'.
 */
export type CriticalPowerUnavailableReason =
  | 'no-curve'
  | 'durations-missing'
  | 'durations-too-close'
  | 'model-not-applicable';

/**
 * Outcome of the fit. `unavailable` carries the reason, so the page can say why
 * there is no estimate instead of showing a made up number.
 */
export type CriticalPowerResult =
  | { status: 'ok'; estimate: CriticalPowerEstimate }
  | { status: 'unavailable'; reason: CriticalPowerUnavailableReason };

/**
 * Fits the two-parameter critical power model on a mean maximal power curve.
 *
 * Model: Monod, H., & Scherrer, J. (1965). The work capacity of a synergic
 * muscular group. Ergonomics, 8(3), 329-338. Reviewed by Hill, D. W. (1993).
 * The critical power concept. A review. Sports Medicine, 16(4), 237-254.
 *
 * The model splits the effort in two sources: an aerobic rate that the athlete
 * holds for a long time (CP) and a finite reserve above it (W'). The work W an
 * athlete can produce in a time t is then a straight line in t:
 *
 *     W = CP * t + W'        (work form)
 *     P = CP + W' / t        (power form, the same line divided by t)
 *
 * So a least squares fit of the work W = P * t against the time t returns CP as
 * the slope and W' as the intercept.
 *
 * Only the durations between 2 and 20 minutes enter the fit. Below 2 minutes
 * the limit is neuromuscular and the model does not hold; above 20 minutes the
 * power approaches CP and the line loses its slope. Hill (1993) makes the same
 * point: the parameters are only as good as the durations chosen for the fit.
 *
 * Nothing is invented: with fewer than two durations in that window, or with a
 * fit that returns a non positive CP or W', the function reports why instead.
 */
export function estimateCriticalPower(
  samples: PowerCurveSample[] | null | undefined,
  sourceLabel: string
): CriticalPowerResult {
  if (!Array.isArray(samples) || samples.length === 0) {
    return { status: 'unavailable', reason: 'no-curve' };
  }

  // One point per duration: a curve that repeats the same duration would weigh
  // it twice in the fit.
  const byDuration = new Map<number, number>();
  for (const sample of samples) {
    if (!Number.isFinite(sample.secs) || !Number.isFinite(sample.watts)) continue;
    if (sample.secs < CP_MIN_SECS || sample.secs > CP_MAX_SECS) continue;
    if (sample.watts <= 0) continue;
    byDuration.set(sample.secs, sample.watts);
  }

  const durationsSecs = Array.from(byDuration.keys()).sort((a, b) => a - b);
  if (durationsSecs.length < 2) {
    return { status: 'unavailable', reason: 'durations-missing' };
  }

  // Least squares fit of W = CP * t + W'. The slope is CP, the intercept W'.
  const n = durationsSecs.length;
  let sumT = 0;
  let sumW = 0;
  let sumTT = 0;
  let sumTW = 0;
  for (const secs of durationsSecs) {
    const watts = byDuration.get(secs) as number;
    const work = watts * secs;
    sumT += secs;
    sumW += work;
    sumTT += secs * secs;
    sumTW += secs * work;
  }

  const denominator = n * sumTT - sumT * sumT;
  if (denominator <= 0) {
    return { status: 'unavailable', reason: 'durations-too-close' };
  }

  const cpWatts = (n * sumTW - sumT * sumW) / denominator;
  const wPrimeJoules = (sumW - cpWatts * sumT) / n;

  if (!Number.isFinite(cpWatts) || !Number.isFinite(wPrimeJoules)) {
    return { status: 'unavailable', reason: 'model-not-applicable' };
  }

  if (cpWatts <= 0 || wPrimeJoules <= 0) {
    return { status: 'unavailable', reason: 'model-not-applicable' };
  }

  return {
    status: 'ok',
    estimate: {
      cpWatts: Math.round(cpWatts),
      wPrimeJoules: Math.round(wPrimeJoules),
      durationsSecs,
      sourceLabel,
    },
  };
}

/** Share of W' below which the reserve is reported as nearly spent. */
export const WBAL_LOW_FRACTION = 0.25;

/** One point of the W'bal curve. `joules` is null where the power was not recorded. */
export interface WbalPoint {
  /** Elapsed time of the sample, in seconds. */
  t: number;
  /** Reserve left at that moment, in joules. null where there is no power value. */
  joules: number | null;
}

/**
 * W'bal over time: how much of the reserve above CP is left, instant by instant.
 *
 * Formula: the differential model of Skiba, P. F., Fulford, J., Clarke, D. C.,
 * Vanhatalo, A., & Jones, A. M. (2015). Intramuscular determinants of the
 * ability to recover work capacity above critical power. European Journal of
 * Applied Physiology, 115(4), 703-713. The same model was developed in parallel
 * by Andrew Froncioni, and the published paper is the joint result.
 *
 * At every step the reserve moves by:
 *
 *     dW'bal = (CP - P) * dt                          when P > CP   (spending)
 *     dW'bal = (CP - P) * (W' - W'bal) / W' * dt      when P <= CP  (recovery)
 *
 * Above CP the reserve drops by the excess power. Below CP it refills at a
 * speed that depends on how far below CP the athlete is riding and on how much
 * of the reserve is still empty, so the last part of the reserve comes back
 * slowest. Unlike the earlier integral model of Skiba et al. (2012) this form
 * carries no fitted coefficients.
 *
 * The reserve is allowed to go negative: a negative value says the athlete went
 * past the capacity the model estimated, and hiding it would be a made up
 * number. The upper bound stays at W', because the reserve never grows past
 * full.
 *
 * Samples without a power value produce a null point: the gap stays a gap and
 * the reserve does not move.
 */
export function computeWbalSeries(
  timeSecs: number[],
  watts: (number | null)[],
  cpWatts: number,
  wPrimeJoules: number,
  fallbackIntervalSecs = 1
): WbalPoint[] {
  if (
    !Array.isArray(timeSecs) ||
    !Array.isArray(watts) ||
    timeSecs.length === 0 ||
    !Number.isFinite(cpWatts) ||
    !Number.isFinite(wPrimeJoules) ||
    cpWatts <= 0 ||
    wPrimeJoules <= 0
  ) {
    return [];
  }

  const points: WbalPoint[] = [];
  let balance = wPrimeJoules;
  const length = Math.min(timeSecs.length, watts.length);

  for (let i = 0; i < length; i++) {
    const t = timeSecs[i];
    if (!Number.isFinite(t)) continue;

    const power = watts[i];
    if (power === null || !Number.isFinite(power)) {
      points.push({ t, joules: null });
      continue;
    }

    // Real elapsed time between samples. A recording gap is real time in which
    // the athlete recovered, so it is not shortened.
    let dt = i === 0 ? fallbackIntervalSecs : t - timeSecs[i - 1];
    if (!Number.isFinite(dt) || dt <= 0) dt = 0;

    if (dt > 0) {
      if (power > cpWatts) {
        balance -= (power - cpWatts) * dt;
      } else {
        balance += (cpWatts - power) * ((wPrimeJoules - balance) / wPrimeJoules) * dt;
      }
      // A long step of the Euler integration could overshoot a full reserve.
      if (balance > wPrimeJoules) balance = wPrimeJoules;
    }

    points.push({ t, joules: balance });
  }

  return points;
}
