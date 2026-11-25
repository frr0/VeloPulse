import { describe, expect, it } from 'vitest';
import {
  getDefaultHrZones,
  getHeartRateZoneNumber,
  getPowerZoneNumber,
  getPowerZones,
} from '../zones';

describe('zones', () => {
  it('computes 7 Coggan power zones and classifies watts', () => {
    const zones = getPowerZones(300);
    expect(zones).toHaveLength(7);
    expect(getPowerZoneNumber(150, 300)).toBe(1);
    expect(getPowerZoneNumber(210, 300)).toBe(2);
    expect(getPowerZoneNumber(255, 300)).toBe(3);
    expect(getPowerZoneNumber(300, 300)).toBe(4);
    expect(getPowerZoneNumber(345, 300)).toBe(5);
    expect(getPowerZoneNumber(420, 300)).toBe(6);
    expect(getPowerZoneNumber(600, 300)).toBe(7);
  });

  it('builds 5 default HR zones using Karvonen reserve and classifies BPM', () => {
    const hrZones = getDefaultHrZones(190, 50);
    expect(hrZones).toHaveLength(5);
    expect(hrZones[0].minBpm).toBe(50);
    expect(hrZones[4].maxBpm).toBe(190);
    expect(getHeartRateZoneNumber(100, 190, hrZones)).toBe(1);
    expect(getHeartRateZoneNumber(185, 190, hrZones)).toBe(5);
  });
});
