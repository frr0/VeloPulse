import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEMO_ONLY } from '../config/demoOnly';
import {
  getActivities,
  getAthleteProfile,
  getCalendarEvents,
  getPowerCurves,
  getWellnessHistory,
  IntervalsApiError,
} from '../services/intervals/api';
import {
  MOCK_ACTIVITIES,
  MOCK_ATHLETE,
  MOCK_CALENDAR_EVENTS,
  MOCK_WELLNESS,
  SIMULATED_DEMO_POWER_CURVE,
} from '../services/intervals/mockData';
import {
  Activity,
  Athlete,
  AuthCredentials,
  CalendarEvent,
  EMPTY_POWER_CURVE,
  PowerCurveData,
  PowerCurveSample,
  PowerCurveSeries,
  Wellness,
} from '../types/intervals';
import { computeRecoveryScore } from '../utils/formatters';

interface AppContextType {
  credentials: AuthCredentials | null;
  athlete: Athlete | null;
  wellness: Wellness[];
  activities: Activity[];
  events: CalendarEvent[];
  powerCurve: PowerCurveData;
  isPowerCurveLoading: boolean;
  latestWellness: Wellness | null;
  recoveryScore: number;
  weeklyLoad: number;
  weeklyDurationSecs: number;
  weeklyDistanceMeters: number;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  useImperial: boolean;
  login: (apiKey: string, athleteId?: string) => Promise<void>;
  loginDemo: () => Promise<void>;
  logout: () => void;
  refreshData: () => Promise<void>;
  toggleUnits: () => void;
  clearError: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  AUTH: 'intervals_pulse_auth',
  SETTINGS: 'intervals_pulse_settings',
  ATHLETE: 'intervals_pulse_athlete',
  WELLNESS: 'intervals_pulse_wellness',
  ACTIVITIES: 'intervals_pulse_activities',
  EVENTS: 'intervals_pulse_events',
  POWER_CURVE: 'intervals_pulse_power_curve',
};

function parseCachedSeries(value: unknown): PowerCurveSeries | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<PowerCurveSeries>;
  if (typeof candidate.id !== 'string' || typeof candidate.label !== 'string') return null;
  if (!Array.isArray(candidate.samples)) return null;

  const samples: PowerCurveSample[] = [];
  for (const item of candidate.samples) {
    if (!item || typeof item !== 'object') continue;
    const sample = item as Partial<PowerCurveSample>;
    if (typeof sample.secs !== 'number' || typeof sample.watts !== 'number') continue;
    samples.push({
      secs: sample.secs,
      watts: sample.watts,
      wkg: typeof sample.wkg === 'number' ? sample.wkg : null,
    });
  }

  if (samples.length === 0) return null;
  return { id: candidate.id, label: candidate.label, samples };
}

function createDemoCredentials(): AuthCredentials {
  return {
    apiKey: 'DEMO_KEY',
    athleteId: 'demo',
    isDemo: true,
  };
}

/**
 * Reads the cached curve. Returns null when the cache is empty, old or broken:
 * a cache that cannot be read never becomes a number on the chart.
 */
