import { Activity, Athlete, CalendarEvent, PowerCurvePoint, SportSettings, Wellness } from '../../types/intervals';
import { HrZoneCustom } from '../../types';
import { getDefaultHrZones } from '../../utils/zones';

// Use Vite reverse proxy /api in development, or direct URL
const BASE_URL = import.meta.env.DEV ? '/api/v1' : 'https://intervals.icu/api/v1';

export class IntervalsApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'IntervalsApiError';
    this.status = status;
  }
}

function getAuthHeader(apiKey: string): string {
  const cleanKey = apiKey.trim();
  return `Basic ${btoa(`API_KEY:${cleanKey}`)}`;
}

async function request<T>(endpoint: string, apiKey: string): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: getAuthHeader(apiKey),
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new IntervalsApiError(
        'Invalid API Key or unauthorized access. Please verify your Intervals.icu API Key.',
        response.status
      );
    }
    if (response.status === 404) {
      throw new IntervalsApiError('Athlete or resource not found on Intervals.icu.', response.status);
    }
    throw new IntervalsApiError(`Intervals.icu API error (HTTP ${response.status})`, response.status);
  }

  return response.json();
}

export async function getAthleteProfile(apiKey: string, athleteId = '0'): Promise<Athlete> {
  const id = athleteId.trim() || '0';
  return request<Athlete>(`/athlete/${id}`, apiKey);
}

export async function getWellnessHistory(
  apiKey: string,
  athleteId = '0',
  oldestDate?: string,
  newestDate?: string
): Promise<Wellness[]> {
  const id = athleteId.trim() || '0';
  const params = new URLSearchParams();

  const today = new Date();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(today.getDate() - 90);

  params.append('oldest', oldestDate || ninetyDaysAgo.toISOString().split('T')[0]);
  params.append('newest', newestDate || today.toISOString().split('T')[0]);

  const list = await request<Wellness[]>(`/athlete/${id}/wellness?${params.toString()}`, apiKey);

  return list.map((item) => ({
    ...item,
    tsb:
      item.tsb !== undefined
        ? item.tsb
        : item.ctl !== undefined && item.atl !== undefined
        ? Math.round((item.ctl - item.atl) * 10) / 10
        : undefined,
  }));
}

export async function getActivities(
  apiKey: string,
  athleteId = '0',
  oldestDate?: string,
  newestDate?: string
): Promise<Activity[]> {
  const id = athleteId.trim() || '0';
  const params = new URLSearchParams();

  const today = new Date();
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(today.getDate() - 60);

  params.append('oldest', oldestDate || sixtyDaysAgo.toISOString().split('T')[0]);
  params.append('newest', newestDate || today.toISOString().split('T')[0]);

  const list = await request<Activity[]>(`/athlete/${id}/activities?${params.toString()}`, apiKey);

  return list.sort(
    (a, b) => new Date(b.start_date_local).getTime() - new Date(a.start_date_local).getTime()
  );
}

export async function getActivityDetails(apiKey: string, activityId: string): Promise<Activity> {
  return request<Activity>(`/activity/${activityId}`, apiKey);
}

export async function getActivityStreams(
  apiKey: string,
  activityId: string,
  types = 'latlng'
): Promise<any> {
  try {
    return await request<any>(`/activity/${activityId}/streams?types=${types}`, apiKey);
  } catch (err) {
    console.warn(`Could not fetch streams for activity ${activityId}:`, err);
    return null;
  }
}

export async function getCalendarEvents(
  apiKey: string,
  athleteId = '0',
  oldestDate?: string,
  newestDate?: string
): Promise<CalendarEvent[]> {
  const id = athleteId.trim() || '0';
  const params = new URLSearchParams();

  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 7);
  const twoWeeksAhead = new Date();
  twoWeeksAhead.setDate(today.getDate() + 14);

  params.append('oldest', oldestDate || weekAgo.toISOString().split('T')[0]);
  params.append('newest', newestDate || twoWeeksAhead.toISOString().split('T')[0]);

  return request<CalendarEvent[]>(`/athlete/${id}/events?${params.toString()}`, apiKey);
}

