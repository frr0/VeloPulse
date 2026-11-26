import { ParsedWorkout, WorkoutInterval, WorkoutIntervalType } from '../../types';
import { getPowerZoneNumber } from '../../utils/zones';

export function parseZwoWorkout(xmlContent: string, ftp: number): ParsedWorkout {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'application/xml');

  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid XML file: ' + (parserError.textContent || 'Parse error'));
  }

  const title = doc.querySelector('name')?.textContent?.trim() || 'Custom Workout';
  const author = doc.querySelector('author')?.textContent?.trim() || 'Unknown Author';
  const description = doc.querySelector('description')?.textContent?.trim() || 'No description provided';
  const sportType = doc.querySelector('sportType')?.textContent?.trim() || 'bike';

  const workoutNode = doc.querySelector('workout');
  if (!workoutNode) {
    throw new Error('No <workout> element found in the .zwo file');
  }

  const intervals: WorkoutInterval[] = [];
  let currentSecond = 0;

  const children = Array.from(workoutNode.children);

  children.forEach((node, nodeIdx) => {
    const tagName = node.tagName.toLowerCase();

    const parseNum = (attr: string, def = 0): number => {
      const v = node.getAttribute(attr);
      if (v === null || v === undefined) return def;
      const num = parseFloat(v);
      return isNaN(num) ? def : num;
    };

    if (tagName === 'warmup') {
      const duration = Math.round(parseNum('Duration', 600));
      const pLow = parseNum('PowerLow', 0.4);
      const pHigh = parseNum('PowerHigh', 0.75);
      const cadence = parseNum('Cadence', 0) || undefined;

      intervals.push(createInterval({
        id: `warmup-${nodeIdx}`,
        type: 'Warmup',
        durationSeconds: duration,
        startSecond: currentSecond,
        powerLow: pLow,
        powerHigh: pHigh,
        power: (pLow + pHigh) / 2,
        ftp,
        cadence,
        text: 'Warm-up: gradually raise heart rate and spin legs',
      }));
      currentSecond += duration;
    } else if (tagName === 'steadystate') {
      const duration = Math.round(parseNum('Duration', 300));
      const p = parseNum('Power', 0.85);
      const cadence = parseNum('Cadence', 0) || undefined;

      intervals.push(createInterval({
        id: `steady-${nodeIdx}`,
        type: 'SteadyState',
        durationSeconds: duration,
        startSecond: currentSecond,
        powerLow: p,
        powerHigh: p,
        power: p,
        ftp,
        cadence,
      }));
      currentSecond += duration;
    } else if (tagName === 'intervalst') {
      const repeats = Math.max(1, Math.round(parseNum('Repeat', 1)));
      const onDuration = Math.round(parseNum('OnDuration', 60));
      const offDuration = Math.round(parseNum('OffDuration', 60));
      const onPower = parseNum('OnPower', 1.0);
      const offPower = parseNum('OffPower', 0.5);
      const onCadence = parseNum('Cadence', 0) || undefined;
      const offCadence = parseNum('CadenceRest', 0) || undefined;

      for (let r = 1; r <= repeats; r++) {
        // ON interval
        intervals.push(createInterval({
          id: `intervals-on-${nodeIdx}-${r}`,
          type: 'IntervalsT',
          durationSeconds: onDuration,
          startSecond: currentSecond,
          powerLow: onPower,
          powerHigh: onPower,
          power: onPower,
          ftp,
          cadence: onCadence,
          repeatIndex: r,
          totalRepeats: repeats,
          text: `Interval ${r}/${repeats}: ON`,
        }));
        currentSecond += onDuration;

        // OFF interval
        intervals.push(createInterval({
          id: `intervals-off-${nodeIdx}-${r}`,
          type: 'IntervalsT',
          durationSeconds: offDuration,
          startSecond: currentSecond,
          powerLow: offPower,
          powerHigh: offPower,
          power: offPower,
          ftp,
          cadence: offCadence,
          repeatIndex: r,
          totalRepeats: repeats,
          text: `Interval ${r}/${repeats}: Rest & Spin`,
        }));
        currentSecond += offDuration;
      }
    } else if (tagName === 'ramp') {
      const duration = Math.round(parseNum('Duration', 300));
      const pLow = parseNum('PowerLow', 0.7);
      const pHigh = parseNum('PowerHigh', 1.1);
      const cadence = parseNum('Cadence', 0) || undefined;

      intervals.push(createInterval({
        id: `ramp-${nodeIdx}`,
        type: 'Ramp',
        durationSeconds: duration,
        startSecond: currentSecond,
        powerLow: pLow,
        powerHigh: pHigh,
        power: (pLow + pHigh) / 2,
        ftp,
        cadence,
      }));
      currentSecond += duration;
    } else if (tagName === 'cooldown') {
      const duration = Math.round(parseNum('Duration', 300));
      const pLow = parseNum('PowerLow', 0.7);
      const pHigh = parseNum('PowerHigh', 0.4);
      const cadence = parseNum('Cadence', 0) || undefined;

      intervals.push(createInterval({
        id: `cooldown-${nodeIdx}`,
        type: 'Cooldown',
        durationSeconds: duration,
        startSecond: currentSecond,
        powerLow: pLow,
        powerHigh: pHigh,
        power: (pLow + pHigh) / 2,
        ftp,
        cadence,
        text: 'Cool-down: ease down spin and recover',
      }));
      currentSecond += duration;
    } else if (tagName === 'freeride') {
      const duration = Math.round(parseNum('Duration', 600));
      intervals.push(createInterval({
        id: `freeride-${nodeIdx}`,
        type: 'FreeRide',
        durationSeconds: duration,
        startSecond: currentSecond,
        powerLow: 0.65,
        powerHigh: 0.65,
        power: 0.65,
        ftp,
        text: 'Free Ride: ride at your own pace',
      }));
      currentSecond += duration;
    } else if (tagName === 'maxeffort') {
      const duration = Math.round(parseNum('Duration', 60));
      intervals.push(createInterval({
        id: `maxeffort-${nodeIdx}`,
        type: 'MaxEffort',
        durationSeconds: duration,
        startSecond: currentSecond,
        powerLow: 1.5,
        powerHigh: 1.5,
        power: 1.5,
        ftp,
        text: 'MAX EFFORT: Full gas!',
      }));
      currentSecond += duration;
    }
  });

  const totalDurationSeconds = currentSecond;

  // Calculate workout statistics
  let totalWeightedWattsSeconds = 0;
  let totalWatts4Seconds = 0;

  intervals.forEach((inv) => {
    const avgWatts = (inv.targetWattsStart + inv.targetWattsEnd) / 2;
    totalWeightedWattsSeconds += avgWatts * inv.durationSeconds;
    totalWatts4Seconds += Math.pow(avgWatts, 4) * inv.durationSeconds;
  });

  const avgTargetWatts = totalDurationSeconds > 0 ? Math.round(totalWeightedWattsSeconds / totalDurationSeconds) : 0;
  const avgTargetPowerPercent = ftp > 0 ? Number((avgTargetWatts / ftp).toFixed(2)) : 0;
  const normalizedTargetWatts = totalDurationSeconds > 0 ? Math.round(Math.pow(totalWatts4Seconds / totalDurationSeconds, 0.25)) : 0;
  const intensityFactor = ftp > 0 ? Number((normalizedTargetWatts / ftp).toFixed(2)) : 0;
  const estimatedTss = ftp > 0 && totalDurationSeconds > 0
    ? Math.round((totalDurationSeconds * normalizedTargetWatts * intensityFactor) / (ftp * 36))
    : 0;

  return {
    title,
    author,
    description,
    sportType,
    intervals,
    totalDurationSeconds,
    avgTargetPowerPercent,
    avgTargetWatts,
    normalizedTargetWatts,
    estimatedTss,
    intensityFactor,
    rawXml: xmlContent,
  };
}

