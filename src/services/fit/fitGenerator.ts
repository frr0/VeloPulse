import { Encoder, Profile } from '@garmin/fitsdk';
import { SessionSummary } from '../../types';

export type VirtualWorldId = 'valley' | 'newyork' | 'roma' | 'paris';

const DEG_TO_SEMICIRCLES = 2147483648 / 180;

/**
 * Closed-loop real-world GPS waypoints [lat, lon, altitudeMeters] for each virtual world.
 * Used to embed a realistic virtual ride map track into exported .FIT files
 * (recognized by Intervals.icu, Strava, Garmin Connect as Virtual Cycling).
 */
const VIRTUAL_WORLD_ROUTES: Record<VirtualWorldId, [number, number, number][]> = {
  // Dolomites / Cortina scenic valley loop (~5.6 km)
  valley: [
    [46.5368, 12.1355, 1224],
    [46.5415, 12.1420, 1245],
    [46.5480, 12.1475, 1272],
    [46.5535, 12.1410, 1288],
    [46.5520, 12.1305, 1265],
    [46.5455, 12.1255, 1240],
    [46.5390, 12.1290, 1228],
    [46.5368, 12.1355, 1224],
  ],
  // New York — Central Park Drive Loop (~9.7 km)
  newyork: [
    [40.7681, -73.9815, 25],
    [40.7736, -73.9712, 29],
    [40.7812, -73.9632, 34],
    [40.7905, -73.9565, 38],
    [40.7992, -73.9522, 42],
    [40.8002, -73.9585, 36],
    [40.7935, -73.9665, 32],
    [40.7850, -73.9735, 28],
    [40.7755, -73.9792, 26],
    [40.7681, -73.9815, 25],
  ],
  // Rome — Colosseum / Circo Massimo / Lungotevere loop (~6.0 km)
  roma: [
    [41.8902, 12.4922, 24],
    [41.8860, 12.4855, 20],
    [41.8888, 12.4788, 18],
    [41.8962, 12.4730, 19],
    [41.9012, 12.4765, 22],
    [41.8985, 12.4855, 28],
    [41.8945, 12.4915, 26],
    [41.8902, 12.4922, 24],
  ],
  // Paris — Champs-Élysées / Arc de Triomphe / Eiffel Tower / Seine loop (~6.4 km)
  paris: [
    [48.8656, 2.3212, 35],
    [48.8708, 2.3075, 42],
    [48.8738, 2.2950, 52],
    [48.8655, 2.2895, 38],
    [48.8584, 2.2945, 33],
    [48.8598, 2.3065, 32],
    [48.8620, 2.3175, 34],
    [48.8656, 2.3212, 35],
  ],
};

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function buildRouteSampler(world: VirtualWorldId) {
  const pts = VIRTUAL_WORLD_ROUTES[world];
  const cumDist: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    const d = haversineMeters(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    cumDist.push(cumDist[i - 1] + d);
  }
  const totalLen = Math.max(1, cumDist[cumDist.length - 1]);

  return (
    distanceMeters: number
  ): { lat: number; lon: number; latSemi: number; lonSemi: number; altitude: number } => {
    const d = ((distanceMeters % totalLen) + totalLen) % totalLen;
    let idx = 0;
    while (idx < cumDist.length - 2 && cumDist[idx + 1] < d) {
      idx++;
    }
    const segLen = Math.max(0.001, cumDist[idx + 1] - cumDist[idx]);
    const frac = (d - cumDist[idx]) / segLen;
    const lat = pts[idx][0] + (pts[idx + 1][0] - pts[idx][0]) * frac;
    const lon = pts[idx][1] + (pts[idx + 1][1] - pts[idx][1]) * frac;
    const alt = pts[idx][2] + (pts[idx + 1][2] - pts[idx][2]) * frac;

    return {
      lat,
      lon,
      latSemi: Math.round(lat * DEG_TO_SEMICIRCLES),
      lonSemi: Math.round(lon * DEG_TO_SEMICIRCLES),
      altitude: Number(alt.toFixed(1)),
    };
  };
}

