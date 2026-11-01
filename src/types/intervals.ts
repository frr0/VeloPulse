export interface Athlete {
  id: string;
  name: string;
  firstname?: string;
  lastname?: string;
  profile_medium?: string;
  city?: string;
  country?: string;
  weight?: number;
  restingHR?: number;
  maxHR?: number;
  ftp?: number;
  vo2max?: number;
}

export interface PowerCurvePoint {
  secs: number;
  label: string;
  watts: number;
  wkg: number;
  seasonWatts?: number;
  seasonWkg?: number;
  category: 'Sprint' | 'Anaerobic' | 'VO2 Max' | 'Threshold' | 'Endurance';
}

export interface Wellness {
  id: string; // "YYYY-MM-DD"
  ctl?: number; // Chronic Training Load (Fitness)
  atl?: number; // Acute Training Load (Fatigue)
  rampRate?: number;
  ctlLoad?: number;
  atlLoad?: number;
  restingHR?: number;
  hrv?: number; // rMSSD in ms
  hrvSDNN?: number;
  sleepSecs?: number;
  sleepScore?: number;
  sleepQuality?: number; // 1-5
  avgSleepingHR?: number;
  soreness?: number; // 1-5
  fatigue?: number; // 1-5
  stress?: number; // 1-5
  mood?: number; // 1-5
  motivation?: number;
  weight?: number;
  readiness?: number;
  comments?: string;
  tsb?: number; // Form = CTL - ATL
  vo2max?: number;
}

export interface ActivityInterval {
  id: number;
  type?: string;
  start_time?: number;
  end_time?: number;
  moving_time?: number;
  elapsed_time?: number;
  average_watts?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_speed?: number;
  intensity?: number;
}

export interface Activity {
  id: string;
  name: string;
  type: string;
  start_date_local: string;
  distance?: number; // meters
  moving_time?: number; // seconds
  elapsed_time?: number;
  total_elevation_gain?: number; // meters
  average_speed?: number; // m/s
  max_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_watts?: number;
  weighted_average_watts?: number; // NP
  icu_training_load?: number; // TSS
  icu_intensity?: number; // IF
  icu_ftp?: number;
  icu_joules?: number;
  icu_average_cadence?: number;
  icu_hr_zones?: number[];
  feel?: number;
  rpe?: number;
  description?: string;
  intervals?: ActivityInterval[];
}

export interface CalendarEvent {
  id: number | string;
  start_date_local: string;
  name: string;
  type?: string;
  category?: 'WORKOUT' | 'TARGET' | 'NOTE' | 'RACE';
  moving_time?: number;
  load?: number;
  description?: string;
  completed?: boolean;
}

export interface AuthCredentials {
  apiKey: string;
  athleteId: string;
  isDemo?: boolean;
}
