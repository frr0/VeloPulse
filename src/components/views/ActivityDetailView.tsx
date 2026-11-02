import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bike,
  Calendar,
  Clock,
  Download,
  ExternalLink,
  Footprints,
  Heart,
  Home,
  Loader2,
  MapPinOff,
  MessageSquare,
  Repeat,
  Share2,
  TrendingUp,
  Waves,
  Zap,
} from 'lucide-react';
import { Activity } from '../../types/intervals';
import { UserSettings } from '../../types';
import { useApp } from '../../context/AppContext';
import { getActivityDetails, getActivityStreams } from '../../services/intervals/api';
import { ActivityMap } from '../ActivityMap';
import { getActivityRoute } from '../../utils/polyline';
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
  const { credentials } = useApp();
  const [detailedActivity, setDetailedActivity] = useState<Activity>(activity);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

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
    if (!activity) return;

    if (credentials && !credentials.isDemo && activity.id) {
      setIsLoadingDetails(true);
      Promise.all([
        getActivityDetails(credentials.apiKey, activity.id).catch(() => null),
        getActivityStreams(credentials.apiKey, activity.id, 'latlng').catch(() => null),
      ])
        .then(([full, streams]) => {
          setDetailedActivity((prev) => {
            const next = { ...prev, ...(full || {}) };
            if (streams && Array.isArray(streams)) {
              const latlngStream = streams.find((s: any) => s.type === 'latlng');
              if (latlngStream && Array.isArray(latlngStream.data)) {
                next.icu_latlng = latlngStream.data;
              }
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

  // Real GPS track only: the app never draws an invented route.
  // The memo keys on the track sources, not on the activity object: when the
  // details arrive the component builds a new object, and keying on it would
  // hand the map a new array and rebuild it, losing the zoom set by the user.
  const routeSignature = [
    currentAct.id,
    Array.isArray(currentAct.icu_latlng) ? currentAct.icu_latlng.length : 0,
    currentAct.map?.summary_polyline || currentAct.map?.polyline || '',
    currentAct.summary_polyline || currentAct.polyline || '',
  ].join('|');

  // eslint-disable-next-line react-hooks/exhaustive-deps -- routeSignature covers every field read by getActivityRoute
  const route = useMemo(() => getActivityRoute(currentAct), [routeSignature]);
  const hasRoute = route.length > 1;

  const isIndoorSession =
    currentAct.indoor === true ||
    currentAct.trainer === true ||
    typeLower.includes('virtual') ||
    typeLower.includes('indoor');

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

      {/* Main Grid: Interactive GPS Map, only with a real track */}
      <section>
        {hasRoute ? (
          <ActivityMap activity={currentAct} coordinates={route} useImperial={useImperial} />
        ) : isIndoorSession ? (
          <div className="bg-[#1F2025] border border-[#383941] rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#26272D] border border-white/5 flex items-center justify-center mb-3">
              <Home className="w-7 h-7 text-[#00E5A3]" />
            </div>
            <h4 className="text-base font-bold text-white mb-1">
              Sessione al chiuso: nessun percorso GPS registrato
            </h4>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md">
              Trovi i dati dell&apos;allenamento qui sotto: potenza, velocità, battito, cadenza e zone.
            </p>
          </div>
        ) : isLoadingDetails ? (
          <div className="bg-[#1F2025] border border-[#383941] rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#26272D] border border-white/5 flex items-center justify-center mb-3">
              <Loader2 className="w-7 h-7 text-[#00E5A3] animate-spin" />
            </div>
            <h4 className="text-base font-bold text-white mb-1">Carico il percorso da Intervals.icu</h4>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md">
              Scarico la traccia GPS dell&apos;attività.
            </p>
          </div>
        ) : (
          <div className="bg-[#1F2025] border border-[#383941] rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#26272D] border border-white/5 flex items-center justify-center mb-3">
              <MapPinOff className="w-7 h-7 text-[#F28B82]" />
            </div>
            <h4 className="text-base font-bold text-white mb-1">
              Questa attività non ha un percorso GPS su Intervals.icu
            </h4>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md">
              Intervals.icu non ha una traccia per questa attività, quindi non c&apos;è niente da disegnare
              sulla mappa.
            </p>
          </div>
        )}
      </section>

      {/* Key Hero Metrics Grid */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Distance */}
        <div className="bg-[#1F2025] border border-[#383941] p-4 sm:p-5 rounded-3xl">
          <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
            Distanza
          </span>
          <span className="text-2xl sm:text-3xl font-black text-white">
            {formatDistance(currentAct.distance, useImperial)}
          </span>
        </div>

        {/* Duration */}
        <div className="bg-[#1F2025] border border-[#383941] p-4 sm:p-5 rounded-3xl">
          <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
            Tempo in Movimento
          </span>
          <span className="text-2xl sm:text-3xl font-black text-white">
            {formatDuration(currentAct.moving_time || currentAct.elapsed_time)}
          </span>
        </div>

        {/* Elevation Gain */}
        <div className="bg-[#1F2025] border border-[#383941] p-4 sm:p-5 rounded-3xl">
          <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
            Dislivello Positivo
          </span>
          <span className="text-2xl sm:text-3xl font-black text-[#6DD58C]">
            {formatElevation(currentAct.total_elevation_gain, useImperial)}
          </span>
        </div>

        {/* Training Load */}
        <div className="bg-[#1F2025] border border-[#383941] p-4 sm:p-5 rounded-3xl">
          <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
            Carico (TSS)
          </span>
          <span className="text-2xl sm:text-3xl font-black text-[#FC5200]">
            {currentAct.icu_training_load ? Math.round(currentAct.icu_training_load) : '--'}
          </span>
        </div>
      </section>

      {/* Performance & Output Metrics */}
      <section className="bg-[#1F2025] border border-[#383941] p-5 sm:p-6 rounded-3xl space-y-4">
        <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#FDD663]" />
          <span>Metriche di Potenza, Velocità e Fisiologiche</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {/* Average Watts */}
          {currentAct.average_watts ? (
            <div className="bg-[#26272D] p-3.5 rounded-2xl border border-white/5">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Potenza Media</span>
              <span className="text-lg sm:text-xl font-black text-white">{formatWatts(currentAct.average_watts)}</span>
              {currentAct.weighted_average_watts && (
                <span className="text-[11px] text-[#FC5200] font-semibold block mt-0.5">
                  NP {Math.round(currentAct.weighted_average_watts)}W
                </span>
              )}
            </div>
          ) : null}

          {/* Speed / Pace */}
          {isRun && currentAct.average_speed ? (
            <div className="bg-[#26272D] p-3.5 rounded-2xl border border-white/5">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Passo Medio</span>
              <span className="text-lg sm:text-xl font-black text-white">
                {formatPace(currentAct.average_speed, useImperial)}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                {formatSpeed(currentAct.average_speed, useImperial)}
              </span>
            </div>
          ) : currentAct.average_speed ? (
            <div className="bg-[#26272D] p-3.5 rounded-2xl border border-white/5">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Velocità Media</span>
              <span className="text-lg sm:text-xl font-black text-white">
                {formatSpeed(currentAct.average_speed, useImperial)}
              </span>
              {currentAct.max_speed && (
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Max {formatSpeed(currentAct.max_speed, useImperial)}
                </span>
              )}
            </div>
          ) : null}

          {/* Heart Rate */}
          {currentAct.average_heartrate ? (
            <div className="bg-[#26272D] p-3.5 rounded-2xl border border-white/5">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Battito Medio</span>
              <span className="text-lg sm:text-xl font-black text-white">
                {formatHeartRate(currentAct.average_heartrate)}
              </span>
              {currentAct.max_heartrate && (
                <span className="text-[11px] text-red-400 font-semibold block mt-0.5">
                  Max {formatHeartRate(currentAct.max_heartrate)}
                </span>
              )}
            </div>
          ) : null}

          {/* Cadence */}
          {currentAct.icu_average_cadence ? (
            <div className="bg-[#26272D] p-3.5 rounded-2xl border border-white/5">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Cadenza Media</span>
              <span className="text-lg sm:text-xl font-black text-white">
                {Math.round(currentAct.icu_average_cadence)} <span className="text-xs font-normal text-slate-400">rpm</span>
              </span>
            </div>
          ) : null}

          {/* Intensity Factor */}
          {currentAct.icu_intensity ? (
            <div className="bg-[#26272D] p-3.5 rounded-2xl border border-white/5">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Intensity (IF)</span>
              <span className="text-lg sm:text-xl font-black text-[#FDD663]">
                {(currentAct.icu_intensity > 2 ? currentAct.icu_intensity / 100 : currentAct.icu_intensity).toFixed(2)}
              </span>
            </div>
          ) : null}

          {/* Energy kJ */}
          {currentAct.icu_joules ? (
            <div className="bg-[#26272D] p-3.5 rounded-2xl border border-white/5">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Lavoro Speso</span>
              <span className="text-lg sm:text-xl font-black text-white">
                {Math.round(currentAct.icu_joules / 1000)} <span className="text-xs font-normal text-slate-400">kJ</span>
              </span>
            </div>
          ) : null}
        </div>
      </section>

      {/* Heart Rate & Power Zones Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Heart Rate Zones */}
        <div className="bg-[#1F2025] border border-[#383941] p-5 sm:p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-500" />
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-300">
                Distribuzione Zone Frequenza Cardiaca
              </h3>
            </div>
            {isLoadingDetails && (
              <span className="text-[10px] text-slate-400 animate-pulse">Sincronizzazione...</span>
            )}
          </div>

          {totalHrSecs > 0 ? (
            <>
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
            </>
          ) : currentAct.average_heartrate ? (
            <div className="bg-[#26272D] p-4 rounded-2xl border border-white/5 text-xs text-slate-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-500" />
                <span>Media Registrata: <strong className="text-white">{currentAct.average_heartrate} bpm</strong></span>
              </div>
              <span className="text-[11px] text-slate-400">Distribuzione streaming non presente</span>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Nessun dato cardio registrato per questo allenamento.</p>
          )}
        </div>

        {/* Power Zones */}
        <div className="bg-[#1F2025] border border-[#383941] p-5 sm:p-6 rounded-3xl space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#FC5200]" />
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-300">
              Distribuzione Zone di Potenza
            </h3>
          </div>

          {totalPowerSecs > 0 ? (
            <>
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
            </>
          ) : (
            <p className="text-xs text-slate-400">Nessuna misurazione di potenza disponibile per questa sessione.</p>
          )}
        </div>
      </div>

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
