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
import { isSupabaseConfigured, supabase } from '../services/supabase/client';
import {
  connectAndSyncIntervals,
  disconnectProviderConnection,
  importFitFileToDatabase,
  loadUserBundle,
  saveUserUnits,
  syncStravaViaBackend,
  UserDatabaseBundle,
} from '../services/supabase/database';
import { DataProvider, ProviderConnection } from '../services/supabase/types';
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

export interface AuthUserSummary {
  id: string;
  email?: string;
}

interface AppContextType {
  isSupabaseMode: boolean;
  authUser: AuthUserSummary | null;
  providerConnections: ProviderConnection[];
  credentials: AuthCredentials | null;
  athlete: Athlete | null;
  wellness: Wellness[];
  activities: Activity[];
  events: CalendarEvent[];
  powerCurve: PowerCurveData;
  isPowerCurveLoading: boolean;
  latestWellness: Wellness | null;
  recoveryScore: number | null;
  weeklyLoad: number;
  weeklyDurationSecs: number;
  weeklyDistanceMeters: number;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  useImperial: boolean;
  // Legacy / non-Supabase auth
  login: (apiKey: string, athleteId?: string) => Promise<void>;
  loginDemo: () => Promise<void>;
  // Supabase Auth
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    fullName?: string
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  signInWithGoogle: () => Promise<void>;
  // Data Providers (Supabase DB)
  connectIntervals: (apiKey: string, athleteId?: string) => Promise<void>;
  disconnectProvider: (provider: DataProvider) => Promise<void>;
  connectStrava: () => Promise<void>;
  syncStrava: () => Promise<number>;
  importGarminFit: (file: File) => Promise<Activity>;
  // Common actions
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
  const isSupabaseMode = isSupabaseConfigured && !DEMO_ONLY;

  const [authUser, setAuthUser] = useState<AuthUserSummary | null>(null);
  const [providerConnections, setProviderConnections] = useState<ProviderConnection[]>([]);

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

  const applySupabaseBundle = (bundle: UserDatabaseBundle, userId: string) => {
    setProviderConnections(bundle.connections);
    setAthlete(bundle.athlete);
    setWellness(bundle.wellness);
    setActivities(bundle.activities);
    setEvents(bundle.events);
    setPowerCurve(bundle.powerCurve);
    if (bundle.profile && typeof bundle.profile.use_imperial === 'boolean') {
      setUseImperial(bundle.profile.use_imperial);
    }

    const intervalsConn = bundle.connections.find(
      (c) => c.provider === 'intervals' && c.status === 'connected' && c.api_key
    );
    setCredentials({
      apiKey: intervalsConn?.api_key || '',
      athleteId: intervalsConn?.external_athlete_id || userId,
      isDemo: false,
    });
  };

