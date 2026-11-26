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
import { getDemoActivityStreams } from '../../services/intervals/mockStreams';
import {
  cacheActivityStreamsLocally,
  isLocalVeloPulseActivity,
  loadCachedActivityStreams,
} from '../../services/localWorkouts';
import { saveActivityStreamsToDatabase } from '../../services/supabase/database';
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
  trimStationaryPauses,
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
  'no-curve': 'No power curve was returned for this athlete.',
  'durations-missing':
    'your power curve needs at least two efforts between 2 and 20 minutes.',
  'durations-too-close': 'the durations in your power curve are too close together.',
  'model-not-applicable':
    'your power curve between 2 and 20 minutes does not fit the critical power model.',
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
  returnTabName = 'Activities',
  useImperial = false,
  settings,
}) => {
  const { credentials, powerCurve, isSupabaseMode, authUser } = useApp();
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
  // Synchronized drag-to-zoom time window [startSec, endSec] across all telemetry charts & map
  const [selectedTimeRange, setSelectedTimeRange] = useState<[number, number] | null>(null);
  // Fixed/sticky map mode while scrolling graphs; can be dismissed with 'X'
  const [isMapPinned, setIsMapPinned] = useState(true);
  const [isMapClosed, setIsMapClosed] = useState(false);

  // Keyboard shortcut: Escape to go back (only when no enlarged chart modal is open)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[data-chart-modal="true"]')) {
        onBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  // Fetch full details and streams from Intervals.icu if available
  useEffect(() => {
    setDetailedActivity(activity);
    setStreamsError(null);
    setSeries(null);
    setSelectedTimeRange(null);
    if (!activity) return;

    // Check embedded DB streams or locally cached streams first (instant & works offline forever)
    const persistedStreams =
      (activity.velopulse_streams && activity.velopulse_streams.length > 0
        ? activity.velopulse_streams
        : null) || loadCachedActivityStreams(activity.id);

    if (persistedStreams) {
      setSeries(readActivitySeries(persistedStreams));
      const track = latlngStreamToCoordinates(
        persistedStreams.find((stream) => stream.type === 'latlng')
      );
      if (track.length > 1) {
        setDetailedActivity((prev) => ({ ...prev, icu_latlng: track }));
      }
      if (isLocalVeloPulseActivity(activity.id)) {
        return;
      }
    }

    if (credentials && !credentials.isDemo && activity.id) {
      if (!persistedStreams) setIsLoadingDetails(true);
      Promise.all([
        getActivityDetails(credentials.apiKey, activity.id).catch(() => null),
        // One single call for every series the page needs: the track for the map
        // and the four grandeurs of the charts over time.
        // getActivityStreams never rejects: a failure arrives as status 'failed'.
        getActivityStreams(credentials.apiKey, activity.id, [...ACTIVITY_STREAM_TYPES]),
      ])
        .then(([full, streams]) => {
          if (streams.status === 'ok' && streams.streams.length > 0) {
            setStreamsError(null);
            setSeries(readActivitySeries(streams.streams));
            // Persist fetched streams forever in local cache + Supabase DB
            cacheActivityStreamsLocally(activity.id, streams.streams);
            if (isSupabaseMode && authUser) {
              saveActivityStreamsToDatabase(authUser.id, activity.id, streams.streams).catch(
                () => {}
              );
            }
          } else if (!persistedStreams) {
            setStreamsError(streams.status === 'failed' ? streams.reason : null);
          }
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
      return;
    }

    // Demo login: the app never calls Intervals.icu, but the one demo ride
    // that carries streams (RF-014) runs through the very same
    // readActivitySeries and latlngStreamToCoordinates as a real key, so its
    // charts, histograms, W'bal and decoupling are never a special case.
    // Every other demo activity has no streams, and streamsUnavailableReason
    // below keeps explaining why.
    if (credentials && credentials.isDemo && activity.id) {
      const demoStreams = getDemoActivityStreams(activity.id);
      if (demoStreams) {
        setSeries(readActivitySeries(demoStreams));
        setDetailedActivity((prev) => {
          const track = latlngStreamToCoordinates(
            demoStreams.find((stream) => stream.type === 'latlng')
          );
          return track.length > 1 ? { ...prev, icu_latlng: track } : prev;
        });
      }
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

  // Clean series for charts & map sync: cuts prolonged zero-speed pauses (>= 15s)
  // and compresses elapsed-time gaps into continuous moving time
  const displaySeries = useMemo(
    () => (series ? trimStationaryPauses(series) : null),
    [series]
  );

  // Use exact 1:1 sample-aligned GPS coordinates from the `latlng` stream when present;
  // fall back to route interpolation only when only a summary polyline is available.
  const fullLatlngSeries = useMemo<([number, number] | null)[] | null>(() => {
    if (!displaySeries?.timeSecs || displaySeries.timeSecs.length === 0) return null;
    if (displaySeries.latlng && displaySeries.latlng.length === displaySeries.timeSecs.length) {
      return displaySeries.latlng;
    }
    if (route.length === 0) return null;
    const timeSecs = displaySeries.timeSecs;
    const totalTime = Math.max(1, timeSecs[timeSecs.length - 1] - timeSecs[0]);
    const routeLen = route.length;

    return timeSecs.map((t) => {
      const progress = Math.min(1, Math.max(0, (t - timeSecs[0]) / totalTime));
      const idx = Math.min(routeLen - 1, Math.max(0, Math.round(progress * (routeLen - 1))));
      return route[idx] || null;
    });
  }, [displaySeries, route]);

  // Power & cadence series filtered for micro-dropouts / momentary stops (<= 10 seconds)
  const smoothedWatts = useMemo(
    () => (displaySeries?.watts ? smoothShortDropouts(displaySeries.timeSecs, displaySeries.watts) : null),
    [displaySeries]
  );
  const smoothedCadence = useMemo(
    () => (displaySeries?.cadence ? smoothShortDropouts(displaySeries.timeSecs, displaySeries.cadence) : null),
    [displaySeries]
  );

  // Active index slice when user drags a [startSec, endSec] selection on any chart
  const zoomSlice = useMemo(() => {
    if (!displaySeries?.timeSecs || displaySeries.timeSecs.length === 0) return null;
    if (!selectedTimeRange) {
      return { startIdx: 0, endIdx: displaySeries.timeSecs.length - 1, isZoomed: false };
    }
    const [startT, endT] = selectedTimeRange;
    const times = displaySeries.timeSecs;
    let startIdx = 0;
    while (startIdx < times.length - 1 && times[startIdx] < startT) startIdx++;
    let endIdx = times.length - 1;
    while (endIdx > startIdx && times[endIdx] > endT) endIdx--;
    if (endIdx - startIdx < 1) {
      return { startIdx: 0, endIdx: times.length - 1, isZoomed: false };
    }
    return { startIdx, endIdx, isZoomed: true };
  }, [displaySeries?.timeSecs, selectedTimeRange]);

  const activeTimeSecs = useMemo(
    () => (displaySeries?.timeSecs && zoomSlice ? displaySeries.timeSecs.slice(zoomSlice.startIdx, zoomSlice.endIdx + 1) : []),
    [displaySeries?.timeSecs, zoomSlice]
  );
  const activeAltitude = useMemo(
    () => (displaySeries?.altitude && zoomSlice ? displaySeries.altitude.slice(zoomSlice.startIdx, zoomSlice.endIdx + 1) : null),
    [displaySeries?.altitude, zoomSlice]
  );
  const activeLatlng = useMemo(
    () => (fullLatlngSeries && zoomSlice ? fullLatlngSeries.slice(zoomSlice.startIdx, zoomSlice.endIdx + 1) : null),
    [fullLatlngSeries, zoomSlice]
  );

  // Highlighted GPS segment for the map between the 2 selected points
  const highlightedSegment = useMemo<[number, number][] | null>(() => {
    if (!zoomSlice?.isZoomed || !activeLatlng) return null;
    const pts = activeLatlng.filter((p): p is [number, number] => p !== null && isFinite(p[0]) && isFinite(p[1]));
    return pts.length >= 2 ? pts : null;
  }, [zoomSlice?.isZoomed, activeLatlng]);

  // Quick summary averages for the selected segment
  const selectionStats = useMemo(() => {
    if (!zoomSlice?.isZoomed || !displaySeries || activeTimeSecs.length < 2) return null;
    const { startIdx, endIdx } = zoomSlice;
    const avgOf = (arr: (number | null)[] | null | undefined) => {
      if (!arr) return null;
      let sum = 0;
      let count = 0;
      for (let i = startIdx; i <= endIdx; i++) {
        const v = arr[i];
        if (v !== null && v !== undefined && Number.isFinite(v)) {
          sum += v;
          count++;
        }
      }
      return count > 0 ? sum / count : null;
    };
    const startSec = activeTimeSecs[0];
    const endSec = activeTimeSecs[activeTimeSecs.length - 1];
    return {
      startSec,
      endSec,
      durationSecs: Math.max(0, endSec - startSec),
      avgWatts: avgOf(smoothedWatts),
      avgHr: avgOf(displaySeries.heartrate),
      avgSpeed: avgOf(displaySeries.speed),
    };
  }, [zoomSlice, displaySeries, activeTimeSecs, smoothedWatts]);

  // Charts over time: sliced to zoom window BEFORE thinning so zooming reveals full resolution!
  const altitudeRows = useMemo<StreamChartRow[]>(
    () =>
      activeAltitude && activeTimeSecs.length > 0
        ? thinSeriesForChart(activeTimeSecs, activeAltitude, MAX_CHART_POINTS, null, activeLatlng)
        : [],
    [activeTimeSecs, activeAltitude, activeLatlng]
  );
  const heartrateRows = useMemo<StreamChartRow[]>(
    () =>
      displaySeries?.heartrate && zoomSlice && activeTimeSecs.length > 0
        ? thinSeriesForChart(
            activeTimeSecs,
            displaySeries.heartrate.slice(zoomSlice.startIdx, zoomSlice.endIdx + 1),
            MAX_CHART_POINTS,
            activeAltitude,
            activeLatlng
          )
        : [],
    [displaySeries?.heartrate, zoomSlice, activeTimeSecs, activeAltitude, activeLatlng]
  );
  const wattsRows = useMemo<StreamChartRow[]>(
    () =>
      smoothedWatts && zoomSlice && activeTimeSecs.length > 0
        ? thinSeriesForChart(
            activeTimeSecs,
            smoothedWatts.slice(zoomSlice.startIdx, zoomSlice.endIdx + 1),
            MAX_CHART_POINTS,
            activeAltitude,
            activeLatlng
          )
        : [],
    [smoothedWatts, zoomSlice, activeTimeSecs, activeAltitude, activeLatlng]
  );
  const cadenceRows = useMemo<StreamChartRow[]>(
    () =>
      smoothedCadence && zoomSlice && activeTimeSecs.length > 0
        ? thinSeriesForChart(
            activeTimeSecs,
            smoothedCadence.slice(zoomSlice.startIdx, zoomSlice.endIdx + 1),
            MAX_CHART_POINTS,
            activeAltitude,
            activeLatlng
          )
        : [],
    [smoothedCadence, zoomSlice, activeTimeSecs, activeAltitude, activeLatlng]
  );
  const speedRows = useMemo<StreamChartRow[]>(() => {
    if (!displaySeries?.speed || !zoomSlice || activeTimeSecs.length === 0) return [];
    const sliced = displaySeries.speed.slice(zoomSlice.startIdx, zoomSlice.endIdx + 1);
    const values = useImperial
      ? sliced.map((v) => (v !== null ? v * 0.621371 : null))
      : sliced;
    return thinSeriesForChart(activeTimeSecs, values, MAX_CHART_POINTS, activeAltitude, activeLatlng);
  }, [displaySeries?.speed, zoomSlice, activeTimeSecs, useImperial, activeAltitude, activeLatlng]);

  const hasStreamCharts =
    altitudeRows.length > 0 ||
    heartrateRows.length > 0 ||
    wattsRows.length > 0 ||
    cadenceRows.length > 0 ||
    speedRows.length > 0;

  // Why there is no recorded data. null when there is series data to show:
  // either a real answer from Intervals.icu, or the one demo ride that
  // carries streams (RF-014). An activity without an Intervals.icu id and a
  // call that really failed are told apart from the demo login.
  const streamsUnavailableReason =
    series !== null
      ? null
      : streamsError ??
        (credentials && credentials.isDemo
          ? 'Demo mode is not connected to a live account: this activity has no recorded telemetry streams.'
          : !credentials
          ? 'Not connected to a live account, so recorded telemetry streams cannot be loaded.'
          : !currentAct.id
          ? 'This activity has no remote ID, so recorded streams cannot be fetched.'
          : 'No recorded telemetry streams are available for this activity.');

  // CP and W' estimated on the power curve the app already downloaded.
  const criticalPower = useMemo<CriticalPowerResult>(() => {
    const curve = powerCurve.recent ?? powerCurve.season;
    return estimateCriticalPower(curve?.samples ?? null, curve?.label ?? '');
  }, [powerCurve]);

  // W'bal: computed on the full power series, then thinned for drawing. `low`
  // repeats the value only under a quarter of the full reserve, so that stretch
  // stands out.
  const wbalRows = useMemo<StreamChartRow[]>(() => {
    if (!displaySeries?.watts || criticalPower.status !== 'ok') return [];
    const { cpWatts, wPrimeJoules } = criticalPower.estimate;
    const points = computeWbalSeries(
      displaySeries.timeSecs,
      displaySeries.watts,
      cpWatts,
      wPrimeJoules,
      displaySeries.intervalSecs
    );
    if (points.length === 0) return [];

    const startIdx = zoomSlice?.isZoomed ? zoomSlice.startIdx : 0;
    const endIdx = zoomSlice?.isZoomed ? Math.min(points.length - 1, zoomSlice.endIdx) : points.length - 1;
    const sliceLen = Math.max(1, endIdx - startIdx + 1);
    const lowJoules = wPrimeJoules * WBAL_LOW_FRACTION;
    const step = Math.max(1, Math.ceil(sliceLen / MAX_CHART_POINTS));
    const rows: StreamChartRow[] = [];
    const add = (index: number) => {
      const point = points[index];
      const kilojoules = point.joules === null ? null : point.joules / 1000;
      rows.push({
        t: point.t,
        v: kilojoules,
        low: point.joules !== null && point.joules < lowJoules ? kilojoules : null,
        alt: displaySeries.altitude && displaySeries.altitude[index] !== undefined ? displaySeries.altitude[index] : null,
        latlng: fullLatlngSeries && fullLatlngSeries[index] ? fullLatlngSeries[index] : null,
      });
    };
    for (let i = startIdx; i <= endIdx; i += step) add(i);
    if (rows.length > 0 && rows[rows.length - 1].t !== points[endIdx].t) add(endIdx);
    return rows;
  }, [displaySeries, criticalPower, fullLatlngSeries, zoomSlice]);

  const wbalMissingReason = !series?.watts
    ? 'Power stream missing: no power data was recorded for this activity.'
    : criticalPower.status !== 'ok'
    ? `CP estimate unavailable: ${CP_UNAVAILABLE_TEXT[criticalPower.reason]}`
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
    ? 'Computed histogram unavailable: no power stream was recorded for this activity.'
    : 'Computed histogram unavailable: set your FTP in settings to compute power zones.';
  const hrHistogramMissingNote = hrHistogram
    ? null
    : !series?.heartrate
    ? 'Computed histogram unavailable: no heart rate stream was recorded for this activity.'
    : 'Computed histogram unavailable: configure your heart rate zones in settings.';

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
    'Z1 Active Recovery',
    'Z2 Endurance / Aerobic',
    'Z3 Tempo',
    'Z4 Lactate Threshold',
    'Z5 VO2 Max',
    'Z6 Anaerobic Capacity',
    'Z7 Neuromuscular',
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
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* Top Header / Breadcrumb Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="group flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 text-slate-300 hover:text-white transition-all text-xs font-bold"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#00E5A3] group-hover:-translate-x-0.5 transition-transform" />
            <span>{returnTabName}</span>
          </button>

          <div className="h-6 w-[1px] bg-white/10 hidden sm:block" />

          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-[#00E5A3]/10 flex items-center justify-center text-[#00E5A3]">
              {isRide ? <Bike className="w-5 h-5" /> : isRun ? <Footprints className="w-5 h-5" /> : <Waves className="w-5 h-5" />}
            </span>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                <span className="uppercase tracking-[0.12em] text-[#00E5A3] font-bold text-[11px]">
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
      </div>

      {/* Main 2-Column Layout: Left = Map + Compact Metrics + HR/Power Zones, Right = Telemetry Charts */}
      {(hasRoute || hasHeroMetrics || hasPerformanceMetrics || hasHrZones || hasPowerZones || hasStreamCharts || (series && decoupling.status === 'ok')) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Map + Compact Key Metrics + HR & Power Zones underneath */}
          {(hasRoute || hasHeroMetrics || hasPerformanceMetrics || hasHrZones || hasPowerZones) && (
            <div className="lg:col-span-5 space-y-6">
              {/* Interactive GPS Map */}
              {hasRoute && (
                <section>
                  <ActivityMap
                    activity={currentAct}
                    coordinates={route}
                    useImperial={useImperial}
                    cartoApiKey={settings?.cartoApiKey}
                    hoveredCoordinate={hoveredCoordinate}
                    highlightedSegment={highlightedSegment}
                  />
                </section>
              )}

              {/* Card-Free Key Metrics Grid */}
              {(hasHeroMetrics || hasPerformanceMetrics) && (
                <section className="py-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-5">
                    {currentAct.distance ? (
                      <div className="pl-3 border-l-2 border-[#00E5A3]/70">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                          Distance
                        </span>
                        <span className="text-base font-black text-white font-mono tabular-nums">
                          {formatDistance(currentAct.distance, useImperial)}
                        </span>
                      </div>
                    ) : null}

                    {(currentAct.moving_time || currentAct.elapsed_time) ? (
                      <div className="pl-3 border-l-2 border-white/25">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                          Duration
                        </span>
                        <span className="text-base font-black text-white font-mono tabular-nums">
                          {formatDuration(currentAct.moving_time || currentAct.elapsed_time)}
                        </span>
                      </div>
                    ) : null}

                    {currentAct.total_elevation_gain ? (
                      <div className="pl-3 border-l-2 border-[#6DD58C]/70">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                          Elevation
                        </span>
                        <span className="text-base font-black text-[#6DD58C] font-mono tabular-nums">
                          {formatElevation(currentAct.total_elevation_gain, useImperial)}
                        </span>
                      </div>
                    ) : null}

                    {currentAct.icu_training_load !== undefined && currentAct.icu_training_load !== null ? (
                      <div className="pl-3 border-l-2 border-[#FC5200]/70">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                          Load (TSS)
                        </span>
                        <span className="text-base font-black text-[#FC5200] font-mono tabular-nums">
                          {Math.round(currentAct.icu_training_load)}
                        </span>
                      </div>
                    ) : null}

                    {currentAct.average_watts ? (
                      <div className="pl-3 border-l-2 border-[#FC5200]/50">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block truncate">
                          Avg Power
                        </span>
                        <span className="text-base font-black text-white font-mono tabular-nums">
                          {formatWatts(currentAct.average_watts)}
                        </span>
                        {currentAct.weighted_average_watts ? (
                          <span className="text-[10px] text-[#FC5200] font-semibold ml-1.5">
                            NP {Math.round(currentAct.weighted_average_watts)}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    {isRun && currentAct.average_speed ? (
                      <div className="pl-3 border-l-2 border-[#38BDF8]/70">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block truncate">
                          Avg Pace
                        </span>
                        <span className="text-base font-black text-white font-mono tabular-nums">
                          {formatPace(currentAct.average_speed, useImperial)}
                        </span>
                      </div>
                    ) : currentAct.average_speed ? (
                      <div className="pl-3 border-l-2 border-[#38BDF8]/70">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block truncate">
                          Avg Speed
                        </span>
                        <span className="text-base font-black text-white font-mono tabular-nums">
                          {formatSpeed(currentAct.average_speed, useImperial)}
                        </span>
                      </div>
                    ) : null}

                    {currentAct.average_heartrate ? (
                      <div className="pl-3 border-l-2 border-red-400/70">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block truncate">
                          Avg HR
                        </span>
                        <span className="text-base font-black text-white font-mono tabular-nums">
                          {formatHeartRate(currentAct.average_heartrate)}
                        </span>
                        {currentAct.max_heartrate ? (
                          <span className="text-[10px] text-red-400 font-semibold ml-1.5">
                            Max {Math.round(currentAct.max_heartrate)}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    {currentAct.icu_average_cadence ? (
                      <div className="pl-3 border-l-2 border-[#A8C7FA]/60">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block truncate">
                          Cadence
                        </span>
                        <span className="text-base font-black text-white font-mono tabular-nums">
                          {Math.round(currentAct.icu_average_cadence)} <span className="text-[10px] font-normal text-slate-400">rpm</span>
                        </span>
                      </div>
                    ) : null}

                    {currentAct.icu_intensity ? (
                      <div className="pl-3 border-l-2 border-[#FDD663]/70">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block truncate">
                          IF
                        </span>
                        <span className="text-base font-black text-[#FDD663] font-mono tabular-nums">
                          {(currentAct.icu_intensity > 2 ? currentAct.icu_intensity / 100 : currentAct.icu_intensity).toFixed(2)}
                        </span>
                      </div>
                    ) : null}

                    {currentAct.icu_joules ? (
                      <div className="pl-3 border-l-2 border-white/20">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block truncate">
                          Work
                        </span>
                        <span className="text-base font-black text-white font-mono tabular-nums">
                          {Math.round(currentAct.icu_joules / 1000)} <span className="text-[10px] font-normal text-slate-400">kJ</span>
                        </span>
                      </div>
                    ) : null}
                  </div>
                </section>
              )}

              {/* Heart Rate Zones (below map) */}
              {hasHrZones && (
                hrHistogram ? (
                  <ZoneHistogramChart
                    title="Heart Rate Zones"
                    histogram={hrHistogram}
                    icon={<Heart className="w-4 h-4 text-red-500" />}
                    footnote="Computed from the recorded heart rate stream using your configured zones."
                  />
                ) : totalHrSecs > 0 ? (
                  <div className="py-5 border-t border-white/10 space-y-4">
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-red-500" />
                      <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-200">
                        Heart Rate Zones
                      </h3>
                    </div>

                    <div className="flex h-3 rounded-full overflow-hidden bg-white/5">
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
                  <div className="py-5 border-t border-white/10 space-y-3">
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-red-500" />
                      <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-200">
                        Heart Rate
                      </h3>
                    </div>
                    <div className="pl-3.5 border-l-2 border-red-400/60 py-1 text-xs text-slate-400 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Heart className="w-4 h-4 text-red-500" />
                        <span>Recorded Avg: <strong className="text-white">{currentAct.average_heartrate} bpm</strong></span>
                      </div>
                      <span className="text-[11px] text-slate-500">Zone distribution unavailable</span>
                    </div>
                  </div>
                ) : null
              )}

              {/* Power Zones (below HR zones) */}
              {hasPowerZones && (
                powerHistogram ? (
                  <ZoneHistogramChart
                    title="Power Zones"
                    histogram={powerHistogram}
                    icon={<Zap className="w-4 h-4 text-[#FC5200]" />}
                    footnote={`Computed from the recorded power stream using your ${settings?.ftp ?? '--'} W FTP.`}
                  />
                ) : totalPowerSecs > 0 ? (
                  <div className="py-5 border-t border-white/10 space-y-4">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[#FC5200]" />
                      <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-200">
                        Power Zones
                      </h3>
                    </div>

                    <div className="flex h-3 rounded-full overflow-hidden bg-white/5">
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

                    <div className="space-y-1.5 text-xs">
                      {powerZoneTimes.map((secs, idx) => {
                        const pct = (secs / totalPowerSecs) * 100;
                        const powerNames = [
                          'Z1 Active Recovery',
                          'Z2 Endurance',
                          'Z3 Tempo',
                          'Z4 Threshold',
                          'Z5 VO2 Max',
                          'Z6 Anaerobic Capacity',
                          'Z7 Neuromuscular',
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

          {/* RIGHT COLUMN: Telemetry Charts Over Time + Aerobic Decoupling */}
          <div className={`${hasRoute || hasHeroMetrics || hasPerformanceMetrics || hasHrZones || hasPowerZones ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-6`}>
            {hasStreamCharts && (
              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10 flex-wrap">
                  <div className="flex items-center gap-2">
                    <ActivityIcon className="w-4 h-4 text-[#00E5A3]" />
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#00E5A3]">
                      Telemetry Over Time
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {selectionStats
                      ? 'Double-click any chart to reset zoom'
                      : 'Click & drag on any chart to zoom a segment'}
                  </span>
                </div>

                {selectionStats && (
                  <div className="py-3 pl-3.5 border-l-2 border-[#FC5200] flex items-center justify-between gap-4 flex-wrap text-xs">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#FC5200] block">
                          Selected Segment (A → B)
                        </span>
                        <span className="font-mono font-bold text-white">
                          {formatDuration(Math.round(selectionStats.startSec))} – {formatDuration(Math.round(selectionStats.endSec))}{' '}
                          <span className="text-slate-400">({formatDuration(Math.round(selectionStats.durationSecs))})</span>
                        </span>
                      </div>
                      {selectionStats.avgWatts !== null && (
                        <span className="font-mono font-bold text-[#FC5200]">
                          {Math.round(selectionStats.avgWatts)} W
                        </span>
                      )}
                      {selectionStats.avgHr !== null && (
                        <span className="font-mono font-bold text-[#F28B82]">
                          {Math.round(selectionStats.avgHr)} bpm
                        </span>
                      )}
                      {selectionStats.avgSpeed !== null && (
                        <span className="font-mono font-bold text-[#38BDF8]">
                          {(useImperial ? selectionStats.avgSpeed * 0.621371 : selectionStats.avgSpeed).toFixed(1)}{' '}
                          {useImperial ? 'mph' : 'km/h'}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedTimeRange(null)}
                      className="px-3 py-1 rounded-full bg-[#FC5200]/15 hover:bg-[#FC5200]/25 text-[#FC5200] font-bold text-[11px] transition-colors cursor-pointer"
                    >
                      Reset Zoom
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1">
                  {altitudeRows.length > 0 && (
                    <ActivityStreamChart
                      title="Altitude"
                      unit="m"
                      color="#6DD58C"
                      gradientId="streamAltitude"
                      rows={altitudeRows}
                      icon={<Mountain className="w-4 h-4 text-[#6DD58C]" />}
                      onHoverPoint={setHoveredCoordinate}
                      onSelectRange={setSelectedTimeRange}
                      onResetRange={() => setSelectedTimeRange(null)}
                    />
                  )}
                  {heartrateRows.length > 0 && (
                    <ActivityStreamChart
                      title="Heart Rate"
                      unit="bpm"
                      color="#F28B82"
                      gradientId="streamHeartrate"
                      rows={heartrateRows}
                      icon={<Heart className="w-4 h-4 text-[#F28B82]" />}
                      onHoverPoint={setHoveredCoordinate}
                      onSelectRange={setSelectedTimeRange}
                      onResetRange={() => setSelectedTimeRange(null)}
                    />
                  )}
                  {wattsRows.length > 0 && (
                    <ActivityStreamChart
                      title="Power"
                      unit="W"
                      color="#FC5200"
                      gradientId="streamWatts"
                      rows={wattsRows}
                      icon={<Zap className="w-4 h-4 text-[#FC5200]" />}
                      footnote="Short dropout filter (≤ 10s): brief drops smoothed, extended stops remain at 0"
                      onHoverPoint={setHoveredCoordinate}
                      onSelectRange={setSelectedTimeRange}
                      onResetRange={() => setSelectedTimeRange(null)}
                    />
                  )}
                  {cadenceRows.length > 0 && (
                    <ActivityStreamChart
                      title="Cadence"
                      unit="rpm"
                      color="#A8C7FA"
                      gradientId="streamCadence"
                      rows={cadenceRows}
                      icon={<RotateCw className="w-4 h-4 text-[#A8C7FA]" />}
                      footnote="Short dropout filter (≤ 10s): brief drops smoothed, extended stops remain at 0"
                      onHoverPoint={setHoveredCoordinate}
                      onSelectRange={setSelectedTimeRange}
                      onResetRange={() => setSelectedTimeRange(null)}
                    />
                  )}
                  {speedRows.length > 0 && (
                    <ActivityStreamChart
                      title="Speed"
                      unit={useImperial ? 'mph' : 'km/h'}
                      color="#38BDF8"
                      gradientId="streamSpeed"
                      rows={speedRows}
                      decimals={1}
                      icon={<Gauge className="w-4 h-4 text-[#38BDF8]" />}
                      onHoverPoint={setHoveredCoordinate}
                      onSelectRange={setSelectedTimeRange}
                      onResetRange={() => setSelectedTimeRange(null)}
                    />
                  )}
                  {wbalRows.length > 0 && criticalPower.status === 'ok' && (
                    <ActivityStreamChart
                      title="W′bal Reserve"
                      unit="kJ"
                      color="#A855F7"
                      gradientId="streamWbal"
                      rows={wbalRows}
                      decimals={1}
                      icon={<BatteryLow className="w-4 h-4 text-[#A855F7]" />}
                      highlight={{ color: '#FC5200', label: 'Below 25% reserve' }}
                      reference={{
                        y: (criticalPower.estimate.wPrimeJoules * WBAL_LOW_FRACTION) / 1000,
                        label: '25%',
                        color: '#FC5200',
                      }}
                      footnote={`Computed with CP ${criticalPower.estimate.cpWatts} W and W′ ${(
                        criticalPower.estimate.wPrimeJoules / 1000
                      ).toFixed(1)} kJ estimated from your Intervals.icu power curve.`}
                      onHoverPoint={setHoveredCoordinate}
                      onSelectRange={setSelectedTimeRange}
                      onResetRange={() => setSelectedTimeRange(null)}
                    />
                  )}
                </div>
              </section>
            )}

            {/* Aerobic decoupling: only rendered if available and valid */}
            {series && decoupling.status === 'ok' && (
              <section className="pt-6 border-t border-white/10 space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-[#FDD663]" />
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#FDD663]">
                    Aerobic Decoupling
                  </h3>
                </div>

                <div className="flex items-end gap-3 flex-wrap">
                  <span
                    className="text-3xl sm:text-4xl font-black tabular-nums"
                    style={{
                      color:
                        decoupling.percent > DECOUPLING_THRESHOLD_PERCENT ? '#FC5200' : '#00E5A3',
                    }}
                  >
                    {decoupling.percent.toFixed(1)}%
                  </span>
                  <span className="text-[11px] text-slate-400 pb-1.5">
                    over {formatDuration(Math.round(decoupling.durationSecs))} with power &amp; heart rate
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {[
                    { label: 'First half', half: decoupling.first },
                    { label: 'Second half', half: decoupling.second },
                  ].map((entry) => (
                    <div
                      key={entry.label}
                      className="pl-4 border-l-2 border-white/15"
                    >
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                        {entry.label}
                      </span>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-white font-black text-base tabular-nums">
                          {Math.round(entry.half.watts)}{' '}
                          <span className="text-[11px] font-semibold text-slate-400">W</span>
                        </span>
                        <span className="text-[#F28B82] font-black text-base tabular-nums">
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
                  <p className="text-xs text-[#FC5200] font-semibold pl-4 border-l-2 border-[#FC5200] py-1">
                    Above 5%: heart rate drifted upward relative to power in the second half.
                  </p>
                )}

                <p className="text-[11px] text-slate-500">
                  Power-to-heart-rate ratio comparison between the first and second half of the ride. Target: under 5%.
                </p>
              </section>
            )}
          </div>
        </div>
      )}

      {/* Interval Repeats Table */}
      {currentAct.intervals && currentAct.intervals.length > 0 && (
        <section className="pt-6 border-t border-white/10 space-y-4">
          <div className="flex items-center gap-2">
            <Repeat className="w-4 h-4 text-[#00E5A3]" />
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#00E5A3]">
              Structured Intervals ({currentAct.intervals.length})
            </h3>
          </div>

          <div className="divide-y divide-white/10 text-xs overflow-x-auto">
            {currentAct.intervals.map((int, idx) => (
              <div key={int.id || idx} className="py-3 flex items-center justify-between min-w-[360px]">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide ${
                      int.type === 'RECOVERY'
                        ? 'bg-white/5 text-slate-400'
                        : 'bg-[#00E5A3]/15 text-[#00E5A3]'
                    }`}
                  >
                    {int.type || `Interval ${idx + 1}`}
                  </span>
                  <span className="text-white font-bold text-sm tabular-nums">
                    {formatDuration(int.moving_time || int.elapsed_time || 0)}
                  </span>
                </div>

                <div className="flex items-center gap-5 text-right">
                  {int.average_watts && (
                    <div>
                      <span className="font-black text-white text-sm tabular-nums">{Math.round(int.average_watts)}W</span>
                      <span className="text-[10px] text-slate-400 block">Avg Power</span>
                    </div>
                  )}
                  {int.average_heartrate && (
                    <div>
                      <span className="font-black text-red-400 text-sm tabular-nums">{Math.round(int.average_heartrate)} bpm</span>
                      <span className="text-[10px] text-slate-400 block">Avg HR</span>
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
        <section className="pt-6 border-t border-white/10 space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-slate-400" />
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Athlete Notes &amp; Perceived Exertion
            </h3>
          </div>

          {currentAct.description && (
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap pl-4 border-l-2 border-white/15 py-1 max-w-3xl">
              {currentAct.description}
            </p>
          )}

          <div className="flex items-center gap-8 pt-1 text-xs">
            {currentAct.rpe && (
              <div className="pl-3.5 border-l-2 border-white/20">
                <span className="text-slate-400 uppercase font-bold text-[10px] tracking-widest block mb-0.5">Perceived Exertion (RPE)</span>
                <span className="text-white font-black text-base">{currentAct.rpe} / 10</span>
              </div>
            )}
            {currentAct.feel && (
              <div className="pl-3.5 border-l-2 border-[#00E5A3]/70">
                <span className="text-slate-400 uppercase font-bold text-[10px] tracking-widest block mb-0.5">Feel</span>
                <span className="text-[#00E5A3] font-bold text-base">
                  {currentAct.feel === 5 ? 'Great' : currentAct.feel === 4 ? 'Good' : 'Normal'}
                </span>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