function parseCachedPowerCurve(raw: string | null): PowerCurveData | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const value = parsed as Partial<PowerCurveData>;
    const recent = parseCachedSeries(value.recent);
    const season = parseCachedSeries(value.season);
    if (!recent && !season) return null;
    return {
      recent,
      season,
      weightKg: typeof value.weightKg === 'number' ? value.weightKg : null,
      simulated: value.simulated === true,
      error: null,
    };
  } catch {
    return null;
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // DEMO_ONLY (the published demo site only): the demo athlete and its mock
  // data are ready from the very first render, so the app never shows the
  // login screen, not even for an instant.
  const [credentials, setCredentials] = useState<AuthCredentials | null>(() =>
    DEMO_ONLY ? createDemoCredentials() : null
  );
  const [athlete, setAthlete] = useState<Athlete | null>(() => (DEMO_ONLY ? MOCK_ATHLETE : null));
  const [wellness, setWellness] = useState<Wellness[]>(() => (DEMO_ONLY ? MOCK_WELLNESS : []));
  const [activities, setActivities] = useState<Activity[]>(() =>
    DEMO_ONLY ? MOCK_ACTIVITIES : []
  );
  const [events, setEvents] = useState<CalendarEvent[]>(() =>
    DEMO_ONLY ? MOCK_CALENDAR_EVENTS : []
  );
  const [powerCurve, setPowerCurve] = useState<PowerCurveData>(() =>
    DEMO_ONLY ? SIMULATED_DEMO_POWER_CURVE : EMPTY_POWER_CURVE
  );
  const [isPowerCurveLoading, setIsPowerCurveLoading] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(!DEMO_ONLY);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [useImperial, setUseImperial] = useState<boolean>(false);

  // Restore stored session from localStorage on startup
  useEffect(() => {
    if (DEMO_ONLY) {
      // A visitor who once pasted a real API key, or an account from a
      // previous build, must not find it again: the demo always starts from
      // the credentials created above, never from a stored session, and
      // leaves nothing of a real account in the browser.
      localStorage.removeItem(STORAGE_KEYS.AUTH);
      localStorage.removeItem(STORAGE_KEYS.ATHLETE);
      localStorage.removeItem(STORAGE_KEYS.WELLNESS);
      localStorage.removeItem(STORAGE_KEYS.ACTIVITIES);
      localStorage.removeItem(STORAGE_KEYS.EVENTS);
      localStorage.removeItem(STORAGE_KEYS.POWER_CURVE);

      // The unit preference is not account data: it is the visitor's own
      // choice in the Profile page, and it has to survive a reload here too.
      const savedUnits = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (savedUnits) {
        try {
          setUseImperial(Boolean(JSON.parse(savedUnits).useImperial));
        } catch {
          localStorage.removeItem(STORAGE_KEYS.SETTINGS);
        }
      }
      return;
    }
    try {
      const savedAuth = localStorage.getItem(STORAGE_KEYS.AUTH);
      const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      const cachedAthlete = localStorage.getItem(STORAGE_KEYS.ATHLETE);
      const cachedWellness = localStorage.getItem(STORAGE_KEYS.WELLNESS);
      const cachedActivities = localStorage.getItem(STORAGE_KEYS.ACTIVITIES);
      const cachedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
      const cachedPowerCurve = localStorage.getItem(STORAGE_KEYS.POWER_CURVE);

      if (savedSettings) {
        setUseImperial(JSON.parse(savedSettings).useImperial);
      }

      const restoredPowerCurve = parseCachedPowerCurve(cachedPowerCurve);
      if (restoredPowerCurve) {
        setPowerCurve(restoredPowerCurve);
      } else if (cachedPowerCurve) {
        localStorage.removeItem(STORAGE_KEYS.POWER_CURVE);
      }

      if (savedAuth) {
        const parsedAuth: AuthCredentials = JSON.parse(savedAuth);
        setCredentials(parsedAuth);

        if (cachedAthlete) setAthlete(JSON.parse(cachedAthlete));
        if (cachedWellness) setWellness(JSON.parse(cachedWellness));
        if (cachedActivities) setActivities(JSON.parse(cachedActivities));
        if (cachedEvents) setEvents(JSON.parse(cachedEvents));

        // Background sync
        fetchFullData(parsedAuth, false);
      }
    } catch (e) {
      console.warn('Could not restore session:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  async function fetchFullData(auth: AuthCredentials, showSpinner = false) {
    if (showSpinner) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      if (auth.isDemo) {
        setAthlete(MOCK_ATHLETE);
        setWellness(MOCK_WELLNESS);
        setActivities(MOCK_ACTIVITIES);
        setEvents(MOCK_CALENDAR_EVENTS);
        setPowerCurve(SIMULATED_DEMO_POWER_CURVE);
        return;
      }

      setIsPowerCurveLoading(true);

      const [fetchedAthlete, fetchedWellness, fetchedActivities, fetchedEvents] =
        await Promise.all([
          getAthleteProfile(auth.apiKey, auth.athleteId),
          getWellnessHistory(auth.apiKey, auth.athleteId),
          getActivities(auth.apiKey, auth.athleteId),
          getCalendarEvents(auth.apiKey, auth.athleteId),
        ]);

      // Weight of the Intervals.icu profile: it feeds the W/kg fallback when
      // the curve has no watts_per_kg. Without a weight the W/kg stay empty.
      const profileWeight = fetchedAthlete?.weight ?? athlete?.weight ?? null;

      const fetchedPowerCurve = await getPowerCurves(
        auth.apiKey,
        auth.athleteId,
        profileWeight
      );

      setAthlete(fetchedAthlete);
      setWellness(fetchedWellness);
      setActivities(fetchedActivities);
      setEvents(fetchedEvents);

      localStorage.setItem(STORAGE_KEYS.ATHLETE, JSON.stringify(fetchedAthlete));
      localStorage.setItem(STORAGE_KEYS.WELLNESS, JSON.stringify(fetchedWellness));
      localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(fetchedActivities));
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(fetchedEvents));

      setPowerCurve(fetchedPowerCurve);
      if (fetchedPowerCurve.recent || fetchedPowerCurve.season) {
        localStorage.setItem(STORAGE_KEYS.POWER_CURVE, JSON.stringify(fetchedPowerCurve));
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      if (err instanceof IntervalsApiError) {
        setError(err.message);
      } else {
        setError(err.message || 'Unable to sync with Intervals.icu');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsPowerCurveLoading(false);
    }
  }

  const login = async (apiKey: string, athleteId = '0') => {
    setIsLoading(true);
    setError(null);
    try {
      const cleanKey = apiKey.trim();
      const cleanId = athleteId.trim() || '0';

      const verifiedAthlete = await getAthleteProfile(cleanKey, cleanId);

      const auth: AuthCredentials = {
        apiKey: cleanKey,
        athleteId: cleanId,
        isDemo: false,
      };

      localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(auth));
      setCredentials(auth);
      setAthlete(verifiedAthlete);

      await fetchFullData(auth, false);
    } catch (err: any) {
      setIsLoading(false);
      if (err instanceof IntervalsApiError) {
        setError(err.message);
        throw err;
      }
      const generic = 'Connection failed. Please verify your Intervals.icu API key.';
      setError(generic);
      throw new Error(generic);
    }
  };

  const loginDemo = async () => {
    setIsLoading(true);
    setError(null);
    const auth = createDemoCredentials();
    localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(auth));
    setCredentials(auth);
    setAthlete(MOCK_ATHLETE);
    setWellness(MOCK_WELLNESS);
    setActivities(MOCK_ACTIVITIES);
    setEvents(MOCK_CALENDAR_EVENTS);
    setPowerCurve(SIMULATED_DEMO_POWER_CURVE);
    setIsLoading(false);
  };

  const logout = () => {
    // DEMO_ONLY: there is no account to disconnect, and no logout control is
    // shown; this guard only protects against a stray call.
    if (DEMO_ONLY) return;
    localStorage.removeItem(STORAGE_KEYS.AUTH);
    localStorage.removeItem(STORAGE_KEYS.ATHLETE);
    localStorage.removeItem(STORAGE_KEYS.WELLNESS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVITIES);
    localStorage.removeItem(STORAGE_KEYS.EVENTS);
    localStorage.removeItem(STORAGE_KEYS.POWER_CURVE);
    setCredentials(null);
    setAthlete(null);
    setWellness([]);
    setActivities([]);
    setEvents([]);
    setPowerCurve(EMPTY_POWER_CURVE);
    setIsPowerCurveLoading(false);
    setError(null);
  };

  const refreshData = async () => {
    if (!credentials) return;
    await fetchFullData(credentials, false);
  };

  const toggleUnits = () => {
    const updated = !useImperial;
    setUseImperial(updated);
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ useImperial: updated }));
  };

  const clearError = () => setError(null);

  const latestWellness = useMemo(() => {
    if (!wellness || wellness.length === 0) return null;
    const sorted = [...wellness].sort(
      (a, b) => new Date(b.id).getTime() - new Date(a.id).getTime()
    );
    return sorted[0];
  }, [wellness]);

  const recoveryScore = useMemo(() => {
    return computeRecoveryScore(latestWellness || undefined);
  }, [latestWellness]);

  const { weeklyLoad, weeklyDurationSecs, weeklyDistanceMeters } = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;

    let load = 0;
    let duration = 0;
    let dist = 0;

    activities.forEach((act) => {
      const actTime = new Date(act.start_date_local).getTime();
      if (actTime >= sevenDaysAgo) {
        load += act.icu_training_load || 0;
        duration += act.moving_time || 0;
        dist += act.distance || 0;
      }
    });

    return {
      weeklyLoad: Math.round(load),
      weeklyDurationSecs: duration,
      weeklyDistanceMeters: dist,
    };
  }, [activities]);

  return (
    <AppContext.Provider
      value={{
        credentials,
        athlete,
        wellness,
        activities,
        events,
        powerCurve,
        isPowerCurveLoading,
        latestWellness,
        recoveryScore,
        weeklyLoad,
        weeklyDurationSecs,
        weeklyDistanceMeters,
        isLoading,
        isRefreshing,
        error,
        useImperial,
        login,
        loginDemo,
        logout,
        refreshData,
        toggleUnits,
        clearError,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
