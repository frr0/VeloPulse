import { Activity, Athlete, CalendarEvent, PowerCurvePoint, Wellness } from '../../types/intervals';

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
  // 5s sprint ~2.10x FTP (season ~2.25x)
  // 15s ~1.85x FTP (season ~1.95x)
  // 30s ~1.55x FTP (season ~1.65x)
  // 1m ~1.35x FTP (season ~1.42x)
  // 2m ~1.20x FTP (season ~1.26x)
  // 5m ~1.12x FTP (season ~1.16x)
  // 10m ~1.06x FTP (season ~1.09x)
  // 20m ~1.02x FTP (season ~1.05x)
  // 1h ~0.94x FTP (season ~0.96x)
  const steps = [
    { secs: 5, label: '5s', ratio: 2.10, seasonRatio: 2.25, cat: 'Sprint' as const },
    { secs: 15, label: '15s', ratio: 1.85, seasonRatio: 1.95, cat: 'Sprint' as const },
    { secs: 30, label: '30s', ratio: 1.55, seasonRatio: 1.65, cat: 'Anaerobic' as const },
    { secs: 60, label: '1m', ratio: 1.35, seasonRatio: 1.42, cat: 'Anaerobic' as const },
    { secs: 120, label: '2m', ratio: 1.20, seasonRatio: 1.26, cat: 'VO2 Max' as const },
    { secs: 300, label: '5m', ratio: 1.12, seasonRatio: 1.16, cat: 'VO2 Max' as const },
    { secs: 600, label: '10m', ratio: 1.06, seasonRatio: 1.09, cat: 'Threshold' as const },
    { secs: 1200, label: '20m', ratio: 1.02, seasonRatio: 1.05, cat: 'Threshold' as const },
    { secs: 3600, label: '1h', ratio: 0.94, seasonRatio: 0.96, cat: 'Endurance' as const },
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

export async function getPowerCurves(
  apiKey: string,
  athleteId = '0',
  defaultFtp = 250,
  weight = 70
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
    const data = await request<any>(`/athlete/${id}/power-curves.json?curves=42d,1y&type=Ride`, apiKey);
    
    let recentCurve: { secs?: number[]; watts?: number[] } | null = null;
    let seasonCurve: { secs?: number[]; watts?: number[] } | null = null;

    if (Array.isArray(data)) {
      recentCurve = data[0] || null;
      seasonCurve = data[1] || data[0] || null;
    } else if (data && typeof data === 'object') {
      if (Array.isArray(data.curves)) {
        recentCurve = data.curves[0];
        seasonCurve = data.curves[1] || data.curves[0];
      } else if (data.secs && data.watts) {
        recentCurve = data;
        seasonCurve = data;
      }
    }

    if (recentCurve && Array.isArray(recentCurve.secs) && Array.isArray(recentCurve.watts) && recentCurve.watts.length > 0) {
      const getWattsAtSecs = (curve: { secs?: number[]; watts?: number[] }, targetSec: number): number | null => {
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

        if (closestIdx >= 0 && minDiff <= targetSec * 0.3) {
          return Math.round(watts[closestIdx]);
        }
        return null;
      };

      const points: PowerCurvePoint[] = [];
      let validCount = 0;

      for (const step of targetSteps) {
        const recentWatts = getWattsAtSecs(recentCurve, step.secs);
        const sWatts = seasonCurve ? getWattsAtSecs(seasonCurve, step.secs) : null;

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