export function derivePowerCurve(ftp: number = 250, weight: number = 70): PowerCurvePoint[] {
  const w = weight > 0 ? weight : 70;
  const f = ftp > 0 ? ftp : 250;

  // Realistic Critical Power & W' power duration curve modeling:
  // Non-elite cyclists typically achieve ~78-82% of FTP in a continuous 60m ride unless performing a dedicated 1h TT.
  const steps = [
    { secs: 5, label: '5s', ratio: 2.10, seasonRatio: 2.25, cat: 'Sprint' as const },
    { secs: 15, label: '15s', ratio: 1.85, seasonRatio: 1.95, cat: 'Sprint' as const },
    { secs: 30, label: '30s', ratio: 1.55, seasonRatio: 1.65, cat: 'Anaerobic' as const },
    { secs: 60, label: '1m', ratio: 1.35, seasonRatio: 1.42, cat: 'Anaerobic' as const },
    { secs: 120, label: '2m', ratio: 1.20, seasonRatio: 1.26, cat: 'VO2 Max' as const },
    { secs: 300, label: '5m', ratio: 1.10, seasonRatio: 1.15, cat: 'VO2 Max' as const },
    { secs: 600, label: '10m', ratio: 1.02, seasonRatio: 1.06, cat: 'Threshold' as const },
    { secs: 1200, label: '20m', ratio: 0.96, seasonRatio: 1.00, cat: 'Threshold' as const },
    { secs: 3600, label: '1h', ratio: 0.78, seasonRatio: 0.82, cat: 'Endurance' as const },
  ];

  return steps.map((m) => {
    const watts = Math.round(f * m.ratio);
    const seasonWatts = Math.round(f * m.seasonRatio);
    return {
      secs: m.secs,
      label: m.label,
      watts,
      wkg: Number((watts / w).toFixed(1)),
      seasonWatts,
      seasonWkg: Number((seasonWatts / w).toFixed(1)),
      category: m.cat,
    };
  });
}

function extractCurve(obj: any): { secs: number[]; watts: number[] } | null {
  if (!obj) return null;
  if (Array.isArray(obj.secs) && Array.isArray(obj.watts) && obj.secs.length > 0) {
    return { secs: obj.secs, watts: obj.watts };
  }
  if (Array.isArray(obj.points)) {
    const secs: number[] = [];
    const watts: number[] = [];
    for (const p of obj.points) {
      if (typeof p.secs === 'number' && typeof p.watts === 'number') {
        secs.push(p.secs);
        watts.push(p.watts);
      }
    }
    if (secs.length > 0) return { secs, watts };
  }
  return null;
}

export async function getPowerCurves(
  apiKey: string,
  athleteId = '0',
  defaultFtp = 250,
  weight = 70,
  activitiesList?: Activity[]
): Promise<PowerCurvePoint[]> {
  const id = athleteId.trim() || '0';
  const targetSteps = [
    { secs: 5, label: '5s', cat: 'Sprint' as const },
    { secs: 15, label: '15s', cat: 'Sprint' as const },
    { secs: 30, label: '30s', cat: 'Anaerobic' as const },
    { secs: 60, label: '1m', cat: 'Anaerobic' as const },
    { secs: 120, label: '2m', cat: 'VO2 Max' as const },
    { secs: 300, label: '5m', cat: 'VO2 Max' as const },
    { secs: 600, label: '10m', cat: 'Threshold' as const },
    { secs: 1200, label: '20m', cat: 'Threshold' as const },
    { secs: 3600, label: '1h', cat: 'Endurance' as const },
  ];

  try {
    // Try multiple endpoint patterns for Intervals.icu
    let data: any = null;
    const endpointsToTry = [
      `/athlete/${id}/power-curves?curves=42d,1y`,
      `/athlete/${id}/power-curves?curves=42d,1y&type=Ride`,
      `/athlete/${id}/power-curves?curves=1y`,
      `/athlete/${id}/power-curves.json?curves=42d,1y`,
    ];

    for (const ep of endpointsToTry) {
      try {
        data = await request<any>(ep, apiKey);
        if (data) break;
      } catch {
        // try next endpoint
      }
    }

    let recentCurve: { secs: number[]; watts: number[] } | null = null;
    let seasonCurve: { secs: number[]; watts: number[] } | null = null;

    if (Array.isArray(data)) {
      for (const item of data) {
        const c = extractCurve(item);
        if (c) {
          if (!recentCurve) recentCurve = c;
          else if (!seasonCurve) seasonCurve = c;
        }
      }
    } else if (data && typeof data === 'object') {
      if (Array.isArray(data.curves)) {
        for (const item of data.curves) {
          const c = extractCurve(item);
          if (c) {
            if (!recentCurve) recentCurve = c;
            else if (!seasonCurve) seasonCurve = c;
          }
        }
      } else {
        recentCurve =
          extractCurve(data['42d']) ||
          extractCurve(data['s0']) ||
          extractCurve(data['1y']) ||
          extractCurve(data);
        seasonCurve =
          extractCurve(data['1y']) ||
          extractCurve(data['all']) ||
          recentCurve;
      }
    }

    if (recentCurve && recentCurve.watts && recentCurve.watts.length > 0) {
      const getWattsAtSecs = (curve: { secs: number[]; watts: number[] }, targetSec: number): number | null => {
        if (!curve.secs || !curve.watts || curve.watts.length === 0) return null;
        const secs = curve.secs;
        const watts = curve.watts;

        const idx = secs.indexOf(targetSec);
        if (idx >= 0 && typeof watts[idx] === 'number' && watts[idx] > 0) {
          return Math.round(watts[idx]);
        }

        let closestIdx = -1;
        let minDiff = Infinity;
        for (let i = 0; i < secs.length; i++) {
          const diff = Math.abs(secs[i] - targetSec);
          if (diff < minDiff && typeof watts[i] === 'number' && watts[i] > 0) {
            minDiff = diff;
            closestIdx = i;
          }
        }

        // Allow closest match within 20% of target duration
        if (closestIdx >= 0 && minDiff <= targetSec * 0.20) {
          return Math.round(watts[closestIdx]);
        }
        return null;
      };

      // Check if we can find 60m power from actual activities if curve doesn't reach 1h
      let best60mFromActivities: number | null = null;
      if (activitiesList && activitiesList.length > 0) {
        for (const act of activitiesList) {
          const dur = act.moving_time || act.elapsed_time || 0;
          if (dur >= 3500 && act.average_watts && act.average_watts > 0) {
            if (!best60mFromActivities || act.average_watts > best60mFromActivities) {
              best60mFromActivities = Math.round(act.average_watts);
            }
          }
        }
      }

      const points: PowerCurvePoint[] = [];
      let validCount = 0;

      for (const step of targetSteps) {
        let recentWatts = getWattsAtSecs(recentCurve, step.secs);
        let sWatts = seasonCurve ? getWattsAtSecs(seasonCurve, step.secs) : null;

        // If 60m is missing from recentCurve but present in seasonCurve or activities, use it
        if (step.secs === 3600) {
          if (!recentWatts && sWatts) recentWatts = sWatts;
          if (!recentWatts && best60mFromActivities) {
            recentWatts = best60mFromActivities;
            if (!sWatts) sWatts = best60mFromActivities;
          }
        }

        if (recentWatts !== null && recentWatts > 0) {
          validCount++;
          const finalSeasonWatts = sWatts !== null && sWatts >= recentWatts ? sWatts : recentWatts;
          points.push({
            secs: step.secs,
            label: step.label,
            watts: recentWatts,
            wkg: Number((recentWatts / weight).toFixed(1)),
            seasonWatts: finalSeasonWatts,
            seasonWkg: Number((finalSeasonWatts / weight).toFixed(1)),
            category: step.cat,
          });
        }
      }

      if (validCount >= 3) {
        return points;
      }
    }
  } catch (err) {
    console.warn('Intervals.icu power curves fetch exception:', err);
  }

  return derivePowerCurve(defaultFtp, weight);
}

