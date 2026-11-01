import { Activity, Athlete, CalendarEvent, PowerCurvePoint, Wellness } from '../../types/intervals';

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

export const MOCK_POWER_CURVE: PowerCurvePoint[] = [
  { secs: 5, label: '5s', watts: 620, wkg: 9.1, seasonWatts: 680, seasonWkg: 9.9, category: 'Sprint' },
  { secs: 15, label: '15s', watts: 540, wkg: 7.9, seasonWatts: 580, seasonWkg: 8.5, category: 'Sprint' },
  { secs: 30, label: '30s', watts: 450, wkg: 6.6, seasonWatts: 480, seasonWkg: 7.0, category: 'Anaerobic' },
  { secs: 60, label: '1m', watts: 390, wkg: 5.7, seasonWatts: 410, seasonWkg: 6.0, category: 'Anaerobic' },
  { secs: 120, label: '2m', watts: 350, wkg: 5.1, seasonWatts: 365, seasonWkg: 5.3, category: 'VO2 Max' },
  { secs: 300, label: '5m', watts: 320, wkg: 4.7, seasonWatts: 335, seasonWkg: 4.9, category: 'VO2 Max' },
  { secs: 600, label: '10m', watts: 295, wkg: 4.3, seasonWatts: 305, seasonWkg: 4.5, category: 'Threshold' },
  { secs: 1200, label: '20m', watts: 280, wkg: 4.1, seasonWatts: 288, seasonWkg: 4.2, category: 'Threshold' },
  { secs: 3600, label: '1h', watts: 228, wkg: 3.3, seasonWatts: 242, seasonWkg: 3.5, category: 'Endurance' },
];

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

export const MOCK_ACTIVITIES: Activity[] = [
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
