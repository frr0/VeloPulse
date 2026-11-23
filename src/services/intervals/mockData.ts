import {
  Activity,
  Athlete,
  CalendarEvent,
  PowerCurveData,
  PowerCurveSample,
  PowerCurveSeries,
  Wellness,
} from '../../types/intervals';

export const MOCK_ATHLETE: Athlete = {
  id: 'i104928',
  name: 'Alex Rivera',
  firstname: 'Alex',
  lastname: 'Rivera',
  profile_medium: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
  city: 'Boulder, CO',
  country: 'United States',
  weight: 68.5,
  restingHR: 46,
  maxHR: 194,
  ftp: 295,
  vo2max: 56.4,
};

// --- Simulated power curve, demo login only -------------------------------
// The watts below are NOT measured data: a simple model builds them from the
// demo FTP. They exist to show the chart during the demo tour. An athlete who
// logs in with a real API key never sees them: with a real key the app shows
// only the curves of Intervals.icu, or an empty chart with the reason.

/** Watts as a share of FTP at a few reference durations, for the demo only. */
const SIMULATED_FTP_RATIOS: { secs: number; ratio: number }[] = [
  { secs: 1, ratio: 2.55 },
  { secs: 5, ratio: 2.10 },
  { secs: 15, ratio: 1.85 },
  { secs: 30, ratio: 1.55 },
  { secs: 60, ratio: 1.35 },
  { secs: 120, ratio: 1.20 },
  { secs: 300, ratio: 1.10 },
  { secs: 600, ratio: 1.02 },
  { secs: 1200, ratio: 0.96 },
  { secs: 3600, ratio: 0.78 },
  { secs: 18000, ratio: 0.62 },
];

function simulatedFtpRatio(secs: number): number {
  const first = SIMULATED_FTP_RATIOS[0];
  const last = SIMULATED_FTP_RATIOS[SIMULATED_FTP_RATIOS.length - 1];
  if (secs <= first.secs) return first.ratio;
  if (secs >= last.secs) return last.ratio;

  for (let i = 0; i < SIMULATED_FTP_RATIOS.length - 1; i++) {
    const low = SIMULATED_FTP_RATIOS[i];
    const high = SIMULATED_FTP_RATIOS[i + 1];
    if (secs > low.secs && secs <= high.secs) {
      const span = Math.log(high.secs) - Math.log(low.secs);
      const position = (Math.log(secs) - Math.log(low.secs)) / span;
      return low.ratio + (high.ratio - low.ratio) * position;
    }
  }
  return last.ratio;
}

/** Durations of the simulated curve: dense on short efforts, sparse on long ones. */
function simulatedDurations(): number[] {
  const durations: number[] = [];
  for (let s = 1; s < 60; s += 1) durations.push(s);
  for (let s = 60; s < 600; s += 10) durations.push(s);
  for (let s = 600; s < 3600; s += 60) durations.push(s);
  for (let s = 3600; s <= 18000; s += 300) durations.push(s);
  return durations;
}

function buildSimulatedSeries(
  id: string,
  label: string,
  ftp: number,
  weightKg: number,
  boost: number
): PowerCurveSeries {
  const samples: PowerCurveSample[] = simulatedDurations().map((secs) => {
    const watts = Math.round(ftp * simulatedFtpRatio(secs) * boost);
    return { secs, watts, wkg: watts / weightKg };
  });
  return { id, label, samples };
}

const SIMULATED_FTP = MOCK_ATHLETE.ftp ?? 250;
const SIMULATED_WEIGHT = MOCK_ATHLETE.weight ?? 70;

/** Simulated curves of the demo athlete. `simulated: true` marks them in the app. */
export const SIMULATED_DEMO_POWER_CURVE: PowerCurveData = {
  recent: buildSimulatedSeries('42d', 'Recent 42D', SIMULATED_FTP, SIMULATED_WEIGHT, 1.0),
  season: buildSimulatedSeries('s0', 'Season', SIMULATED_FTP, SIMULATED_WEIGHT, 1.06),
  weightKg: SIMULATED_WEIGHT,
  simulated: true,
  error: null,
};

