import { describe, expect, it } from 'vitest';
import {
  computeRecoveryScore,
  formatDistance,
  formatDuration,
  getFormStatus,
} from '../formatters';

describe('formatters', () => {
  it('formats durations cleanly', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(125)).toBe('2m 5s');
    expect(formatDuration(3660)).toBe('1h 1m');
  });

  it('formats metric and imperial distances', () => {
    expect(formatDistance(10000, false)).toBe('10.0 km');
    expect(formatDistance(16093.44, true)).toBe('10.0 mi');
    expect(formatDistance(0)).toBe('0.0 km');
  });

  it('classifies TSB form status accurately', () => {
    expect(getFormStatus(20).label).toBe('Very Fresh');
    expect(getFormStatus(10).label).toBe('Fresh & Race Ready');
    expect(getFormStatus(0).label).toBe('Neutral');
    expect(getFormStatus(-20).label).toBe('Optimal Training');
    expect(getFormStatus(-35).label).toBe('High Fatigue');
    expect(getFormStatus(-50).label).toBe('Overreaching Risk');
  });

  it('never fabricates a recovery score when biometric data is missing', () => {
    expect(computeRecoveryScore(undefined)).toBeNull();
    expect(computeRecoveryScore({ id: '2026-11-25', ctl: 70, atl: 65 })).toBeNull();
  });

  it('uses readiness directly when present and clamps to 0..100', () => {
    expect(computeRecoveryScore({ id: '2026-11-25', readiness: 88 })).toBe(88);
    expect(computeRecoveryScore({ id: '2026-11-25', readiness: 120 })).toBe(100);
  });

  it('computes recovery score when real biometrics exist', () => {
    const score = computeRecoveryScore({
      id: '2026-11-25',
      hrv: 80,
      sleepSecs: 8 * 3600,
      restingHR: 45,
    });
    expect(score).not.toBeNull();
    expect(score!).toBeGreaterThanOrEqual(80);
  });
});