function createInterval(params: {
  id: string;
  type: WorkoutIntervalType;
  durationSeconds: number;
  startSecond: number;
  powerLow: number;
  powerHigh: number;
  power: number;
  ftp: number;
  cadence?: number;
  repeatIndex?: number;
  totalRepeats?: number;
  text?: string;
}): WorkoutInterval {
  const targetWattsStart = Math.round(params.powerLow * params.ftp);
  const targetWattsEnd = Math.round(params.powerHigh * params.ftp);
  const avgPower = (params.powerLow + params.powerHigh) / 2;
  const colorZone = getPowerZoneNumber(avgPower * params.ftp, params.ftp);

  return {
    id: params.id,
    type: params.type,
    durationSeconds: params.durationSeconds,
    startSecond: params.startSecond,
    endSecond: params.startSecond + params.durationSeconds,
    powerLow: params.powerLow,
    powerHigh: params.powerHigh,
    power: params.power,
    targetWattsStart,
    targetWattsEnd,
    cadence: params.cadence,
    repeatIndex: params.repeatIndex,
    totalRepeats: params.totalRepeats,
    text: params.text,
    colorZone,
  };
}

/**
 * Re-scales an already parsed workout to a new FTP value
 */
export function recalculateWorkoutFtp(workout: ParsedWorkout, newFtp: number): ParsedWorkout {
  if (!workout.rawXml) return workout;
  return parseZwoWorkout(workout.rawXml, newFtp);
}

