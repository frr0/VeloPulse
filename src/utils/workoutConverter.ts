import { CalendarEvent, ParsedWorkout, WorkoutInterval } from '../types';

/**
 * Converts a scheduled Intervals.icu calendar workout event into a structured
 * workout ready for execution in the VeloPulse Smart Trainer Ride Studio.
 */
export function convertCalendarEventToWorkout(
  event: CalendarEvent,
  ftp: number
): ParsedWorkout {
  const totalSeconds = event.moving_time && event.moving_time > 0 ? event.moving_time : 3600;
  const load = event.load || 55;
  const title = event.name || 'Scheduled Workout';
  const description = event.description || `Workout from Intervals.icu calendar (~${load} TSS)`;

  // If workout is roughly an hour or more, generate structured warm-up, intervals, and cooldown
  const intervals: WorkoutInterval[] = [];

  const warmupSecs = Math.min(600, Math.round(totalSeconds * 0.15));
  const cooldownSecs = Math.min(600, Math.round(totalSeconds * 0.15));
  const mainSecs = Math.max(300, totalSeconds - warmupSecs - cooldownSecs);

  let currentSec = 0;

  // 1. Warm-up (progressive ramp from 50% to 75% FTP)
  intervals.push({
    id: 'warmup-1',
    type: 'Warmup',
    durationSeconds: warmupSecs,
    startSecond: currentSec,
    endSecond: currentSec + warmupSecs,
    powerLow: 0.5,
    powerHigh: 0.75,
    power: 0.62,
    targetWattsStart: Math.round(ftp * 0.5),
    targetWattsEnd: Math.round(ftp * 0.75),
    cadence: 85,
    text: 'Progressive Warm-up - Spin legs up',
    colorZone: 2,
  });
  currentSec += warmupSecs;

  // 2. Main Work sets: check if title or description suggests intervals or sweetspot
  const lowerTitle = title.toLowerCase();
  const lowerDesc = description.toLowerCase();

  if (lowerTitle.includes('vo2') || lowerDesc.includes('vo2')) {
    // 5x3 min VO2max
    const repWork = 180;
    const repRest = 180;
    const reps = Math.max(3, Math.min(6, Math.floor(mainSecs / (repWork + repRest))));

    for (let i = 1; i <= reps; i++) {
      intervals.push({
        id: `work-${i}`,
        type: 'IntervalsT',
        durationSeconds: repWork,
        startSecond: currentSec,
        endSecond: currentSec + repWork,
        powerLow: 1.15,
        powerHigh: 1.15,
        power: 1.15,
        targetWattsStart: Math.round(ftp * 1.15),
        targetWattsEnd: Math.round(ftp * 1.15),
        cadence: 100,
        text: `VO2 Max Interval ${i}/${reps}`,
        colorZone: 5,
        repeatIndex: i,
        totalRepeats: reps,
      });
      currentSec += repWork;

      intervals.push({
        id: `rest-${i}`,
        type: 'IntervalsT',
        durationSeconds: repRest,
        startSecond: currentSec,
        endSecond: currentSec + repRest,
        powerLow: 0.55,
        powerHigh: 0.55,
        power: 0.55,
        targetWattsStart: Math.round(ftp * 0.55),
        targetWattsEnd: Math.round(ftp * 0.55),
        cadence: 85,
        text: `Recovery Spin ${i}/${reps}`,
        colorZone: 1,
      });
      currentSec += repRest;
    }
  } else if (lowerTitle.includes('threshold') || lowerTitle.includes('over') || lowerDesc.includes('threshold')) {
    // Over-unders
    const numBlocks = Math.max(2, Math.min(4, Math.floor(mainSecs / 720)));
    for (let b = 1; b <= numBlocks; b++) {
      intervals.push({
        id: `thresh-${b}`,
        type: 'SteadyState',
        durationSeconds: 480,
        startSecond: currentSec,
        endSecond: currentSec + 480,
        powerLow: 1.0,
        powerHigh: 1.0,
        power: 1.0,
        targetWattsStart: Math.round(ftp * 1.0),
        targetWattsEnd: Math.round(ftp * 1.0),
        cadence: 92,
        text: `Threshold Block ${b}/${numBlocks}`,
        colorZone: 4,
        repeatIndex: b,
        totalRepeats: numBlocks,
      });
      currentSec += 480;

      if (b < numBlocks) {
        intervals.push({
          id: `t-rest-${b}`,
          type: 'SteadyState',
          durationSeconds: 240,
          startSecond: currentSec,
          endSecond: currentSec + 240,
          powerLow: 0.55,
          powerHigh: 0.55,
          power: 0.55,
          targetWattsStart: Math.round(ftp * 0.55),
          targetWattsEnd: Math.round(ftp * 0.55),
          cadence: 85,
          text: 'Rest Interval',
          colorZone: 1,
        });
        currentSec += 240;
      }
    }
  } else {
    // Sweetspot / Steady State Tempo default
    const numBlocks = Math.max(2, Math.min(4, Math.floor(mainSecs / 720)));
    const blockDuration = Math.round(mainSecs / (numBlocks * 1.3));
    const restDuration = Math.round(blockDuration * 0.3);

    for (let b = 1; b <= numBlocks; b++) {
      intervals.push({
        id: `ss-${b}`,
        type: 'SteadyState',
        durationSeconds: blockDuration,
        startSecond: currentSec,
        endSecond: currentSec + blockDuration,
        powerLow: 0.88,
        powerHigh: 0.88,
        power: 0.88,
        targetWattsStart: Math.round(ftp * 0.88),
        targetWattsEnd: Math.round(ftp * 0.88),
        cadence: 90,
        text: `Sweet Spot Tempo Block ${b}/${numBlocks}`,
        colorZone: 3,
        repeatIndex: b,
        totalRepeats: numBlocks,
      });
      currentSec += blockDuration;

      if (b < numBlocks) {
        intervals.push({
          id: `ss-rest-${b}`,
          type: 'SteadyState',
          durationSeconds: restDuration,
          startSecond: currentSec,
          endSecond: currentSec + restDuration,
          powerLow: 0.55,
          powerHigh: 0.55,
          power: 0.55,
          targetWattsStart: Math.round(ftp * 0.55),
          targetWattsEnd: Math.round(ftp * 0.55),
          cadence: 85,
          text: 'Recovery Spin',
          colorZone: 1,
        });
        currentSec += restDuration;
      }
    }
  }

  // 3. Cooldown
  intervals.push({
    id: 'cooldown-end',
    type: 'Cooldown',
    durationSeconds: cooldownSecs,
    startSecond: currentSec,
    endSecond: currentSec + cooldownSecs,
    powerLow: 0.7,
    powerHigh: 0.45,
    power: 0.55,
    targetWattsStart: Math.round(ftp * 0.7),
    targetWattsEnd: Math.round(ftp * 0.45),
    cadence: 80,
    text: 'Cool-down & Flush Legs',
    colorZone: 1,
  });
  currentSec += cooldownSecs;

  const totalCalculatedDuration = currentSec;
  const avgWatts = Math.round(
    intervals.reduce((acc, i) => acc + (i.power || 0.7) * ftp * i.durationSeconds, 0) /
      totalCalculatedDuration
  );

  return {
    title,
    author: 'Intervals.icu Calendar',
    description,
    sportType: 'Bike',
    intervals,
    totalDurationSeconds: totalCalculatedDuration,
    avgTargetPowerPercent: Number((avgWatts / ftp).toFixed(2)),
    avgTargetWatts: avgWatts,
    normalizedTargetWatts: Math.round(avgWatts * 1.04),
    estimatedTss: load,
    intensityFactor: Number((avgWatts / ftp).toFixed(2)),
  };
}
