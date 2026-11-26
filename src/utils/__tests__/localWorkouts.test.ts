import { describe, it, expect } from 'vitest';
import { isDuplicateActivity } from '../../services/localWorkouts';

describe('isDuplicateActivity', () => {
  it('detects identical activity IDs', () => {
    expect(
      isDuplicateActivity(
        { id: 'i123', start_date_local: '2026-11-26T10:00:00Z', moving_time: 1800 },
        { id: 'i123', start_date_local: '2026-11-26T12:00:00Z', moving_time: 3600 }
      )
    ).toBe(true);
  });

  it('detects cross-provider duplicate within 5 minutes and similar duration', () => {
    expect(
      isDuplicateActivity(
        { id: 'vp-local-1', start_date_local: '2026-11-26T10:00:00Z', moving_time: 2400 },
        { id: 'i999', start_date_local: '2026-11-26T10:02:15Z', moving_time: 2410 }
      )
    ).toBe(true);
  });

  it('does not flag different rides on the same day', () => {
    expect(
      isDuplicateActivity(
        { id: 'vp-local-1', start_date_local: '2026-11-26T08:00:00Z', moving_time: 1800 },
        { id: 'i999', start_date_local: '2026-11-26T18:00:00Z', moving_time: 1800 }
      )
    ).toBe(false);
  });

  it('does not flag rides with very different durations', () => {
    expect(
      isDuplicateActivity(
        { id: 'vp-local-1', start_date_local: '2026-11-26T10:00:00Z', moving_time: 300 },
        { id: 'i999', start_date_local: '2026-11-26T10:01:00Z', moving_time: 3600 }
      )
    ).toBe(false);
  });
});
