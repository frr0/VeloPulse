import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  derivePowerCurve,
  getActivities,
  getAthleteProfile,
  getCalendarEvents,
  getWellnessHistory,
  IntervalsApiError,
} from '../services/intervals/api';
import {
  MOCK_ACTIVITIES,
  MOCK_ATHLETE,
  MOCK_CALENDAR_EVENTS,
  MOCK_POWER_CURVE,
  MOCK_WELLNESS,
} from '../services/intervals/mockData';
import { Activity, Athlete, AuthCredentials, CalendarEvent, PowerCurvePoint, Wellness } from '../types/intervals';
import { computeRecoveryScore } from '../utils/formatters';

interface AppContextType {
  credentials: AuthCredentials | null;
  athlete: Athlete | null;
  wellness: Wellness[];
  activities: Activity[];
  events: CalendarEvent[];
  powerCurve: PowerCurvePoint[];
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
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [credentials, setCredentials] = useState<AuthCredentials | null>(null);
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [wellness, setWellness] = useState<Wellness[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [useImperial, setUseImperial] = useState<boolean>(false);

  // Restore stored session from localStorage on startup
  useEffect(() => {
    try {
      const savedAuth = localStorage.getItem(STORAGE_KEYS.AUTH);
      const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      const cachedAthlete = localStorage.getItem(STORAGE_KEYS.ATHLETE);
      const cachedWellness = localStorage.getItem(STORAGE_KEYS.WELLNESS);
      const cachedActivities = localStorage.getItem(STORAGE_KEYS.ACTIVITIES);
      const cachedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);

      if (savedSettings) {
        setUseImperial(JSON.parse(savedSettings).useImperial);
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
        return;
      }

      const [fetchedAthlete, fetchedWellness, fetchedActivities, fetchedEvents] =
        await Promise.all([
          getAthleteProfile(auth.apiKey, auth.athleteId),
          getWellnessHistory(auth.apiKey, auth.athleteId),
          getActivities(auth.apiKey, auth.athleteId),
          getCalendarEvents(auth.apiKey, auth.athleteId),
        ]);

      setAthlete(fetchedAthlete);
      setWellness(fetchedWellness);
      setActivities(fetchedActivities);
      setEvents(fetchedEvents);

      localStorage.setItem(STORAGE_KEYS.ATHLETE, JSON.stringify(fetchedAthlete));
      localStorage.setItem(STORAGE_KEYS.WELLNESS, JSON.stringify(fetchedWellness));
      localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(fetchedActivities));
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(fetchedEvents));
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
    const auth: AuthCredentials = {
      apiKey: 'DEMO_KEY',
      athleteId: 'demo',
      isDemo: true,
    };
    localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(auth));
    setCredentials(auth);
    setAthlete(MOCK_ATHLETE);
    setWellness(MOCK_WELLNESS);
    setActivities(MOCK_ACTIVITIES);
    setEvents(MOCK_CALENDAR_EVENTS);
    setIsLoading(false);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEYS.AUTH);
    localStorage.removeItem(STORAGE_KEYS.ATHLETE);
    localStorage.removeItem(STORAGE_KEYS.WELLNESS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVITIES);
    localStorage.removeItem(STORAGE_KEYS.EVENTS);
    setCredentials(null);
    setAthlete(null);
    setWellness([]);
    setActivities([]);
    setEvents([]);
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

  const powerCurve = useMemo(() => {
    if (credentials?.isDemo || !athlete) {
      return MOCK_POWER_CURVE;
    }
    return derivePowerCurve(athlete.ftp || 295, athlete.weight || 68.5);
  }, [credentials, athlete]);

  return (
    <AppContext.Provider
      value={{
        credentials,
        athlete,
        wellness,
        activities,
        events,
        powerCurve,
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
