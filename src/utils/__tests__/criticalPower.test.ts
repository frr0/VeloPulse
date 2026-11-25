import { describe, expect, it } from 'vitest';
import { estimateCriticalPower } from '../criticalPower';

describe('criticalPower', () => {
  it('returns no-curve when samples are missing or empty', () => {
    expect(estimateCriticalPower(null, 'Recent')).toEqual({
      status: 'unavailable',
      reason: 'no-curve',
    });
    expect(estimateCriticalPower([], 'Recent')).toEqual({
      status: 'unavailable',
      reason: 'no-curve',
    });
  });

  it('returns durations-missing when fewer than two points are in 2..20 min', () => {
    const res = estimateCriticalPower(
      [
        { secs: 60, watts: 450, wkg: 6.4 },
        { secs: 300, watts: 340, wkg: 4.8 },
      ],
      'Recent 42D'
    );
    expect(res).toEqual({ status: 'unavailable', reason: 'durations-missing' });
  });

  it('fits CP and W-prime on valid 2..20 min samples', () => {
    // True model: CP = 280 W, W' = 18000 J -> P(t) = 280 + 18000 / t
    const res = estimateCriticalPower(
      [
        { secs: 180, watts: 380, wkg: null },
        { secs: 300, watts: 340, wkg: null },
        { secs: 720, watts: 305, wkg: null },
        { secs: 1200, watts: 295, wkg: null },
      ],
      'Recent 42D'
    );
    expect(res.status).toBe('ok');
    if (res.status === 'ok') {
      expect(res.estimate.cpWatts).toBe(280);
      expect(res.estimate.wPrimeJoules).toBe(18000);
      expect(res.estimate.sourceLabel).toBe('Recent 42D');
    }
  });
});
