export interface SportSettings {
  id?: string;
  types?: string[];
  hr_zones?: number[];
  hr_zone_names?: string[];
  power_zones?: number[];
  power_zone_names?: string[];
  max_hr?: number;
  lthr?: number;
  ftp?: number;
  indoor_ftp?: number;
}

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
  sportSettings?: SportSettings[];
}

/** One point of a mean maximal power curve, exactly as Intervals.icu reports it. */
export interface PowerCurveSample {
  secs: number;
  watts: number;
  /** W/kg from the API (watts_per_kg) or from the athlete weight. null when the weight is unknown. */
  wkg: number | null;
}

/** A single curve (for example the last 42 days, or the current season). */
export interface PowerCurveSeries {
  /** Value of the `curves` parameter that produced this series, for example `42d` or `s0`. */
  id: string;
  /** Label shown to the user, for example `Recent 42D`. */
  label: string;
  /** Samples sorted by ascending duration. */
  samples: PowerCurveSample[];
}

/** Power curves of an athlete, plus the reason why they are missing. */
export interface PowerCurveData {
  recent: PowerCurveSeries | null;
  season: PowerCurveSeries | null;
  /** Weight used for the W/kg fallback, in kg. null when Intervals.icu has no weight. */
  weightKg: number | null;
  /** true only for the demo login: the numbers are simulated, not measured. */
  simulated: boolean;
  /** Why the curves are empty, in plain English. null when there is data. */
  error: string | null;
}

/** A reading at one requested duration: exact value, or interpolated between two samples. */
export interface PowerCurveReading {
  secs: number;
  watts: number;
  wkg: number | null;
  interpolated: boolean;
}

export const EMPTY_POWER_CURVE: PowerCurveData = {
  recent: null,
  season: null,
  weightKg: null,
  simulated: false,
  error: null,
};

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
  icu_hr_zone_times?: number[];
  icu_zone_times?: number[];
  feel?: number;
  rpe?: number;
  description?: string;
  intervals?: ActivityInterval[];
  polyline?: string;
  summary_polyline?: string;
  map?: {
    id?: string;
    summary_polyline?: string;
    polyline?: string;
  };
  start_latlng?: [number, number];
  end_latlng?: [number, number];
  icu_latlng?: [number, number][];
  indoor?: boolean;
  trainer?: boolean;
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