export function generateMockWellness(): Wellness[] {
  const result: Wellness[] = [];
  const today = new Date();

  let ctl = 78.0;
  let atl = 82.0;

  for (let i = 30; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dailyLoad = isWeekend ? 130 + Math.random() * 40 : (dayOfWeek === 1 ? 0 : 65 + Math.random() * 50);

    ctl = ctl + (dailyLoad - ctl) * (1 - Math.exp(-1 / 42));
    atl = atl + (dailyLoad - atl) * (1 - Math.exp(-1 / 7));
    const tsb = ctl - atl;

    const restingHR = Math.round(44 + Math.random() * 5 + (atl > 95 ? 4 : 0));
    const hrv = Math.round(62 + Math.random() * 18 - (atl > 95 ? 12 : 0) + (tsb > 0 ? 8 : 0));
    const sleepHours = 7.0 + Math.random() * 1.8;
    const sleepSecs = Math.round(sleepHours * 3600);
    const sleepQuality = Math.min(5, Math.max(2, Math.round(3.5 + Math.random() * 1.5)));
    const sleepScore = Math.round(72 + Math.random() * 24);
    const vo2max = Math.round((54.4 + ((30 - i) / 30) * 2.0 + (Math.sin(i / 3) * 0.2)) * 10) / 10;

    result.push({
      id: dateStr,
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round(tsb * 10) / 10,
      rampRate: Math.round((Math.random() * 4.5 + 1.2) * 10) / 10,
      restingHR,
      hrv,
      hrvSDNN: hrv + 10,
      sleepSecs,
      sleepScore,
      sleepQuality,
      avgSleepingHR: restingHR - 3,
      soreness: atl > 90 ? 4 : 2,
      fatigue: atl > 85 ? 4 : 2,
      stress: 2,
      mood: tsb > -10 ? 4 : 3,
      weight: 68.2 + (Math.sin(i / 5) * 0.6),
      readiness: Math.min(98, Math.max(45, Math.round(70 + (hrv - 60) * 0.8 + (tsb * 0.5)))),
      vo2max,
    });
  }

  return result;
}

export const MOCK_WELLNESS: Wellness[] = generateMockWellness();

// Track of the sample outdoor ride of the demonstration account (RF-014). A
// plausible loop in the hills north-west of Verona, built for the demo: it is
// nobody's recorded ride, and the app shows the Demo Mode label on every
// screen. It is the one source for both the map (`map.summary_polyline`
// below, decoded by getActivityRoute like a real Intervals.icu track) and the
// demo `latlng` stream of src/services/intervals/mockStreams.ts, so the map
// and the charts over time can never show two different paths. The loop is
// closed (its first and last point are the same) and measures 48,750.1 m.
export const DEMO_OUTDOOR_POLYLINE =
  'sgmuGg{paAmGoRoC{RU{RzAkR~DuQpGuPpIsOzJmNvKmMbLkL~KsKvK{JhKkJzJyIlJmIfJ{H`JiHbJwGdJ}FjJeFnJiEpJsDlJaDbJsCrIqC~HwCbHkDfGeEhFgFpEoGzDsHlDsIfDkJjDoJxDgJlEiIdFwG`GwE|GgCvHq@jIf@xIvB|I`ExIrFpIrG`IvGnHbGxGxEdGxCtFjAhFGbF{AbFgDfFeFpFoGzFeHhGcHpGkG|GaF`HkDbHmB`Ho@|GFxGr@tGnArG|AvGtA~G~@nHZ`IOzI}@xJiBtKkCrLcDjMkD~MaDjNgCpN}AjNg@~MRlMrAvLvC|KrE`KjGjJzHtI`J`I`KnHzK`HrLpGhMzF`N~ExNzDxOhCxPlAzQD`SoA~SmDxTqGlUqJpUmMhU}OtT}QpSgSbRwSlPoSpNkRrLoPxJ_NhI_K~GuGdGkDvFaAvF^bGnBvGnDtH~EpIxFpJ`GnKzFfLhFxLnEhMnDpMrCxMrB|M|AbNhAhNx@pNl@|Nb@jOXtOJ~OEbP]~Oy@rO}AzNeCxMmDjLwEvJ}F|H_HdGwHpEeIfDoIjCiI`CaIhCqHdD}GpEiGhGwFhIkFhKeFdMeFtNoFrO_GvOqGdOkHxMcIrKyI|HoJtE{JhBcKAgKiBcK_EyJcGoJqHaJiIwIkIkIyHeI}G_IwF_IsE}HsDaI_D}H{C{HgDsHgEcHuFoGoHuFsJsEyLoD{NgCuPeBaRaA_Sc@iSMeS?qRDoQFePAwNKgMW}Ke@wJq@yIy@cI_AqHaAgHcA_HeAwGkAoGwA_GmBqFmCyE{DcEsFiDyHsCeKaCyMyBgP{BsRiCsTeDaVoEyVaGyV{H}U}JiT{L{QyN{NkPgKsQ';