export async function getAthleteSportSettings(
  apiKey: string,
  athleteId = '0',
  sport = 'Ride'
): Promise<SportSettings | null> {
  const id = athleteId.trim() || '0';
  try {
    const data = await request<SportSettings>(`/athlete/${id}/sport-settings/${sport}`, apiKey);
    if (data && data.hr_zones && data.hr_zones.length > 0) {
      return data;
    }
  } catch {
    // Specific endpoint fallback
  }

  try {
    const athlete = await getAthleteProfile(apiKey, id);
    if (athlete.sportSettings && Array.isArray(athlete.sportSettings)) {
      const match = athlete.sportSettings.find((s) => s.types?.includes(sport) || s.id === sport);
      if (match && match.hr_zones && match.hr_zones.length > 0) {
        return match;
      }
      if (athlete.sportSettings[0]?.hr_zones?.length) {
        return athlete.sportSettings[0];
      }
    }
  } catch {
    // Athlete profile fallback
  }

  return null;
}

export function sportSettingsToHrZones(
  sportSettings: SportSettings | null | undefined,
  maxHr = 190,
  restingHr = 55
): HrZoneCustom[] {
  if (!sportSettings || !sportSettings.hr_zones || sportSettings.hr_zones.length === 0) {
    return getDefaultHrZones(maxHr, restingHr);
  }

  const zoneColors = ['#94a3b8', '#38bdf8', '#4ade80', '#facc15', '#ef4444', '#fb923c', '#c084fc'];
  const defaultNames = [
    'Recovery',
    'Aerobic Base',
    'Tempo',
    'Threshold',
    'VO2 Max / Anaerobic',
    'Anaerobic Capacity',
    'Neuromuscular',
  ];

  const bounds = sportSettings.hr_zones; // Upper thresholds in BPM, e.g. [126, 148, 164, 178, 192]
  const names = sportSettings.hr_zone_names || [];

  return bounds.map((upperBpm, idx) => {
    const minBpm = idx === 0 ? Math.round(restingHr) : bounds[idx - 1];
    return {
      zone: idx + 1,
      name: names[idx] || defaultNames[idx] || `Zone ${idx + 1}`,
      minBpm,
      maxBpm: upperBpm,
      color: zoneColors[idx % zoneColors.length],
    };
  });
}
