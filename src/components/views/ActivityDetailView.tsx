import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowLeft,
  BatteryLow,
  Bike,
  Calendar,
  Clock,
  Download,
  ExternalLink,
  Footprints,
  Gauge,
  Heart,
  Home,
  Loader2,
  MapPin,
  MapPinOff,
  MessageSquare,
  Mountain,
  Repeat,
  RotateCw,
  Share2,
  TrendingDown,
  TrendingUp,
  Waves,
  Zap,
} from 'lucide-react';
import { Activity } from '../../types/intervals';
import { HrZoneCustom, UserSettings } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  getActivityDetails,
  getActivityStreams,
  latlngStreamToCoordinates,
} from '../../services/intervals/api';
import { ActivityMap } from '../ActivityMap';
import { ActivityStreamChart, StreamChartRow } from '../charts/ActivityStreamChart';
import { ZoneHistogramChart } from '../charts/ZoneHistogramChart';
import { getActivityRoute } from '../../utils/polyline';
import {
  ACTIVITY_STREAM_TYPES,
  ActivitySeries,
  DECOUPLING_THRESHOLD_PERCENT,
  MAX_CHART_POINTS,
  computeAerobicDecoupling,
  computeHrZoneHistogram,
  computePowerZoneHistogram,
  readActivitySeries,
  smoothShortDropouts,
  thinSeriesForChart,
} from '../../utils/activityAnalysis';
import {
  CriticalPowerResult,
  CriticalPowerUnavailableReason,
  WBAL_LOW_FRACTION,
  computeWbalSeries,
  estimateCriticalPower,
} from '../../utils/criticalPower';
import { getDefaultHrZones } from '../../utils/zones';
import {
  formatDateRelative,
  formatDistance,
  formatDuration,
  formatElevation,
  formatHeartRate,
  formatPace,
  formatSpeed,
  formatWatts,
} from '../../utils/formatters';

/** Why the critical power model has no estimate, in the language of this page. */
const CP_UNAVAILABLE_TEXT: Record<CriticalPowerUnavailableReason, string> = {
  'no-curve': 'Intervals.icu non ha restituito una curva di potenza per questo atleta.',
  'durations-missing':
    'nella tua curva di potenza servono almeno due prove di durata fra 2 e 20 minuti.',
  'durations-too-close': 'le durate della tua curva di potenza sono troppo vicine fra loro.',
  'model-not-applicable':
    'la tua curva di potenza fra 2 e 20 minuti non segue il modello della potenza critica.',
};

interface ActivityDetailViewProps {
  activity: Activity;
  onBack: () => void;
  returnTabName?: string;
  useImperial?: boolean;
  settings?: UserSettings;
}