export const MOCK_ACTIVITIES: Activity[] = [
  // Sample outdoor ride of the demonstration account (RF-014). Distance,
  // elevation gain, average/max power and heart rate, average cadence and
  // the heart rate zone times below are measured from the demo streams of
  // mockStreams.ts (getDemoActivityStreams), with the same functions the app
  // runs on a real Intervals.icu answer (see /tmp measurement script in the
  // task report): they are not written by hand, so they never drift from the
  // charts the activity page draws from those very streams.
  {
    id: 'act_100',
    name: 'Valpolicella Hills Endurance Loop',
    type: 'Ride',
    start_date_local: new Date(Date.now() - 3600 * 1000).toISOString(),
    distance: 48750,
    moving_time: 6540,
    elapsed_time: 6980,
    total_elevation_gain: 748,
    average_speed: 7.45,
    max_speed: 17.06,
    average_heartrate: 150,
    max_heartrate: 176,
    average_watts: 196,
    weighted_average_watts: 221,
    // Both derived from the generated series, so the ride does not claim a
    // load it did not produce: intensity is the normalized power over FTP
    // (221 / 295 = 75%), and the load is the standard training stress of
    // 6540 s at that intensity (102).
    icu_training_load: 102,
    icu_intensity: 75,
    icu_ftp: 295,
    icu_joules: 1281840,
    icu_average_cadence: 80,
    icu_hr_zones: [114, 133, 152, 171, 190],
    icu_hr_zone_times: [30, 1590, 1995, 2420, 505],
    feel: 4,
    rpe: 5,
    indoor: false,
    description:
      'Rolling endurance loop through the Valpolicella hills: two long climbs, a fast descent and a flat run home.',
    start_latlng: [45.62058, 10.905],
    map: {
      summary_polyline: DEMO_OUTDOOR_POLYLINE,
    },
  },
  {
    id: 'act_101',
    name: 'Morning VO2 Max 4x4m Intervals',
    type: 'Ride',
    start_date_local: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    distance: 42350,
    moving_time: 4620,
    elapsed_time: 4890,
    total_elevation_gain: 412,
    average_speed: 9.16,
    max_speed: 15.2,
    average_heartrate: 154,
    max_heartrate: 188,
    average_watts: 238,
    weighted_average_watts: 278,
    icu_training_load: 104,
    icu_intensity: 94,
    icu_ftp: 295,
    icu_joules: 1099560,
    icu_average_cadence: 91,
    icu_hr_zones: [114, 133, 152, 171, 190],
    icu_hr_zone_times: [300, 720, 1200, 1400, 1000],
    feel: 4,
    rpe: 8,
    description: 'Crisp morning session with 4x4 min at 115% FTP (340W). Felt punchy on the 3rd and 4th repeats.',
    intervals: [
      { id: 1, type: 'INTERVAL', elapsed_time: 240, moving_time: 240, average_watts: 342, average_heartrate: 176, max_heartrate: 182 },
      { id: 2, type: 'RECOVERY', elapsed_time: 240, moving_time: 240, average_watts: 145, average_heartrate: 135, max_heartrate: 148 },
      { id: 3, type: 'INTERVAL', elapsed_time: 240, moving_time: 240, average_watts: 345, average_heartrate: 180, max_heartrate: 185 },
      { id: 4, type: 'RECOVERY', elapsed_time: 240, moving_time: 240, average_watts: 140, average_heartrate: 138, max_heartrate: 150 },
      { id: 5, type: 'INTERVAL', elapsed_time: 240, moving_time: 240, average_watts: 338, average_heartrate: 183, max_heartrate: 187 },
      { id: 6, type: 'RECOVERY', elapsed_time: 240, moving_time: 240, average_watts: 142, average_heartrate: 140, max_heartrate: 152 },
      { id: 7, type: 'INTERVAL', elapsed_time: 240, moving_time: 240, average_watts: 348, average_heartrate: 185, max_heartrate: 188 },
    ],
  },
  {
    id: 'act_102',
    name: 'Endurance Tempo Trail Run',
    type: 'Run',
    start_date_local: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
    distance: 14200,
    moving_time: 3980,
    elapsed_time: 4100,
    total_elevation_gain: 260,
    average_speed: 3.56,
    max_speed: 5.1,
    average_heartrate: 151,
    max_heartrate: 174,
    average_watts: 252,
    weighted_average_watts: 265,
    icu_training_load: 82,
    icu_intensity: 86,
    icu_average_cadence: 174,
    icu_hr_zones: [114, 133, 152, 171, 190],
    icu_hr_zone_times: [200, 1100, 1800, 880, 0],
    feel: 4,
    rpe: 6,
    description: 'Steady aerobic endurance tempo through rolling singletrack. High cadence, good breathing rhythm.',
  },
  {
    id: 'act_103',
    name: 'Epic Canyon Gravel Expedition',
    type: 'Ride',
    start_date_local: new Date(Date.now() - 54 * 3600 * 1000).toISOString(),
    distance: 86500,
    moving_time: 10450,
    elapsed_time: 11800,
    total_elevation_gain: 1380,
    average_speed: 8.27,
    max_speed: 18.6,
    average_heartrate: 146,
    max_heartrate: 178,
    average_watts: 220,
    weighted_average_watts: 248,
    icu_training_load: 186,
    icu_intensity: 84,
    icu_ftp: 295,
    icu_joules: 2299000,
    icu_average_cadence: 88,
    icu_hr_zones: [114, 133, 152, 171, 190],
    icu_hr_zone_times: [1200, 4200, 3600, 1400, 50],
    feel: 5,
    rpe: 7,
    description: 'Huge day out in the canyons. Steady sweetspot climbs and fast flowy gravel descents.',
  },
  {
    id: 'act_104',
    name: 'Upper Body & Core Functional Strength',
    type: 'WeightTraining',
    start_date_local: new Date(Date.now() - 78 * 3600 * 1000).toISOString(),
    distance: 0,
    moving_time: 3000,
    elapsed_time: 3300,
    total_elevation_gain: 0,
    average_heartrate: 118,
    max_heartrate: 148,
    icu_training_load: 35,
    icu_intensity: 65,
    feel: 4,
    rpe: 5,
    description: 'Deadlifts, kettlebell swings, anti-rotation core planks, and thoracic mobility work.',
  },
  {
    id: 'act_105',
    name: 'Threshold Ladder (10m - 8m - 6m)',
    type: 'Ride',
    start_date_local: new Date(Date.now() - 105 * 3600 * 1000).toISOString(),
    distance: 48900,
    moving_time: 5120,
    elapsed_time: 5300,
    total_elevation_gain: 520,
    average_speed: 9.55,
    max_speed: 16.4,
    average_heartrate: 158,
    max_heartrate: 181,
    average_watts: 245,
    weighted_average_watts: 282,
    icu_training_load: 122,
    icu_intensity: 95,
    icu_ftp: 295,
    icu_joules: 1254400,
    feel: 3,
    rpe: 8,
    description: 'Demanding ladder session right at threshold power. Heavy legs in the last 6 minute block.',
  },
];

