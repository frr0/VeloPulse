import { Encoder, Profile } from '@garmin/fitsdk';
import { SessionSummary } from '../../types';

export function generateFitFile(summary: SessionSummary): Uint8Array {
  const encoder = new Encoder();

  const startTime = summary.startTime instanceof Date ? summary.startTime : new Date(summary.startTime || Date.now());
  const endTime = summary.endTime instanceof Date ? summary.endTime : new Date(summary.endTime || Date.now());

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

  // 3. Record Messages (one per recorded second)
  if (summary.samples && summary.samples.length > 0) {
    summary.samples.forEach((sample) => {
      const ts = sample.timestamp instanceof Date ? sample.timestamp : new Date(sample.timestamp);
      const recordMesg: Record<string, any> = {
        timestamp: ts,
        distance: Number((sample.distanceMeters || 0).toFixed(1)),
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
    // If no samples (e.g. stopped before 1s), write at least 1 record
    encoder.onMesg(Profile.MesgNum.RECORD, {
      timestamp: startTime,
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
    totalWork: Math.round((summary.totalWorkKj || 0) * 1000), // Joules in FIT
    totalCalories: Math.round(summary.totalCaloriesKcal || 0),
  } as any);

  // 6. Session Message
  encoder.onMesg(Profile.MesgNum.SESSION, {
    timestamp: endTime,
    startTime: startTime,
    sport: 'cycling',
    subSport: 'indoorCycling',
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
    totalWork: Math.round((summary.totalWorkKj || 0) * 1000), // Joules
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
  };
}

/**
 * Generates and triggers download of the .fit file across Web, AppImage, and Android
 */
export function downloadFitFile(summary: SessionSummary, customFilename?: string): { filename: string; blobUrl: string } {
  const { filename, blobUrl, base64Data } = createFitFileInfo(summary, customFilename);

  // If on Android with native bridge
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
