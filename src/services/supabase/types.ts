export type DataProvider = 'intervals' | 'strava' | 'garmin';

export interface ProviderConnection {
  id: string;
  user_id: string;
  provider: DataProvider;
  status: 'connected' | 'disconnected' | 'error';
  external_athlete_id: string | null;
  api_key: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  updated_at: string;
}

export interface DbProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  ftp: number | null;
  weight_kg: number | null;
  max_hr: number | null;
  resting_hr: number | null;
  vo2max: number | null;
  use_imperial: boolean;
  rider_settings: Record<string, unknown> | null;
  sport_settings: unknown[] | null;
}