export function generateFitFile(summary: SessionSummary): Uint8Array {
  const encoder = new Encoder();

  const startTime = summary.startTime instanceof Date ? summary.startTime : new Date(summary.startTime || Date.now());
  const endTime = summary.endTime instanceof Date ? summary.endTime : new Date(summary.endTime || Date.now());
  const world: VirtualWorldId = summary.virtualWorld || 'valley';
  const sampleGps = buildRouteSampler(world);

  // 1. File ID Message
  encoder.onMesg(Profile.MesgNum.FILE_ID, {
    type: 'activity',
    manufacturer: 'development',
    product: 1,
    serialNumber: Math.floor(startTime.getTime() / 1000),
    timeCreated: startTime,
  } as any);

  // 2. Timer Start Event
  encoder.onMesg(Profile.MesgNum.EVENT, {
    timestamp: startTime,
    event: 'timer',
    eventType: 'start',
  } as any);

  // 3. Record Messages (one per recorded second, with synthetic virtual GPS coordinates)
  if (summary.samples && summary.samples.length > 0) {
    summary.samples.forEach((sample) => {
      const ts = sample.timestamp instanceof Date ? sample.timestamp : new Date(sample.timestamp);
      const dist = Number((sample.distanceMeters || 0).toFixed(1));
      const gps = sampleGps(dist);

      const recordMesg: Record<string, any> = {
        timestamp: ts,
        positionLat: gps.latSemi,
        positionLong: gps.lonSemi,
        altitude: gps.altitude,
        distance: dist,
        speed: Number((sample.speedMps || 0).toFixed(2)),
        power: Math.round(sample.power || 0),
      };

      if (sample.heartRate && sample.heartRate > 0) {
        recordMesg.heartRate = Math.round(sample.heartRate);
      }

      if (sample.cadence && sample.cadence > 0) {
        recordMesg.cadence = Math.round(sample.cadence);
      }

      encoder.onMesg(Profile.MesgNum.RECORD, recordMesg as any);
    });
  } else {
    const gps = sampleGps(summary.totalDistanceMeters || 0);
    encoder.onMesg(Profile.MesgNum.RECORD, {
      timestamp: startTime,
      positionLat: gps.latSemi,
      positionLong: gps.lonSemi,
      altitude: gps.altitude,
      distance: Number((summary.totalDistanceMeters || 0).toFixed(1)),
      speed: Number(((summary.avgSpeedKmh || 0) / 3.6).toFixed(2)),
      power: Math.round(summary.avgPowerWatts || 0),
    } as any);
  }

  // 4. Timer Stop Event
  encoder.onMesg(Profile.MesgNum.EVENT, {
    timestamp: endTime,
    event: 'timer',
    eventType: 'stopAll',
  } as any);

  // 5. Lap Message
  encoder.onMesg(Profile.MesgNum.LAP, {
    timestamp: endTime,
    startTime: startTime,
    totalElapsedTime: Number(summary.totalElapsedTimeSeconds || 1),
    totalTimerTime: Number(summary.totalTimerTimeSeconds || 1),
    totalDistance: Number((summary.totalDistanceMeters || 0).toFixed(1)),
    avgSpeed: Number(((summary.avgSpeedKmh || 0) / 3.6).toFixed(2)),
    maxSpeed: Number(((summary.maxSpeedKmh || 0) / 3.6).toFixed(2)),
    avgPower: Math.round(summary.avgPowerWatts || 0),
    maxPower: Math.round(summary.maxPowerWatts || 0),
    avgHeartRate: Math.round(summary.avgHeartRateBpm) || undefined,
    maxHeartRate: Math.round(summary.maxHeartRateBpm) || undefined,
    avgCadence: Math.round(summary.avgCadenceRpm) || undefined,
    maxCadence: Math.round(summary.maxCadenceRpm) || undefined,
    totalWork: Math.round((summary.totalWorkKj || 0) * 1000),
    totalCalories: Math.round(summary.totalCaloriesKcal || 0),
  } as any);

  // 6. Session Message (virtualActivity so Intervals.icu / Strava display the virtual GPS map!)
  encoder.onMesg(Profile.MesgNum.SESSION, {
    timestamp: endTime,
    startTime: startTime,
    sport: 'cycling',
    subSport: 'virtualActivity',
    totalElapsedTime: Number(summary.totalElapsedTimeSeconds || 1),
    totalTimerTime: Number(summary.totalTimerTimeSeconds || 1),
    totalDistance: Number((summary.totalDistanceMeters || 0).toFixed(1)),
    avgSpeed: Number(((summary.avgSpeedKmh || 0) / 3.6).toFixed(2)),
    maxSpeed: Number(((summary.maxSpeedKmh || 0) / 3.6).toFixed(2)),
    avgPower: Math.round(summary.avgPowerWatts || 0),
    maxPower: Math.round(summary.maxPowerWatts || 0),
    normalizedPower: Math.round(summary.normalizedPowerWatts) || undefined,
    avgHeartRate: Math.round(summary.avgHeartRateBpm) || undefined,
    maxHeartRate: Math.round(summary.maxHeartRateBpm) || undefined,
    avgCadence: Math.round(summary.avgCadenceRpm) || undefined,
    maxCadence: Math.round(summary.maxCadenceRpm) || undefined,
    totalWork: Math.round((summary.totalWorkKj || 0) * 1000),
    totalCalories: Math.round(summary.totalCaloriesKcal || 0),
    trainingStressScore: summary.trainingStressScore || undefined,
    intensityFactor: summary.intensityFactor || undefined,
  } as any);

  // 7. Activity Message
  encoder.onMesg(Profile.MesgNum.ACTIVITY, {
    timestamp: endTime,
    totalTimerTime: Number(summary.totalTimerTimeSeconds || 1),
    numSessions: 1,
    type: 'manual',
  } as any);

  return encoder.close();
}

/**
 * Prepares the .FIT file data, blob URL, and base64 string for downloading or sharing
 */
export function createFitFileInfo(summary: SessionSummary, customFilename?: string): {
  filename: string;
  blobUrl: string;
  sizeBytes: number;
  base64Data: string;
  bytes: Uint8Array;
} {
  const fitData = generateFitFile(summary);
  const blob = new Blob([fitData], { type: 'application/octet-stream' });
  const blobUrl = URL.createObjectURL(blob);

  const pad = (n: number) => String(n).padStart(2, '0');
  const d = summary.startTime instanceof Date ? summary.startTime : new Date(summary.startTime || Date.now());
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
  const filename = customFilename || `VeloPulse_${dateStr}.fit`;

  let binary = '';
  const len = fitData.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(fitData[i]);
  }
  const base64Data = btoa(binary);

  return {
    filename,
    blobUrl,
    sizeBytes: fitData.byteLength,
    base64Data,
    bytes: fitData,
  };
}

/**
 * Generates and triggers download of the .fit file across Web, Android and iOS
 */
export function downloadFitFile(summary: SessionSummary, customFilename?: string): { filename: string; blobUrl: string } {
  const { filename, blobUrl, base64Data } = createFitFileInfo(summary, customFilename);

  if ((window as any).AndroidDownloader?.downloadBase64File) {
    (window as any).AndroidDownloader.downloadBase64File(filename, base64Data);
    return { filename, blobUrl };
  }

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return { filename, blobUrl };
}