export type WorkoutCategory =
  | 'Recovery'
  | 'Endurance'
  | 'Sweet Spot'
  | 'Threshold'
  | 'VO2 Max'
  | 'Sprint'
  | 'Test';

export interface SampleWorkoutItem {
  name: string;
  category: WorkoutCategory;
  description: string;
  xml: string;
}

/**
 * Built-in workouts for instant selection
 */
export const SAMPLE_WORKOUTS: SampleWorkoutItem[] = [
  {
    name: 'Sweet Spot Progression (2x10 min)',
    category: 'Sweet Spot',
    description: 'Classic sweet spot training to raise your threshold power without excessive fatigue. Includes warm-up and cool-down.',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
  <author>VeloPulse Coach</author>
  <name>Sweet Spot Progression (2x10 min)</name>
  <description>2x10min sweet spot intervals at 88-92% FTP with 4min recovery.</description>
  <sportType>bike</sportType>
  <workout>
    <Warmup Duration="480" PowerLow="0.45" PowerHigh="0.75" Cadence="85"/>
    <SteadyState Duration="120" Power="0.65" Cadence="90"/>
    <SteadyState Duration="600" Power="0.90" Cadence="92"/>
    <SteadyState Duration="240" Power="0.55" Cadence="85"/>
    <SteadyState Duration="600" Power="0.90" Cadence="90"/>
    <Cooldown Duration="360" PowerLow="0.65" PowerHigh="0.40" Cadence="85"/>
  </workout>
</workout_file>`,
  },
  {
    name: 'Zone 2 Endurance Cruise (45 min)',
    category: 'Endurance',
    description: 'Steady aerobic base ride at 65–72% FTP to build mitochondrial density and fat oxidation.',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
  <author>VeloPulse Coach</author>
  <name>Zone 2 Endurance Cruise (45 min)</name>
  <description>45 minutes steady Zone 2 endurance with gentle cadence changes.</description>
  <sportType>bike</sportType>
  <workout>
    <Warmup Duration="360" PowerLow="0.45" PowerHigh="0.65" Cadence="85"/>
    <SteadyState Duration="600" Power="0.68" Cadence="88"/>
    <SteadyState Duration="600" Power="0.72" Cadence="92"/>
    <SteadyState Duration="600" Power="0.68" Cadence="86"/>
    <SteadyState Duration="300" Power="0.72" Cadence="90"/>
    <Cooldown Duration="240" PowerLow="0.62" PowerHigh="0.42" Cadence="85"/>
  </workout>
</workout_file>`,
  },
  {
    name: 'Aerobic Base Builder (60 min)',
    category: 'Endurance',
    description: 'One-hour structured endurance ride with gentle Z2/Z3 waves to keep the legs engaged.',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
  <author>VeloPulse Coach</author>
  <name>Aerobic Base Builder (60 min)</name>
  <description>60 minutes undulating endurance between 65% and 78% FTP.</description>
  <sportType>bike</sportType>
  <workout>
    <Warmup Duration="480" PowerLow="0.45" PowerHigh="0.68" Cadence="85"/>
    <SteadyState Duration="600" Power="0.70" Cadence="90"/>
    <SteadyState Duration="300" Power="0.78" Cadence="88"/>
    <SteadyState Duration="600" Power="0.68" Cadence="90"/>
    <SteadyState Duration="300" Power="0.78" Cadence="88"/>
    <SteadyState Duration="600" Power="0.70" Cadence="90"/>
    <SteadyState Duration="300" Power="0.76" Cadence="88"/>
    <Cooldown Duration="420" PowerLow="0.65" PowerHigh="0.42" Cadence="85"/>
  </workout>
</workout_file>`,
  },
  {
    name: 'Tempo Cadence Drills (40 min)',
    category: 'Sweet Spot',
    description: '3x8 min tempo blocks alternating high cadence spinning and low-cadence strength.',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
  <author>VeloPulse Coach</author>
  <name>Tempo Cadence Drills (40 min)</name>
  <description>3x8min at 82-85% FTP with alternating cadence targets.</description>
  <sportType>bike</sportType>
  <workout>
    <Warmup Duration="420" PowerLow="0.45" PowerHigh="0.75" Cadence="88"/>
    <SteadyState Duration="480" Power="0.82" Cadence="95"/>
    <SteadyState Duration="180" Power="0.55" Cadence="85"/>
    <SteadyState Duration="480" Power="0.84" Cadence="72"/>
    <SteadyState Duration="180" Power="0.55" Cadence="85"/>
    <SteadyState Duration="480" Power="0.85" Cadence="92"/>
    <Cooldown Duration="180" PowerLow="0.62" PowerHigh="0.40" Cadence="85"/>
  </workout>
</workout_file>`,
  },
  {
    name: 'FTP Threshold (2x15 min)',
    category: 'Threshold',
    description: 'Sustained race-pace threshold blocks right at 98–100% FTP to push your functional threshold higher.',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
  <author>VeloPulse Coach</author>
  <name>FTP Threshold (2x15 min)</name>
  <description>2x15min sustained threshold intervals at 98% FTP.</description>
  <sportType>bike</sportType>
  <workout>
    <Warmup Duration="600" PowerLow="0.45" PowerHigh="0.80" Cadence="90"/>
    <SteadyState Duration="120" Power="0.55" Cadence="85"/>
    <SteadyState Duration="900" Power="0.98" Cadence="92"/>
    <SteadyState Duration="300" Power="0.52" Cadence="85"/>
    <SteadyState Duration="900" Power="1.00" Cadence="92"/>
    <Cooldown Duration="360" PowerLow="0.62" PowerHigh="0.40" Cadence="85"/>
  </workout>
</workout_file>`,
  },
  {
    name: 'Over-Under Threshold (3x9 min)',
    category: 'Threshold',
    description: 'Alternate between just below and just above threshold (95% and 105% FTP) to train lactate clearance.',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
  <author>VeloPulse Coach</author>
  <name>Over-Under Threshold (3x9 min)</name>
  <description>3 sets of 9 minutes alternating 2min Under / 1min Over.</description>
  <sportType>bike</sportType>
  <workout>
    <Warmup Duration="480" PowerLow="0.50" PowerHigh="0.80" Cadence="90"/>
    <IntervalsT Repeat="3" OnDuration="120" OffDuration="60" OnPower="0.95" OffPower="1.05" Cadence="90" CadenceRest="95"/>
    <SteadyState Duration="240" Power="0.50" Cadence="85"/>
    <IntervalsT Repeat="3" OnDuration="120" OffDuration="60" OnPower="0.95" OffPower="1.05" Cadence="90" CadenceRest="95"/>
    <SteadyState Duration="240" Power="0.50" Cadence="85"/>
    <IntervalsT Repeat="3" OnDuration="120" OffDuration="60" OnPower="0.95" OffPower="1.05" Cadence="90" CadenceRest="95"/>
    <Cooldown Duration="300" PowerLow="0.65" PowerHigh="0.45" Cadence="85"/>
  </workout>
</workout_file>`,
  },
  {
    name: 'VO2 Max Boost (5x3 min)',
    category: 'VO2 Max',
    description: 'High aerobic power intervals designed to increase maximum oxygen uptake and punchy climbing power.',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
  <author>VeloPulse Coach</author>
  <name>VO2 Max Boost (5x3 min)</name>
  <description>5 repeats of 3 minutes at 115% FTP with 3 minutes easy recovery.</description>
  <sportType>bike</sportType>
  <workout>
    <Warmup Duration="600" PowerLow="0.50" PowerHigh="0.80" Cadence="90"/>
    <SteadyState Duration="180" Power="0.60" Cadence="85"/>
    <IntervalsT Repeat="5" OnDuration="180" OffDuration="180" OnPower="1.15" OffPower="0.50" Cadence="98" CadenceRest="80"/>
    <Cooldown Duration="300" PowerLow="0.60" PowerHigh="0.40" Cadence="85"/>
  </workout>
</workout_file>`,
  },
  {
    name: '30/30 Micro-Intervals (2x10)',
    category: 'VO2 Max',
    description: 'Fast 30s surges at 120% FTP with 30s float recovery to maximize time near VO2max.',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
  <author>VeloPulse Coach</author>
  <name>30/30 Micro-Intervals (2x10)</name>
  <description>2 sets of 10x(30s @ 120% / 30s @ 55%) with 5min rest between sets.</description>
  <sportType>bike</sportType>
  <workout>
    <Warmup Duration="480" PowerLow="0.45" PowerHigh="0.78" Cadence="90"/>
    <IntervalsT Repeat="10" OnDuration="30" OffDuration="30" OnPower="1.20" OffPower="0.55" Cadence="100" CadenceRest="85"/>
    <SteadyState Duration="300" Power="0.50" Cadence="85"/>
    <IntervalsT Repeat="10" OnDuration="30" OffDuration="30" OnPower="1.20" OffPower="0.55" Cadence="100" CadenceRest="85"/>
    <Cooldown Duration="300" PowerLow="0.60" PowerHigh="0.40" Cadence="85"/>
  </workout>
</workout_file>`,
  },
  {
    name: '40/20 Punchy Climbs (2x8)',
    category: 'VO2 Max',
    description: 'Race-simulation 40s attacks at 118% FTP with short 20s recoveries for steep climbs and breakaways.',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
  <author>VeloPulse Coach</author>
  <name>40/20 Punchy Climbs (2x8)</name>
  <description>2 sets of 8x(40s @ 118% / 20s @ 52%) with 4min easy spin between sets.</description>
  <sportType>bike</sportType>
  <workout>
    <Warmup Duration="480" PowerLow="0.45" PowerHigh="0.75" Cadence="88"/>
    <IntervalsT Repeat="8" OnDuration="40" OffDuration="20" OnPower="1.18" OffPower="0.52" Cadence="96" CadenceRest="82"/>
    <SteadyState Duration="240" Power="0.50" Cadence="85"/>
    <IntervalsT Repeat="8" OnDuration="40" OffDuration="20" OnPower="1.18" OffPower="0.52" Cadence="96" CadenceRest="82"/>
    <Cooldown Duration="300" PowerLow="0.60" PowerHigh="0.40" Cadence="85"/>
  </workout>
</workout_file>`,
  },
  {
    name: 'Sprint Neuromuscular Kickers (35 min)',
    category: 'Sprint',
    description: 'Short explosive 15-second sprints at 150% FTP with generous recovery to sharpen top-end snap.',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
  <author>VeloPulse Coach</author>
  <name>Sprint Neuromuscular Kickers (35 min)</name>
  <description>8x15s explosive sprints at 150% FTP with 2min easy spinning.</description>
  <sportType>bike</sportType>
  <workout>
    <Warmup Duration="480" PowerLow="0.45" PowerHigh="0.75" Cadence="90"/>
    <IntervalsT Repeat="8" OnDuration="15" OffDuration="120" OnPower="1.50" OffPower="0.52" Cadence="110" CadenceRest="85"/>
    <SteadyState Duration="240" Power="0.62" Cadence="90"/>
    <Cooldown Duration="300" PowerLow="0.55" PowerHigh="0.38" Cadence="82"/>
  </workout>
</workout_file>`,
  },
  {
    name: 'FTP Ramp Test Protocol',
    category: 'Test',
    description: 'Progressive ramp test stepping up every minute until exhaustion to estimate your current FTP.',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
  <author>VeloPulse Coach</author>
  <name>FTP Ramp Test Protocol</name>
  <description>Standard 1-minute step test to evaluate FTP.</description>
  <sportType>bike</sportType>
  <workout>
    <Warmup Duration="300" PowerLow="0.40" PowerHigh="0.50" Cadence="85"/>
    <SteadyState Duration="60" Power="0.52" Cadence="90"/>
    <SteadyState Duration="60" Power="0.60" Cadence="90"/>
    <SteadyState Duration="60" Power="0.68" Cadence="90"/>
    <SteadyState Duration="60" Power="0.76" Cadence="90"/>
    <SteadyState Duration="60" Power="0.84" Cadence="90"/>
    <SteadyState Duration="60" Power="0.92" Cadence="90"/>
    <SteadyState Duration="60" Power="1.00" Cadence="90"/>
    <SteadyState Duration="60" Power="1.08" Cadence="90"/>
    <SteadyState Duration="60" Power="1.16" Cadence="90"/>
    <SteadyState Duration="60" Power="1.24" Cadence="90"/>
    <SteadyState Duration="60" Power="1.32" Cadence="90"/>
    <SteadyState Duration="60" Power="1.40" Cadence="90"/>
    <SteadyState Duration="60" Power="1.48" Cadence="90"/>
    <Cooldown Duration="300" PowerLow="0.50" PowerHigh="0.35" Cadence="80"/>
  </workout>
</workout_file>`,
  },
  {
    name: 'Active Recovery Spin (30 min)',
    category: 'Recovery',
    description: 'Easy recovery ride at low intensity to promote blood flow, clear fatigue, and spin the legs.',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
  <author>VeloPulse Coach</author>
  <name>Active Recovery Spin (30 min)</name>
  <description>30 minutes easy spinning at 50-55% FTP.</description>
  <sportType>bike</sportType>
  <workout>
    <Warmup Duration="300" PowerLow="0.35" PowerHigh="0.50" Cadence="85"/>
    <SteadyState Duration="1200" Power="0.52" Cadence="90"/>
    <Cooldown Duration="300" PowerLow="0.50" PowerHigh="0.35" Cadence="80"/>
  </workout>
</workout_file>`,
  },
];