export const ActivityDetailView: React.FC<ActivityDetailViewProps> = ({
  activity,
  onBack,
  returnTabName = 'Attività',
  useImperial = false,
  settings,
}) => {
  const { credentials, powerCurve } = useApp();
  const [detailedActivity, setDetailedActivity] = useState<Activity>(activity);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  // Why the recorded data is missing, when Intervals.icu could not be read.
  // null when the call worked: in that case the activity simply has no series.
  const [streamsError, setStreamsError] = useState<string | null>(null);
  // The recorded series of the activity. null while loading, or when the
  // activity carries none of them.
  const [series, setSeries] = useState<ActivitySeries | null>(null);
  // Coordinate hovered on one of the telemetry charts
  const [hoveredCoordinate, setHoveredCoordinate] = useState<[number, number] | null>(null);
  // Fixed/sticky map mode while scrolling graphs; can be dismissed with 'X'
  const [isMapPinned, setIsMapPinned] = useState(true);
  const [isMapClosed, setIsMapClosed] = useState(false);

  // Keyboard shortcut: Escape to go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  // Fetch full details and streams from Intervals.icu if available
  useEffect(() => {
    setDetailedActivity(activity);
    setStreamsError(null);
    setSeries(null);
    if (!activity) return;

    if (credentials && !credentials.isDemo && activity.id) {
      setIsLoadingDetails(true);
      Promise.all([
        getActivityDetails(credentials.apiKey, activity.id).catch(() => null),
        // One single call for every series the page needs: the track for the map
        // and the four grandeurs of the charts over time.
        // getActivityStreams never rejects: a failure arrives as status 'failed'.
        getActivityStreams(credentials.apiKey, activity.id, [...ACTIVITY_STREAM_TYPES]),
      ])
        .then(([full, streams]) => {
          setStreamsError(streams.status === 'failed' ? streams.reason : null);
          setSeries(streams.status === 'ok' ? readActivitySeries(streams.streams) : null);
          setDetailedActivity((prev) => {
            const next = { ...prev, ...(full || {}) };
            if (streams.status === 'ok') {
              const track = latlngStreamToCoordinates(
                streams.streams.find((stream) => stream.type === 'latlng')
              );
              if (track.length > 1) next.icu_latlng = track;
            }
            return next;
          });
        })
        .finally(() => {
          setIsLoadingDetails(false);
        });
    }
  }, [activity, credentials]);

  const currentAct = detailedActivity || activity;

  // Real GPS track only: the app never draws an invented route.
  const routeSignature = [
    currentAct.id,
    Array.isArray(currentAct.icu_latlng) ? currentAct.icu_latlng.length : 0,
    currentAct.map?.summary_polyline || currentAct.map?.polyline || '',
    currentAct.summary_polyline || currentAct.polyline || '',
  ].join('|');

  // eslint-disable-next-line react-hooks/exhaustive-deps -- routeSignature covers every field read by getActivityRoute
  const route = useMemo(() => getActivityRoute(currentAct), [routeSignature]);
  const hasRoute = route.length > 1;

  // Pre-calculate full aligned latlng points for each timeSecs sample to drive synchronized hover dot
  const fullLatlngSeries = useMemo<([number, number] | null)[] | null>(() => {
    if (!series?.timeSecs || series.timeSecs.length === 0 || route.length === 0) return null;
    const timeSecs = series.timeSecs;
    const totalTime = Math.max(1, timeSecs[timeSecs.length - 1] - timeSecs[0]);
    const routeLen = route.length;

    return timeSecs.map((t) => {
      const progress = Math.min(1, Math.max(0, (t - timeSecs[0]) / totalTime));
      const idx = Math.min(routeLen - 1, Math.max(0, Math.round(progress * (routeLen - 1))));
      return route[idx] || null;
    });
  }, [series?.timeSecs, route]);

  // Power & cadence series filtered for micro-dropouts / momentary stops (<= 3 seconds)
  // so brief interruptions or gear shifting don't cause sharp plunges to 0,
  // while longer stops (> 3s, like red lights) remain at 0.
  const smoothedWatts = useMemo(
    () => (series?.watts ? smoothShortDropouts(series.timeSecs, series.watts) : null),
    [series]
  );
  const smoothedCadence = useMemo(
    () => (series?.cadence ? smoothShortDropouts(series.timeSecs, series.cadence) : null),
    [series]
  );

  // Charts over time: one chart per grandeur the activity really has. The
  // series are thinned for drawing only, so the page stays fluid on a phone;
  // every analysis below runs on the full series.
  const altitudeRows = useMemo<StreamChartRow[]>(
    () =>
      series?.altitude
        ? thinSeriesForChart(series.timeSecs, series.altitude, MAX_CHART_POINTS, null, fullLatlngSeries)
        : [],
    [series, fullLatlngSeries]
  );
  const heartrateRows = useMemo<StreamChartRow[]>(
    () =>
      series?.heartrate
        ? thinSeriesForChart(series.timeSecs, series.heartrate, MAX_CHART_POINTS, series.altitude, fullLatlngSeries)
        : [],
    [series, fullLatlngSeries]
  );
  const wattsRows = useMemo<StreamChartRow[]>(
    () =>
      smoothedWatts && series
        ? thinSeriesForChart(series.timeSecs, smoothedWatts, MAX_CHART_POINTS, series.altitude, fullLatlngSeries)
        : [],
    [series, smoothedWatts, fullLatlngSeries]
  );
  const cadenceRows = useMemo<StreamChartRow[]>(
    () =>
      smoothedCadence && series
        ? thinSeriesForChart(series.timeSecs, smoothedCadence, MAX_CHART_POINTS, series.altitude, fullLatlngSeries)
        : [],
    [series, smoothedCadence, fullLatlngSeries]
  );
  const speedRows = useMemo<StreamChartRow[]>(() => {
    if (!series?.speed) return [];
    // If user prefers imperial, convert km/h to mph (1 km/h = 0.621371 mph)
    const values = useImperial
      ? series.speed.map((v) => (v !== null ? v * 0.621371 : null))
      : series.speed;
    return thinSeriesForChart(series.timeSecs, values, MAX_CHART_POINTS, series.altitude, fullLatlngSeries);
  }, [series, useImperial, fullLatlngSeries]);

  const hasStreamCharts =
    altitudeRows.length > 0 ||
    heartrateRows.length > 0 ||
    wattsRows.length > 0 ||
    cadenceRows.length > 0 ||
    speedRows.length > 0;

  // Why there is no recorded data. The demo login and an activity without an
  // Intervals.icu id are told apart from a call that really failed.
  const streamsUnavailableReason =
    streamsError ??
    (!credentials || credentials.isDemo
      ? 'L’accesso dimostrativo non è collegato a Intervals.icu, quindi non ci sono dati registrati da leggere.'
      : !currentAct.id
      ? 'Questa attività non ha un identificativo su Intervals.icu, quindi non posso chiedere i dati registrati.'
      : 'Intervals.icu non ha dati registrati per questa attività.');

  // CP and W' estimated on the power curve the app already downloaded.
  const criticalPower = useMemo<CriticalPowerResult>(() => {
    const curve = powerCurve.recent ?? powerCurve.season;
    return estimateCriticalPower(curve?.samples ?? null, curve?.label ?? '');
  }, [powerCurve]);

  // W'bal: computed on the full power series, then thinned for drawing. `low`
  // repeats the value only under a quarter of the full reserve, so that stretch
  // stands out.
  const wbalRows = useMemo<StreamChartRow[]>(() => {
    if (!series?.watts || criticalPower.status !== 'ok') return [];
    const { cpWatts, wPrimeJoules } = criticalPower.estimate;
    const points = computeWbalSeries(
      series.timeSecs,
      series.watts,
      cpWatts,
      wPrimeJoules,
      series.intervalSecs
    );
    if (points.length === 0) return [];

    const lowJoules = wPrimeJoules * WBAL_LOW_FRACTION;
    const step = Math.max(1, Math.ceil(points.length / MAX_CHART_POINTS));
    const rows: StreamChartRow[] = [];
    const add = (index: number) => {
      const point = points[index];
      const kilojoules = point.joules === null ? null : point.joules / 1000;
      rows.push({
        t: point.t,
        v: kilojoules,
        low: point.joules !== null && point.joules < lowJoules ? kilojoules : null,
        alt: series.altitude && series.altitude[index] !== undefined ? series.altitude[index] : null,
        latlng: fullLatlngSeries && fullLatlngSeries[index] ? fullLatlngSeries[index] : null,
      });
    };
    for (let i = 0; i < points.length; i += step) add(i);
    const last = points.length - 1;
    if (rows[rows.length - 1].t !== points[last].t) add(last);
    return rows;
  }, [series, criticalPower, fullLatlngSeries]);

  const wbalMissingReason = !series?.watts
    ? 'Manca la serie della potenza: Intervals.icu non l’ha registrata per questa attività.'
    : criticalPower.status !== 'ok'
    ? `Manca la stima di CP: ${CP_UNAVAILABLE_TEXT[criticalPower.reason]}`
    : null;

  // Zones of the user: the custom ones from the settings, otherwise the ones
  // the app derives from the maximum and the resting heart rate of the settings.
  const resolvedHrZones = useMemo<HrZoneCustom[] | null>(() => {
    if (!settings) return null;
    if (settings.hrZones && settings.hrZones.length > 0) return settings.hrZones;
    return getDefaultHrZones(settings.maxHeartRate, settings.restingHeartRate);
  }, [settings]);

  // Histograms computed by the app on the recorded series: an indoor session of
  // the VeloPulse studio, which Intervals.icu did not split, still gets them.
  const powerHistogram = useMemo(
    () => computePowerZoneHistogram(series, settings?.ftp ?? null),
    [series, settings?.ftp]
  );
  const hrHistogram = useMemo(
    () => computeHrZoneHistogram(series, resolvedHrZones, settings?.maxHeartRate ?? null),
    [series, resolvedHrZones, settings?.maxHeartRate]
  );

  const powerHistogramMissingNote = powerHistogram
    ? null
    : !series?.watts
    ? 'Istogramma calcolato non disponibile: Intervals.icu non ha la serie della potenza di questa attività.'
    : 'Istogramma calcolato non disponibile: imposta il tuo FTP nelle impostazioni per avere le zone di potenza.';
  const hrHistogramMissingNote = hrHistogram
    ? null
    : !series?.heartrate
    ? 'Istogramma calcolato non disponibile: Intervals.icu non ha la serie del battito di questa attività.'
    : 'Istogramma calcolato non disponibile: imposta le tue zone di battito nelle impostazioni.';

  const decoupling = useMemo(() => computeAerobicDecoupling(series), [series]);

  // HR Zones
  const isBpmBounds = (arr: number[]) => {
    if (!arr || arr.length < 2) return false;
    const allInHrRange = arr.every((v) => v >= 70 && v <= 235);
    const isAscending = arr.every((v, i) => i === 0 || v > arr[i - 1]);
    return allInHrRange && isAscending;
  };

  let hrZoneTimes: number[] = [];
  if (Array.isArray(currentAct.icu_hr_zone_times) && currentAct.icu_hr_zone_times.length > 0) {
    hrZoneTimes = currentAct.icu_hr_zone_times;
  } else if (Array.isArray(currentAct.icu_hr_zones) && !isBpmBounds(currentAct.icu_hr_zones)) {
    hrZoneTimes = currentAct.icu_hr_zones;
  }

  const totalHrSecs = hrZoneTimes.reduce((a, b) => a + b, 0);

  const defaultZoneColors = ['#94A3B8', '#38BDF8', '#10B981', '#F59E0B', '#EF4444', '#FB923C', '#C084FC'];
  const defaultZoneLabels = [
    'Z1 Recupero Attivo',
    'Z2 Fondo Lento / Aerobico',
    'Z3 Medio / Tempo',
    'Z4 Soglia Anaerobica',
    'Z5 VO2 Max',
    'Z6 Capacità Anaerobica',
    'Z7 Neuromuscolare',
  ];

  const userHrZones = settings?.hrZones || [];

  // Power Zones
  const powerZoneTimes = Array.isArray(currentAct.icu_zone_times) ? currentAct.icu_zone_times : [];
  const totalPowerSecs = powerZoneTimes.reduce((a, b) => a + b, 0);

  const typeLower = (currentAct.type || '').toLowerCase();
  const isRun = typeLower.includes('run');
  const isRide = typeLower.includes('ride') || typeLower.includes('cycl');

  const hasHeroMetrics = Boolean(
    currentAct.distance ||
    currentAct.moving_time ||
    currentAct.elapsed_time ||
    currentAct.total_elevation_gain ||
    (currentAct.icu_training_load !== undefined && currentAct.icu_training_load !== null)
  );

  const hasPerformanceMetrics = Boolean(
    currentAct.average_watts ||
    currentAct.average_speed ||
    currentAct.average_heartrate ||
    currentAct.icu_average_cadence ||
    currentAct.icu_intensity ||
    currentAct.icu_joules
  );

  const hasHrZones = Boolean(hrHistogram || totalHrSecs > 0 || currentAct.average_heartrate);
  const hasPowerZones = Boolean(powerHistogram || totalPowerSecs > 0);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Header / Breadcrumb Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-6 bg-[#1F2025] border border-[#383941] rounded-3xl shadow-xl">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="group flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#26272D] hover:bg-[#2F3037] border border-[#383941] text-slate-300 hover:text-white transition-all text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4 text-[#00E5A3] group-hover:-translate-x-0.5 transition-transform" />
            <span>Torna a {returnTabName}</span>
          </button>

          <div className="h-6 w-[1px] bg-white/10 hidden sm:block" />

          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-[#00E5A3]/10 border border-[#00E5A3]/20 flex items-center justify-center text-[#00E5A3] shadow-inner">
              {isRide ? <Bike className="w-5 h-5" /> : isRun ? <Footprints className="w-5 h-5" /> : <Waves className="w-5 h-5" />}
            </span>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                <span className="uppercase tracking-wider text-[#A8C7FA] font-bold">
                  {currentAct.type || 'Workout'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDateRelative(currentAct.start_date_local)}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{currentAct.name}</h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {credentials && !credentials.isDemo && currentAct.id && (
            <a
              href={`https://intervals.icu/activities/${currentAct.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#26272D] hover:bg-[#2F3037] border border-[#383941] text-xs font-semibold text-slate-300 hover:text-white transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              <span>Intervals.icu</span>
            </a>
          )}
        </div>
      </div>

      {/* Interactive GPS Map: sticky during scroll, dismissible with X */}
      {hasRoute && !isMapClosed && (
        <section
          className={`transition-all duration-200 ${
            isMapPinned
              ? 'sticky top-[108px] lg:top-20 z-20 shadow-2xl rounded-2xl overflow-hidden'
              : ''
          }`}
        >
          <ActivityMap
            activity={currentAct}
            coordinates={route}
            useImperial={useImperial}
            cartoApiKey={settings?.cartoApiKey}
            hoveredCoordinate={hoveredCoordinate}
            isPinned={isMapPinned}
            onClose={() => setIsMapClosed(true)}
          />
        </section>
      )}

      {/* Button to restore map when dismissed via X */}
      {hasRoute && isMapClosed && (
        <div className="flex items-center justify-between p-2.5 px-4 rounded-xl bg-[#1F2025] border border-[#383941] shadow-md">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <MapPin className="w-4 h-4 text-[#00E5A3]" />
            <span>Mappa GPS nascosta: puoi scorrere tutti i grafici a schermo intero.</span>
          </div>
          <button
            onClick={() => setIsMapClosed(false)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#26272D] hover:bg-[#2F3037] border border-[#383941] text-xs font-bold text-[#00E5A3] hover:text-white transition-colors"
          >
            <span>Riapri Mappa</span>
          </button>
        </div>
      )}

      {/* Activity Key Metrics Overview - Single unified card between map and charts with compact font */}
      {(hasHeroMetrics || hasPerformanceMetrics) && (
        <section className="bg-[#1F2025] border border-[#383941] p-3.5 sm:p-4 rounded-2xl shadow-lg space-y-3">
          {/* Primary Stats Row */}
          {hasHeroMetrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
              {currentAct.distance ? (
                <div className="bg-[#26272D] p-2.5 sm:p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Distanza
                  </span>
                  <span className="text-base sm:text-lg font-black text-white font-mono">
                    {formatDistance(currentAct.distance, useImperial)}
                  </span>
                </div>
              ) : null}

              {(currentAct.moving_time || currentAct.elapsed_time) ? (
                <div className="bg-[#26272D] p-2.5 sm:p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Tempo
                  </span>
                  <span className="text-base sm:text-lg font-black text-white font-mono">
                    {formatDuration(currentAct.moving_time || currentAct.elapsed_time)}
                  </span>
                </div>
              ) : null}

              {currentAct.total_elevation_gain ? (
                <div className="bg-[#26272D] p-2.5 sm:p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Dislivello
                  </span>
                  <span className="text-base sm:text-lg font-black text-[#6DD58C] font-mono">
                    {formatElevation(currentAct.total_elevation_gain, useImperial)}
                  </span>
                </div>
              ) : null}

              {currentAct.icu_training_load !== undefined && currentAct.icu_training_load !== null ? (
                <div className="bg-[#26272D] p-2.5 sm:p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Carico (TSS)
                  </span>
                  <span className="text-base sm:text-lg font-black text-[#FC5200] font-mono">
                    {Math.round(currentAct.icu_training_load)}
                  </span>
                </div>
              ) : null}
            </div>
          )}

          {/* Performance & Physiological Metrics Grid */}
          {hasPerformanceMetrics && (
            <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-2.5 ${hasHeroMetrics ? 'pt-2.5 border-t border-white/5' : ''}`}>
              {/* Average Watts */}
              {currentAct.average_watts ? (
                <div className="bg-[#26272D]/80 p-2 sm:p-2.5 rounded-xl border border-white/5">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase block truncate">Potenza Media</span>
                  <span className="text-sm sm:text-base font-black text-white font-mono">{formatWatts(currentAct.average_watts)}</span>
                  {currentAct.weighted_average_watts && (
                    <span className="text-[10px] text-[#FC5200] font-semibold block truncate">
                      NP {Math.round(currentAct.weighted_average_watts)}W
                    </span>
                  )}
                </div>
              ) : null}

              {/* Speed / Pace */}
              {isRun && currentAct.average_speed ? (
                <div className="bg-[#26272D]/80 p-2 sm:p-2.5 rounded-xl border border-white/5">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase block truncate">Passo Medio</span>
                  <span className="text-sm sm:text-base font-black text-white font-mono">
                    {formatPace(currentAct.average_speed, useImperial)}
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate">
                    {formatSpeed(currentAct.average_speed, useImperial)}
                  </span>
                </div>
              ) : currentAct.average_speed ? (
                <div className="bg-[#26272D]/80 p-2 sm:p-2.5 rounded-xl border border-white/5">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase block truncate">Velocità Media</span>
                  <span className="text-sm sm:text-base font-black text-white font-mono">
                    {formatSpeed(currentAct.average_speed, useImperial)}
                  </span>
                  {currentAct.max_speed && (
                    <span className="text-[10px] text-slate-400 block truncate">
                      Max {formatSpeed(currentAct.max_speed, useImperial)}
                    </span>
                  )}
                </div>
              ) : null}

              {/* Heart Rate */}
              {currentAct.average_heartrate ? (
                <div className="bg-[#26272D]/80 p-2 sm:p-2.5 rounded-xl border border-white/5">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase block truncate">Battito Medio</span>
                  <span className="text-sm sm:text-base font-black text-white font-mono">
                    {formatHeartRate(currentAct.average_heartrate)}
                  </span>
                  {currentAct.max_heartrate && (
                    <span className="text-[10px] text-red-400 font-semibold block truncate">
                      Max {formatHeartRate(currentAct.max_heartrate)}
                    </span>
                  )}
                </div>
              ) : null}

              {/* Cadence */}
              {currentAct.icu_average_cadence ? (
                <div className="bg-[#26272D]/80 p-2 sm:p-2.5 rounded-xl border border-white/5">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase block truncate">Cadenza Media</span>
                  <span className="text-sm sm:text-base font-black text-white font-mono">
                    {Math.round(currentAct.icu_average_cadence)} <span className="text-[10px] font-normal text-slate-400">rpm</span>
                  </span>
                </div>
              ) : null}

              {/* Intensity Factor */}
              {currentAct.icu_intensity ? (
                <div className="bg-[#26272D]/80 p-2 sm:p-2.5 rounded-xl border border-white/5">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase block truncate">Intensity (IF)</span>
                  <span className="text-sm sm:text-base font-black text-[#FDD663] font-mono">
                    {(currentAct.icu_intensity > 2 ? currentAct.icu_intensity / 100 : currentAct.icu_intensity).toFixed(2)}
                  </span>
                </div>
              ) : null}

              {/* Energy kJ */}
              {currentAct.icu_joules ? (
                <div className="bg-[#26272D]/80 p-2 sm:p-2.5 rounded-xl border border-white/5">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase block truncate">Lavoro Speso</span>
                  <span className="text-sm sm:text-base font-black text-white font-mono">
                    {Math.round(currentAct.icu_joules / 1000)} <span className="text-[10px] font-normal text-slate-400">kJ</span>
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </section>
      )}

      {/* Recorded grandeurs over time: one chart per grandeur present */}
      {hasStreamCharts && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ActivityIcon className="w-4 h-4 text-[#00E5A3]" />
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-300">
              Andamento nel Tempo
            </h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {altitudeRows.length > 0 && (
              <ActivityStreamChart
                title="Altitudine"
                unit="m"
                color="#6DD58C"
                gradientId="streamAltitude"
                rows={altitudeRows}
                icon={<Mountain className="w-4 h-4 text-[#6DD58C]" />}
                onHoverPoint={setHoveredCoordinate}
              />
            )}
            {heartrateRows.length > 0 && (
              <ActivityStreamChart
                title="Frequenza Cardiaca"
                unit="bpm"
                color="#F28B82"
                gradientId="streamHeartrate"
                rows={heartrateRows}
                icon={<Heart className="w-4 h-4 text-[#F28B82]" />}
                onHoverPoint={setHoveredCoordinate}
              />
            )}
            {wattsRows.length > 0 && (
              <ActivityStreamChart
                title="Potenza"
                unit="W"
                color="#FC5200"
                gradientId="streamWatts"
                rows={wattsRows}
                icon={<Zap className="w-4 h-4 text-[#FC5200]" />}
                footnote="Filtro anti-dropout (≤ 10s): pause brevi interpolate, soste prolungate azzerate"
                onHoverPoint={setHoveredCoordinate}
              />
            )}
            {cadenceRows.length > 0 && (
              <ActivityStreamChart
                title="Cadenza"
                unit="rpm"
                color="#A8C7FA"
                gradientId="streamCadence"
                rows={cadenceRows}
                icon={<RotateCw className="w-4 h-4 text-[#A8C7FA]" />}
                footnote="Filtro anti-dropout (≤ 10s): pause brevi interpolate, soste prolungate azzerate"
                onHoverPoint={setHoveredCoordinate}
              />
            )}
            {speedRows.length > 0 && (
              <ActivityStreamChart
                title="Velocità"
                unit={useImperial ? 'mph' : 'km/h'}
                color="#38BDF8"
                gradientId="streamSpeed"
                rows={speedRows}
                decimals={1}
                icon={<Gauge className="w-4 h-4 text-[#38BDF8]" />}
                onHoverPoint={setHoveredCoordinate}
              />
            )}
          </div>

          {/* W'bal: only if data exists and criticalPower estimate is valid */}
          {wbalRows.length > 0 && criticalPower.status === 'ok' && (
            <ActivityStreamChart
              title="Riserva W′bal"
              unit="kJ"
              color="#A855F7"
              gradientId="streamWbal"
              rows={wbalRows}
              decimals={1}
              icon={<BatteryLow className="w-4 h-4 text-[#A855F7]" />}
              highlight={{ color: '#FC5200', label: 'Sotto un quarto della riserva' }}
              reference={{
                y: (criticalPower.estimate.wPrimeJoules * WBAL_LOW_FRACTION) / 1000,
                label: 'Un quarto',
                color: '#FC5200',
              }}
              footnote={`Calcolata con CP ${criticalPower.estimate.cpWatts} W e W′ ${(
                criticalPower.estimate.wPrimeJoules / 1000
              ).toFixed(1)} kJ, stimati dalla tua curva di potenza di Intervals.icu.`}
              onHoverPoint={setHoveredCoordinate}
            />
          )}
        </section>
      )}

      {/* Aerobic decoupling: only rendered if available and valid */}
      {series && decoupling.status === 'ok' && (
        <section className="bg-[#1F2025] border border-[#383941] p-5 sm:p-6 rounded-3xl space-y-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-[#FDD663]" />
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-300">
              Disaccoppiamento Aerobico
            </h3>
          </div>

          <div className="flex items-end gap-3 flex-wrap">
            <span
              className="text-3xl sm:text-4xl font-black"
              style={{
                color:
                  decoupling.percent > DECOUPLING_THRESHOLD_PERCENT ? '#FC5200' : '#00E5A3',
              }}
            >
              {decoupling.percent.toFixed(1)}%
            </span>
            <span className="text-[11px] text-slate-400 pb-1.5">
              su {formatDuration(Math.round(decoupling.durationSecs))} con potenza e battito
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'Prima metà', half: decoupling.first },
              { label: 'Seconda metà', half: decoupling.second },
            ].map((entry) => (
              <div
                key={entry.label}
                className="bg-[#26272D] p-3.5 rounded-2xl border border-white/5"
              >
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  {entry.label}
                </span>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-white font-black text-base">
                    {Math.round(entry.half.watts)}{' '}
                    <span className="text-[11px] font-semibold text-slate-400">W</span>
                  </span>
                  <span className="text-[#F28B82] font-black text-base">
                    {Math.round(entry.half.bpm)}{' '}
                    <span className="text-[11px] font-semibold text-slate-400">bpm</span>
                  </span>
                  <span className="text-[#FDD663] font-bold font-mono">
                    {entry.half.ratio.toFixed(2)} W/bpm
                  </span>
                </div>
              </div>
            ))}
          </div>

          {decoupling.percent > DECOUPLING_THRESHOLD_PERCENT && (
            <p className="text-xs text-[#FC5200] font-semibold bg-[#FC5200]/10 border border-[#FC5200]/20 rounded-2xl p-3">
              Oltre il 5 per cento: la tua resistenza aerobica non regge ancora questa durata.
              Nella seconda metà il battito è salito rispetto alla potenza.
            </p>
          )}

          <p className="text-[11px] text-slate-400">
            Rapporto fra potenza e battito nella prima e nella seconda metà
            dell&apos;uscita, calcolato sui dati registrati. Riferimento: sotto il 5 per cento.
          </p>
        </section>
      )}

      {/* Heart Rate & Power Zones Section: only rendered if data exists */}
      {(hasHrZones || hasPowerZones) && (
        <div className={`grid gap-6 ${hasHrZones && hasPowerZones ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* Heart Rate Zones */}
          {hasHrZones && (
            hrHistogram ? (
              <ZoneHistogramChart
                title="Tempo nelle Zone di Battito"
                histogram={hrHistogram}
                icon={<Heart className="w-4 h-4 text-red-500" />}
                footnote="Calcolato dall'app sulla serie del battito registrata, con le zone delle tue impostazioni."
              />
            ) : totalHrSecs > 0 ? (
              <div className="bg-[#1F2025] border border-[#383941] p-5 sm:p-6 rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-red-500" />
                    <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-300">
                      Distribuzione Zone Frequenza Cardiaca
                    </h3>
                  </div>
                </div>

                {/* Stacked bar */}
                <div className="flex h-3.5 rounded-full overflow-hidden bg-white/5 shadow-inner">
                  {hrZoneTimes.map((secs, idx) => {
                    const pct = (secs / totalHrSecs) * 100;
                    if (pct <= 0) return null;
                    const color = userHrZones[idx]?.color || defaultZoneColors[idx % defaultZoneColors.length];
                    return (
                      <div
                        key={idx}
                        style={{ width: `${pct}%`, backgroundColor: color }}
                        className="h-full transition-all"
                        title={`${formatDuration(secs)} (${Math.round(pct)}%)`}
                      />
                    );
                  })}
                </div>

                {/* Rows */}
                <div className="space-y-2 text-xs">
                  {hrZoneTimes.map((secs, idx) => {
                    const pct = (secs / totalHrSecs) * 100;
                    const userZ = userHrZones[idx];
                    const label = userZ?.name || defaultZoneLabels[idx] || `Zona ${idx + 1}`;
                    const color = userZ?.color || defaultZoneColors[idx % defaultZoneColors.length];
                    const bpmRange = userZ
                      ? `${userZ.minBpm}-${userZ.maxBpm} bpm`
                      : currentAct.icu_hr_zones && currentAct.icu_hr_zones[idx]
                      ? `< ${currentAct.icu_hr_zones[idx]} bpm`
                      : '';

                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: color }} />
                          <span className="text-slate-200 font-semibold">{label}</span>
                          {bpmRange && <span className="text-[10px] text-slate-400 font-mono">({bpmRange})</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400 font-mono">{formatDuration(secs)}</span>
                          <span className="font-bold text-white w-9 text-right font-mono">{Math.round(pct)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : currentAct.average_heartrate ? (
              <div className="bg-[#1F2025] border border-[#383941] p-5 sm:p-6 rounded-3xl space-y-4">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-red-500" />
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-300">
                    Frequenza Cardiaca
                  </h3>
                </div>
                <div className="bg-[#26272D] p-4 rounded-2xl border border-white/5 text-xs text-slate-400 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-red-500" />
                    <span>Media Registrata: <strong className="text-white">{currentAct.average_heartrate} bpm</strong></span>
                  </div>
                  <span className="text-[11px] text-slate-400">Distribuzione streaming non presente</span>
                </div>
              </div>
            ) : null
          )}

          {/* Power Zones */}
          {hasPowerZones && (
            powerHistogram ? (
              <ZoneHistogramChart
                title="Tempo nelle Zone di Potenza"
                histogram={powerHistogram}
                icon={<Zap className="w-4 h-4 text-[#FC5200]" />}
                footnote={`Calcolato dall'app sulla serie della potenza registrata, con le zone sul tuo FTP di ${settings?.ftp ?? '--'} W delle impostazioni.`}
              />
            ) : totalPowerSecs > 0 ? (
              <div className="bg-[#1F2025] border border-[#383941] p-5 sm:p-6 rounded-3xl space-y-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#FC5200]" />
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-300">
                    Distribuzione Zone di Potenza
                  </h3>
                </div>

                {/* Stacked bar */}
                <div className="flex h-3.5 rounded-full overflow-hidden bg-white/5 shadow-inner">
                  {powerZoneTimes.map((secs, idx) => {
                    const pct = (secs / totalPowerSecs) * 100;
                    if (pct <= 0) return null;
                    const colors = ['#94A3B8', '#38BDF8', '#4ADE80', '#FACC15', '#FB923C', '#F87171', '#C084FC'];
                    return (
                      <div
                        key={idx}
                        style={{ width: `${pct}%`, backgroundColor: colors[idx % colors.length] }}
                        className="h-full transition-all"
                        title={`${formatDuration(secs)} (${Math.round(pct)}%)`}
                      />
                    );
                  })}
                </div>

                {/* Rows */}
                <div className="space-y-1.5 text-xs">
                  {powerZoneTimes.map((secs, idx) => {
                    const pct = (secs / totalPowerSecs) * 100;
                    const powerNames = [
                      'Z1 Recupero Attivo',
                      'Z2 Fondo / Resistenza',
                      'Z3 Medio / Tempo',
                      'Z4 Soglia Funzionale',
                      'Z5 VO2 Max',
                      'Z6 Capacità Anaerobica',
                      'Z7 Neuromuscolare',
                    ];
                    const colors = ['#94A3B8', '#38BDF8', '#4ADE80', '#FACC15', '#FB923C', '#F87171', '#C084FC'];
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: colors[idx % colors.length] }} />
                          <span className="text-slate-200 font-semibold">{powerNames[idx] || `Zona ${idx + 1}`}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400 font-mono">{formatDuration(secs)}</span>
                          <span className="font-bold text-white w-9 text-right font-mono">{Math.round(pct)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null
          )}
        </div>
      )}

      {/* Interval Repeats Table */}
      {currentAct.intervals && currentAct.intervals.length > 0 && (
        <section className="bg-[#1F2025] border border-[#383941] p-5 sm:p-6 rounded-3xl space-y-4">
          <div className="flex items-center gap-2">
            <Repeat className="w-4 h-4 text-[#00E5A3]" />
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-300">
              Ripetute & Intervalli Strutturati ({currentAct.intervals.length})
            </h3>
          </div>

          <div className="divide-y divide-white/5 text-xs overflow-x-auto">
            {currentAct.intervals.map((int, idx) => (
              <div key={int.id || idx} className="py-3 flex items-center justify-between min-w-[360px]">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-black tracking-wide ${
                      int.type === 'RECOVERY'
                        ? 'bg-white/5 text-slate-400 border border-white/5'
                        : 'bg-[#00E5A3]/10 text-[#00E5A3] border border-[#00E5A3]/20'
                    }`}
                  >
                    {int.type || `Intervallo ${idx + 1}`}
                  </span>
                  <span className="text-white font-bold text-sm">
                    {formatDuration(int.moving_time || int.elapsed_time || 0)}
                  </span>
                </div>

                <div className="flex items-center gap-5 text-right">
                  {int.average_watts && (
                    <div>
                      <span className="font-black text-white text-sm">{Math.round(int.average_watts)}W</span>
                      <span className="text-[10px] text-slate-400 block">Potenza Media</span>
                    </div>
                  )}
                  {int.average_heartrate && (
                    <div>
                      <span className="font-black text-red-400 text-sm">{Math.round(int.average_heartrate)} bpm</span>
                      <span className="text-[10px] text-slate-400 block">Cardio Medio</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Athlete Notes & Feelings */}
      {(currentAct.description || currentAct.rpe || currentAct.feel) && (
        <section className="bg-[#1F2025] border border-[#383941] p-5 sm:p-6 rounded-3xl space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-300">
              Note Atleta & Percezione dello Sforzo
            </h3>
          </div>

          {currentAct.description && (
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap bg-[#26272D] p-4 rounded-2xl border border-white/5">
              {currentAct.description}
            </p>
          )}

          <div className="flex items-center gap-6 pt-1 text-xs">
            {currentAct.rpe && (
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px] block mb-0.5">Sforzo Percepito (RPE)</span>
                <span className="text-white font-black text-base">{currentAct.rpe} / 10</span>
              </div>
            )}
            {currentAct.feel && (
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px] block mb-0.5">Sensazione</span>
                <span className="text-[#00E5A3] font-bold text-base">
                  {currentAct.feel === 5 ? 'Ottima ⚡' : currentAct.feel === 4 ? 'Buona 👍' : 'Normale'}
                </span>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
