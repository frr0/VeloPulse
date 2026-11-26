import { describe, it, expect } from 'vitest';
import { generateFitFile } from '../../services/fit/fitGenerator';
import { SessionSummary } from '../../types';

describe('generateFitFile with virtual GPS tracks', () => {
  const baseSummary: SessionSummary = {
    startTime: new Date('2026-11-26T20:00:00Z'),
    endTime: new Date('2026-11-26T20:01:00Z'),
    totalElapsedTimeSeconds: 60,
    totalTimerTimeSeconds: 60,
    totalDistanceMeters: 500,
    avgPowerWatts: 220,
    maxPowerWatts: 280,
    normalizedPowerWatts: 225,
    avgCadenceRpm: 90,
    maxCadenceRpm: 98,
    avgHeartRateBpm: 148,
    maxHeartRateBpm: 162,
    avgSpeedKmh: 30,
    maxSpeedKmh: 35,
    totalWorkKj: 13.2,
    totalCaloriesKcal: 13,
    trainingStressScore: 2,
    intensityFactor: 0.9,
    samples: [
      {
        timestamp: new Date('2026-11-26T20:00:01Z'),
        elapsedSeconds: 1,
        power: 220,
        cadence: 90,
        heartRate: 148,
        speedMps: 8.33,
        distanceMeters: 10,
        targetPower: 220,
      },
      {
        timestamp: new Date('2026-11-26T20:00:30Z'),
        elapsedSeconds: 30,
        power: 230,
        cadence: 92,
        heartRate: 152,
        speedMps: 8.5,
        distanceMeters: 250,
        targetPower: 220,
      },
    ],
  };

  it.each(['valley', 'newyork', 'roma', 'paris'] as const)(
    'encodes a valid .FIT file for %s',
    (world) => {
      const bytes = generateFitFile({ ...baseSummary, virtualWorld: world });
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.byteLength).toBeGreaterThan(100);
      // FIT header magic bytes ".FIT" at offset 8..11
      const magic = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
      expect(magic).toBe('.FIT');
    }
  );
});
