import { describe, expect, it } from 'vitest';
import { dedupeActivities } from '../../services/localWorkouts';
import type { Activity } from '../../types/intervals';
import { toWallClockString, wallClockMs } from '../activityTime';

const ride = (over: Partial<Activity>): Activity => ({
  id: 'x',
  name: 'Ride',
  type: 'Ride',
  start_date_local: '2026-11-20T08:00:00',
  moving_time: 3600,
  ...over,
});

describe('wall-clock times', () => {
  it('ignores zone suffixes that sources add to the same local time', () => {
    const base = wallClockMs('2026-11-20T08:00:00');
    expect(wallClockMs('2026-11-20T08:00:00Z')).toBe(base); // Strava
    expect(wallClockMs('2026-11-20T08:00:00+00:00')).toBe(base); // Supabase
    expect(wallClockMs('2026-11-20 08:00:00')).toBe(base);
    expect(Number.isNaN(wallClockMs('garbage'))).toBe(true);
  });

  it('formats an instant in a given UTC offset', () => {
    const instant = new Date('2026-11-20T07:00:00Z');
    expect(toWallClockString(instant, 60)).toBe('2026-11-20T08:00:00'); // Italy, winter
    expect(toWallClockString(new Date('2026-07-01T23:30:00Z'), 120)).toBe('2026-07-02T01:30:00');
  });
});

describe('dedupeActivities', () => {
  it('shows one ride sent by Intervals.icu, Strava, a Garmin file and the app', () => {
    const result = dedupeActivities([
      ride({ id: 'strava-1', source: 'strava', start_date_local: '2026-11-20T08:00:00Z', summary_polyline: 'abc' }),
      ride({ id: 'i123', source: 'intervals', start_date_local: '2026-11-20T08:00:00+00:00', icu_training_load: 80 }),
      ride({ id: 'fit_1', source: 'garmin', start_date_local: '2026-11-20T08:01:00', moving_time: 3590 }),
      ride({ id: 'vp-local-1', source: 'velopulse', start_date_local: '2026-11-20T07:59:30', moving_time: 3610 }),
    ]);

    expect(result).toHaveLength(1);
    const [merged] = result;
    expect(merged.id).toBe('i123'); // Intervals.icu leads: its id loads full streams
    expect(merged.icu_training_load).toBe(80);
    expect(merged.summary_polyline).toBe('abc'); // filled from Strava
    expect(new Set(merged.sources)).toEqual(new Set(['intervals', 'strava', 'garmin', 'velopulse']));
  });

  it('keeps the leading source values and only fills missing fields', () => {
    const [merged] = dedupeActivities([
      ride({ id: 's', source: 'strava', name: 'Strava title', average_watts: 199 }),
      ride({ id: 'i', source: 'intervals', name: 'Intervals title', average_watts: 201 }),
    ]);
    expect(merged.name).toBe('Intervals title');
    expect(merged.average_watts).toBe(201);
  });

  it('keeps two different rides on the same day apart', () => {
    const result = dedupeActivities([
      ride({ id: 'morning', start_date_local: '2026-11-20T08:00:00' }),
      ride({ id: 'evening', start_date_local: '2026-11-20T18:00:00' }),
      ride({ id: 'short', start_date_local: '2026-11-20T08:02:00', moving_time: 900 }),
    ]);
    expect(result.map((a) => a.id).sort()).toEqual(['evening', 'morning', 'short']);
  });

  it('sorts newest first by wall-clock time', () => {
    const result = dedupeActivities([
      ride({ id: 'old', start_date_local: '2026-11-19T08:00:00Z' }),
      ride({ id: 'new', start_date_local: '2026-11-20T08:00:00' }),
    ]);
    expect(result.map((a) => a.id)).toEqual(['new', 'old']);
  });
});