export const MOCK_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'ev_1',
    name: 'Sweet Spot 3x15m Over-Unders',
    start_date_local: new Date(Date.now() + 18 * 3600 * 1000).toISOString().split('T')[0] + 'T07:00:00',
    type: 'Ride',
    category: 'WORKOUT',
    moving_time: 4800,
    load: 92,
    description: 'Warmup 15m, then 3 sets of: [2m @ 95% FTP, 1m @ 108% FTP] x 5. 5m recovery between sets.',
    completed: false,
  },
  {
    id: 'ev_2',
    name: 'Zone 2 Aerobic Base Run',
    start_date_local: new Date(Date.now() + 42 * 3600 * 1000).toISOString().split('T')[0] + 'T07:30:00',
    type: 'Run',
    category: 'WORKOUT',
    moving_time: 3600,
    load: 55,
    description: 'Strict Zone 2 heart rate cap (under 142 bpm). Focus on relaxed breathing and posture.',
    completed: false,
  },
  {
    id: 'ev_3',
    name: 'Rest & Mobility Day',
    start_date_local: new Date(Date.now() + 66 * 3600 * 1000).toISOString().split('T')[0] + 'T08:00:00',
    type: 'Workout',
    category: 'NOTE',
    moving_time: 1200,
    load: 10,
    description: 'Full rest day. Foam rolling, hip flexor opening, hydration, 8+ hours sleep target.',
    completed: false,
  },
  {
    id: 'ev_4',
    name: 'Weekend Long Group Ride',
    start_date_local: new Date(Date.now() + 90 * 3600 * 1000).toISOString().split('T')[0] + 'T08:30:00',
    type: 'Ride',
    category: 'WORKOUT',
    moving_time: 12600,
    load: 175,
    description: '100km endurance route through foothills. Practice on-bike fueling (70g carbs/hr).',
    completed: false,
  },
];
