/**
 * Activity start times are stored as *wall-clock local time*: the time shown on
 * the rider's bike computer, e.g. "2026-11-20T08:00:00".
 *
 * Sources disagree on the suffix: Intervals.icu sends no zone, Strava appends a
 * fake "Z" to its local time, Supabase returns "+00:00". Comparing them with
 * `new Date()` would shift some by the browser's UTC offset, so comparisons
 * use only the "YYYY-MM-DDTHH:mm:ss" digits and ignore any suffix.
 */

const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;

/** Milliseconds of the wall-clock part of a start time (suffix ignored). NaN if unparsable. */
export function wallClockMs(value: string | undefined | null): number {
  const m = value ? WALL_CLOCK.exec(value) : null;
  if (!m) return Number.NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Formats an instant as wall-clock local time, "YYYY-MM-DDTHH:mm:ss".
 * `offsetMinutes` is the local offset from UTC (e.g. +60 for Italy in winter);
 * defaults to this device's offset at that instant.
 */
export function toWallClockString(date: Date, offsetMinutes = -date.getTimezoneOffset()): string {
  const local = new Date(date.getTime() + offsetMinutes * 60_000);
  return (
    `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}` +
    `T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`
  );
}