  // Startup & session restoration
  useEffect(() => {
    if (DEMO_ONLY) {
      localStorage.removeItem(STORAGE_KEYS.AUTH);
      localStorage.removeItem(STORAGE_KEYS.ATHLETE);
      localStorage.removeItem(STORAGE_KEYS.WELLNESS);
      localStorage.removeItem(STORAGE_KEYS.ACTIVITIES);
      localStorage.removeItem(STORAGE_KEYS.EVENTS);
      localStorage.removeItem(STORAGE_KEYS.POWER_CURVE);

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

    // --- SUPABASE MODE ---
    if (isSupabaseMode && supabase) {
      let active = true;

      const hydrateSession = async (userId: string, email?: string) => {
        try {
          const bundle = await loadUserBundle(userId, email);
          if (!active) return;
          applySupabaseBundle(bundle, userId);
        } catch (err: any) {
          if (!active) return;
          console.error('Failed to load Supabase bundle:', err);
          setError(err?.message || 'Unable to load data from the database.');
          // Still grant access to the app shell so user can manage connections
          setCredentials({ apiKey: '', athleteId: userId, isDemo: false });
        } finally {
          if (active) setIsLoading(false);
        }
      };

      const wantsDemo =
        typeof window !== 'undefined' &&
        (window.location.pathname.replace(/\/+$/, '') === '/demo' ||
          new URLSearchParams(window.location.search).get('demo') === '1');

      if (wantsDemo) {
        setAuthUser(null);
        setCredentials(createDemoCredentials());
        setAthlete(MOCK_ATHLETE);
        setWellness(MOCK_WELLNESS);
        setActivities(MOCK_ACTIVITIES);
        setEvents(MOCK_CALENDAR_EVENTS);
        setPowerCurve(SIMULATED_DEMO_POWER_CURVE);
        setIsLoading(false);
        return;
      }

      supabase.auth.getSession().then(({ data }) => {
        if (!active) return;
        const user = data.session?.user;
        if (user) {
          setAuthUser({ id: user.id, email: user.email });
          hydrateSession(user.id, user.email);
        } else {
          setAuthUser(null);
          setCredentials(null);
          setIsLoading(false);
        }
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        const user = session?.user;
        if (user) {
          setAuthUser({ id: user.id, email: user.email });
          hydrateSession(user.id, user.email);
        } else {
          setAuthUser(null);
          setProviderConnections([]);
          setCredentials(null);
          setAthlete(null);
          setWellness([]);
          setActivities([]);
          setEvents([]);
          setPowerCurve(EMPTY_POWER_CURVE);
          setIsLoading(false);
        }
      });

      return () => {
        active = false;
        subscription.unsubscribe();
      };
    }

    // --- LEGACY LOCAL MODE (no Supabase env configured) ---
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

        fetchFullData(parsedAuth, false);
      }
    } catch (e) {
      console.warn('Could not restore session:', e);
    } finally {
      setIsLoading(false);
    }
  }, [isSupabaseMode]);

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

  // --- Supabase Auth methods ---
  const signInWithEmail = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    setError(null);
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authErr) {
      setError(authErr.message);
      throw authErr;
    }
  };

  const signUpWithEmail = async (email: string, password: string, fullName?: string) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    setError(null);
    const { data, error: authErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: fullName?.trim() ? { full_name: fullName.trim() } : undefined,
        emailRedirectTo: window.location.origin,
      },
    });
    if (authErr) {
      setError(authErr.message);
      throw authErr;
    }
    return { needsEmailConfirmation: !data.session };
  };

  const signInWithGoogle = async () => {
    if (!supabase) throw new Error('Supabase is not configured.');
    setError(null);
    const { error: authErr } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (authErr) {
      setError(authErr.message);
      throw authErr;
    }
  };

  // --- Data provider methods (Supabase DB) ---
  const connectIntervals = async (apiKey: string, athleteId = '0') => {
    if (!authUser) throw new Error('Please sign in before connecting Intervals.icu.');
    setIsRefreshing(true);
    setIsPowerCurveLoading(true);
    setError(null);
    try {
      const bundle = await connectAndSyncIntervals(
        authUser.id,
        apiKey,
        athleteId,
        authUser.email
      );
      applySupabaseBundle(bundle, authUser.id);
    } catch (err: any) {
      const msg = err?.message || 'Failed to connect to Intervals.icu.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsRefreshing(false);
      setIsPowerCurveLoading(false);
    }
  };

  const disconnectProvider = async (provider: DataProvider) => {
    if (!authUser) return;
    setError(null);
    await disconnectProviderConnection(authUser.id, provider);
    const bundle = await loadUserBundle(authUser.id, authUser.email);
    applySupabaseBundle(bundle, authUser.id);
  };

  const connectStrava = async () => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Session expired. Please sign in again.');
    window.location.href = `/api/strava/auth?token=${encodeURIComponent(token)}`;
  };

  const syncStrava = async () => {
    if (!authUser) throw new Error('Please sign in before syncing Strava.');
    setIsRefreshing(true);
    setError(null);
    try {
      const result = await syncStravaViaBackend();
      const bundle = await loadUserBundle(authUser.id, authUser.email);
      applySupabaseBundle(bundle, authUser.id);
      return result.synced;
    } catch (err: any) {
      const msg = err?.message || 'Strava sync failed.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsRefreshing(false);
    }
  };

  const importGarminFit = async (file: File) => {
    if (!authUser) throw new Error('Please sign in before importing a .FIT file.');
    setIsRefreshing(true);
    setError(null);
    try {
      const activity = await importFitFileToDatabase(authUser.id, file);
      const bundle = await loadUserBundle(authUser.id, authUser.email);
      applySupabaseBundle(bundle, authUser.id);
      return activity;
    } catch (err: any) {
      const msg = err?.message || 'Failed to import .FIT file.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsRefreshing(false);
    }
  };

  // --- Legacy login methods ---
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
    if (DEMO_ONLY) return;

    if (isSupabaseMode && supabase) {
      supabase.auth.signOut().catch((e) => console.warn('Sign out error:', e));
    }

    localStorage.removeItem(STORAGE_KEYS.AUTH);
    localStorage.removeItem(STORAGE_KEYS.ATHLETE);
    localStorage.removeItem(STORAGE_KEYS.WELLNESS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVITIES);
    localStorage.removeItem(STORAGE_KEYS.EVENTS);
    localStorage.removeItem(STORAGE_KEYS.POWER_CURVE);
    setAuthUser(null);
    setProviderConnections([]);
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
    if (isSupabaseMode && authUser) {
      setIsRefreshing(true);
      setError(null);
      try {
        const intervalsConn = providerConnections.find(
          (c) => c.provider === 'intervals' && c.status === 'connected' && c.api_key
        );
        if (intervalsConn?.api_key) {
          const bundle = await connectAndSyncIntervals(
            authUser.id,
            intervalsConn.api_key,
            intervalsConn.external_athlete_id || '0',
            authUser.email
          );
          applySupabaseBundle(bundle, authUser.id);
        } else {
          const bundle = await loadUserBundle(authUser.id, authUser.email);
          applySupabaseBundle(bundle, authUser.id);
        }
      } catch (err: any) {
        setError(err?.message || 'Sync failed.');
      } finally {
        setIsRefreshing(false);
      }
      return;
    }

    if (!credentials) return;
    await fetchFullData(credentials, false);
  };

  const toggleUnits = () => {
    const updated = !useImperial;
    setUseImperial(updated);
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ useImperial: updated }));
    if (isSupabaseMode && authUser) {
      saveUserUnits(authUser.id, updated).catch(() => {});
    }
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
        isSupabaseMode,
        authUser,
        providerConnections,
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
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        connectIntervals,
        disconnectProvider,
        connectStrava,
        syncStrava,
        importGarminFit,
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
