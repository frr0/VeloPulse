import {
  Activity as PulseIcon,
  Calendar,
  ChevronRight,
  Heart,
  Moon,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Activity } from '../../types/intervals';
import {
  formatDistance,
  formatDuration,
  formatElevation,
  getFormStatus,
} from '../../utils/formatters';
import { ActivityCard } from '../ActivityCard';
import { MetricCard } from '../MetricCard';
import { RecoveryRing } from '../RecoveryRing';
import { WeeklyLoadBar } from '../WeeklyLoadBar';
import { AnalyticsTab } from './FitnessView';
import { isAndroid } from '../../utils/platform';
import { powerAtSecs } from '../../services/intervals/api';

interface DashboardViewProps {
  onSelectActivity?: (activity: Activity) => void;
  onNavigateTab: (tab: any) => void;
  onNavigateAnalytics?: (tab: AnalyticsTab) => void;
  onOpenBluetooth?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onSelectActivity,
  onNavigateTab,
  onNavigateAnalytics,
}) => {
  const {
    isSupabaseMode,
    providerConnections,
    athlete,
    latestWellness,
    activities,
    events,
    recoveryScore,
    powerCurve,
    useImperial,
  } = useApp();

  const ctl = typeof latestWellness?.ctl === 'number' ? latestWellness.ctl : null;
  const atl = typeof latestWellness?.atl === 'number' ? latestWellness.atl : null;
  const tsb =
    typeof latestWellness?.tsb === 'number'
      ? latestWellness.tsb
      : ctl !== null && atl !== null
      ? ctl - atl
      : null;
  const formStatus = tsb !== null ? getFormStatus(tsb) : null;

  const rhrValue = latestWellness?.restingHR ?? athlete?.restingHR ?? null;
  const vo2Value = latestWellness?.vo2max ?? athlete?.vo2max ?? null;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayEvent = events.find((e) =>
    e.start_date_local && e.start_date_local.startsWith(todayStr)
  );

  // Last 30 days volume & training summary
  const summary30d = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let count = 0;
    let distance = 0;
    let duration = 0;
    let elevation = 0;
    let load = 0;

    for (const act of activities) {
      const ts = new Date(act.start_date_local).getTime();
      if (!Number.isFinite(ts) || ts < cutoff) continue;
      count++;
      distance += act.distance || 0;
      duration += act.moving_time || act.elapsed_time || 0;
      elevation += act.total_elevation_gain || 0;
      load += act.icu_training_load || 0;
    }

    return {
      count,
      distance,
      duration,
      elevation,
      load: Math.round(load),
      avgWeeklySecs: Math.round(duration / 4.285),
    };
  }, [activities]);

  // Power bests strip (5s, 1m, 5m, 20m, 60m) from Intervals.icu power curve
  const powerBests = useMemo(() => {
    const series = powerCurve.recent ?? powerCurve.season;
    if (!series || series.samples.length === 0) return null;
    const benchmarks = [
      { label: '5s Sprint', secs: 5, color: '#FC5200' },
      { label: '1m Anaerobic', secs: 60, color: '#F59E0B' },
      { label: '5m VO2 Max', secs: 300, color: '#A855F7' },
      { label: '20m Threshold', secs: 1200, color: '#00E5A3' },
      { label: '60m Endurance', secs: 3600, color: '#38BDF8' },
    ];
    const items = benchmarks.map((b) => ({
      ...b,
      reading: powerAtSecs(series.samples, b.secs),
    }));
    return items.some((i) => i.reading !== null) ? { label: series.label, items } : null;
  }, [powerCurve]);

  const isAndroidApp = isAndroid();
  // The phone app shows a shorter Today page: volume and power bests live in Fitness.
  const recentActivities = useMemo(
    () => activities.slice(0, isAndroidApp ? 3 : 5),
    [activities, isAndroidApp]
  );
  const ftpWkg =
    athlete?.ftp && athlete?.weight && athlete.weight > 0
      ? (athlete.ftp / athlete.weight).toFixed(2)
      : null;


  return (
    <div className={`${isAndroidApp ? 'space-y-8' : 'space-y-10'} animate-fadeIn`}>
      {isSupabaseMode && providerConnections.length === 0 && (
        <div className="pl-4 border-l-2 border-[#00E5A3] py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#00E5A3] block mb-1">
              Welcome to VeloLab
            </span>
            <p className="text-base font-bold text-white">
              Connect a data source to start syncing your activities
            </p>
            <p className="text-xs text-[#989dab] mt-0.5">
              Choose Intervals.icu, Strava, or import Garmin .FIT files directly into your database.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('profile')}
            className="shrink-0 text-xs font-bold text-[#00E5A3] hover:underline flex items-center gap-1"
          >
            <span>Connect Data Sources</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Editorial Band: Recovery Ring + Fitness Triplet & 7-Day Load */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center pb-10 border-b border-white/10">
        {/* Recovery Hero (5 cols on lg, frameless) */}
        <div className="lg:col-span-5 flex flex-col items-center justify-between lg:pr-8 lg:border-r lg:border-white/10">
          <div className="w-full flex items-center justify-between mb-5">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#00E5A3]">
              Daily Recovery &amp; Readiness
            </span>
            <button
              onClick={() => onNavigateTab('fitness')}
              className="text-xs font-semibold text-[#989dab] hover:text-[#00E5A3] transition-colors flex items-center gap-1"
            >
              <span>Trends</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <RecoveryRing
            score={recoveryScore}
            size={210}
            strokeWidth={15}
            restingHR={latestWellness?.restingHR}
            hrv={latestWellness?.hrv}
          />

          <p className="text-xs text-[#989dab] text-center mt-5 max-w-xs leading-relaxed">
            {recoveryScore === null
              ? 'No biometric recovery data (HRV, sleep, resting HR, or readiness) available yet.'
              : recoveryScore >= 67
              ? 'Your central nervous system is primed for high-strain training and intensity.'
              : recoveryScore >= 34
              ? 'Moderate readiness. Stick to aerobic baseline workouts or sweetspot.'
              : 'Elevated physiological fatigue. Prioritize sleep, nutrition, and active recovery.'}
          </p>
        </div>

        {/* Fitness Triplet & Training Load (7 cols on lg, card-free editorial) */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-7">
          {/* Triplet Editorial Columns with thin left accent bars */}
          <div className="grid grid-cols-3 gap-6 sm:gap-8">
            <div className="pl-4 border-l-2 border-[#38BDF8]/60">
              <span className="text-[11px] font-bold text-[#989dab] uppercase tracking-[0.12em] block mb-1">
                Fitness
              </span>
              <span className="text-4xl sm:text-5xl font-black font-mono text-[#38BDF8] block tracking-tight leading-none">
                {ctl !== null ? Math.round(ctl) : '--'}
              </span>
              <span className="text-xs font-mono text-[#989dab] mt-1.5 block">CTL (42d)</span>
            </div>

            <div className="pl-4 border-l-2 border-[#A855F7]/60">
              <span className="text-[11px] font-bold text-[#989dab] uppercase tracking-[0.12em] block mb-1">
                Fatigue
              </span>
              <span className="text-4xl sm:text-5xl font-black font-mono text-[#A855F7] block tracking-tight leading-none">
                {atl !== null ? Math.round(atl) : '--'}
              </span>
              <span className="text-xs font-mono text-[#989dab] mt-1.5 block">ATL (7d)</span>
            </div>

            <div
              className="pl-4 border-l-2"
              style={{ borderLeftColor: `${formStatus?.color ?? '#64748B'}85` }}
            >
              <span className="text-[11px] font-bold text-[#989dab] uppercase tracking-[0.12em] block mb-1">
                Form
              </span>
              <span
                className="text-4xl sm:text-5xl font-black font-mono block tracking-tight leading-none"
                style={{ color: formStatus?.color ?? '#94A3B8' }}
              >
                {tsb === null ? '--' : tsb > 0 ? `+${Math.round(tsb)}` : Math.round(tsb)}
              </span>
              <span
                className="text-xs font-semibold mt-1.5 block capitalize"
                style={{ color: formStatus?.color ?? '#94A3B8' }}
              >
                {formStatus?.label ?? 'No data'}
              </span>
            </div>
          </div>

          {/* Weekly Training Load */}
          <WeeklyLoadBar activities={activities} />
        </div>
      </div>

      {/* Today's Planned Workout Strip (editorial hairline style) */}
      {todayEvent && (
        <div className="pl-4 border-l-2 border-[#00E5A3] py-2 pb-8 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#00E5A3]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#00E5A3]">
                Today's Planned Workout
              </span>
              {todayEvent.load && (
                <span className="text-xs font-mono font-bold text-[#FC5200] ml-2">
                  ~{todayEvent.load} TSS
                </span>
              )}
            </div>
            <h3 className="text-lg font-extrabold text-white">{todayEvent.name}</h3>
            {todayEvent.description && (
              <p className="text-xs text-[#989dab] mt-1 leading-relaxed max-w-xl">
                {todayEvent.description}
              </p>
            )}
            {todayEvent.moving_time && (
              <span className="text-xs text-[#989dab] font-mono block mt-1.5">
                Target duration: {formatDuration(todayEvent.moving_time)}
              </span>
            )}
          </div>

          <button
            onClick={() => onNavigateTab('ride')}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#00E5A3]/10 hover:bg-[#00E5A3]/20 text-xs font-bold text-[#00E5A3] shrink-0 transition-all"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Ride in 3D Studio</span>
          </button>
        </div>
      )}

      {/* Daily Wellness Biometrics Grid (editorial borderless blocks) */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#00E5A3]">
            Daily Wellness &amp; Biometrics
          </h4>
          <button
            onClick={() => (onNavigateAnalytics ? onNavigateAnalytics('all') : onNavigateTab('fitness'))}
            className="text-xs font-semibold text-[#989dab] hover:text-[#00E5A3] transition-colors flex items-center gap-1"
          >
            <span>All Biometrics &amp; Graphs</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
          <MetricCard
            label="Sleep"
            value={
              latestWellness?.sleepSecs
                ? formatDuration(latestWellness.sleepSecs)
                : '--'
            }
            subValue={
              latestWellness?.sleepScore
                ? `${latestWellness.sleepScore}% Sleep Score`
                : latestWellness?.sleepSecs
                ? 'Recorded'
                : 'No data'
            }
            icon={<Moon className="w-4 h-4" />}
            accentColor="#818CF8"
            onClick={() => (onNavigateAnalytics ? onNavigateAnalytics('sleep') : onNavigateTab('fitness'))}
          />

          <MetricCard
            label="HRV (rMSSD)"
            value={latestWellness?.hrv ? `${latestWellness.hrv}` : '--'}
            unit={latestWellness?.hrv ? 'ms' : undefined}
            subValue={latestWellness?.hrv ? 'Recorded rMSSD' : 'No data'}
            icon={<Heart className="w-4 h-4" />}
            accentColor="#00E5A3"
            onClick={() => (onNavigateAnalytics ? onNavigateAnalytics('hrv') : onNavigateTab('fitness'))}
          />

          <MetricCard
            label="Resting HR"
            value={rhrValue !== null ? rhrValue : '--'}
            unit={rhrValue !== null ? 'bpm' : undefined}
            subValue={rhrValue !== null ? 'Resting pulse' : 'No data'}
            icon={<PulseIcon className="w-4 h-4" />}
            accentColor="#00B4D8"
            onClick={() => (onNavigateAnalytics ? onNavigateAnalytics('resting_hr') : onNavigateTab('fitness'))}
          />

          <MetricCard
            label="VO2 Max"
            value={vo2Value !== null ? `${vo2Value}` : '--'}
            unit={vo2Value !== null ? 'ml/kg' : undefined}
            subValue={vo2Value !== null ? 'Recorded VO2 Max' : 'No data'}
            icon={<TrendingUp className="w-4 h-4" />}
            accentColor="#A855F7"
            onClick={() => (onNavigateAnalytics ? onNavigateAnalytics('vo2max') : onNavigateTab('fitness'))}
          />
        </div>
      </div>

      {/* Last 30 Days Volume & Threshold Band (web only) */}
      {!isAndroidApp && (
      <section className="pt-8 border-t border-white/10">
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#00E5A3]">
              Last 30 Days Volume
            </h4>
            {athlete?.ftp && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FC5200]/15 text-[#FC5200] font-mono">
                FTP {athlete.ftp} W{ftpWkg ? ` · ${ftpWkg} W/kg` : ''}
              </span>
            )}
          </div>
          <span className="text-xs text-[#989dab] font-mono">
            {summary30d.count} {summary30d.count === 1 ? 'session' : 'sessions'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
          <div className="pl-4 border-l-2 border-[#00E5A3]/70">
            <span className="text-[10px] font-bold text-[#989dab] uppercase tracking-[0.12em] block mb-1">
              Distance
            </span>
            <span className="text-2xl sm:text-3xl font-black font-mono text-white tabular-nums block leading-none">
              {formatDistance(summary30d.distance, useImperial)}
            </span>
            <span className="text-xs text-[#989dab] mt-1.5 block">30-day total</span>
          </div>

          <div className="pl-4 border-l-2 border-[#38BDF8]/70">
            <span className="text-[10px] font-bold text-[#989dab] uppercase tracking-[0.12em] block mb-1">
              Moving Time
            </span>
            <span className="text-2xl sm:text-3xl font-black font-mono text-white tabular-nums block leading-none">
              {formatDuration(summary30d.duration)}
            </span>
            <span className="text-xs text-[#989dab] mt-1.5 block">
              ~{formatDuration(summary30d.avgWeeklySecs)} / week
            </span>
          </div>

          <div className="pl-4 border-l-2 border-[#6DD58C]/70">
            <span className="text-[10px] font-bold text-[#989dab] uppercase tracking-[0.12em] block mb-1">
              Elevation Gain
            </span>
            <span className="text-2xl sm:text-3xl font-black font-mono text-[#6DD58C] tabular-nums block leading-none">
              {formatElevation(summary30d.elevation, useImperial)}
            </span>
            <span className="text-xs text-[#989dab] mt-1.5 block">Climbed in 30d</span>
          </div>

          <div className="pl-4 border-l-2 border-[#FC5200]/70">
            <span className="text-[10px] font-bold text-[#989dab] uppercase tracking-[0.12em] block mb-1">
              Training Load
            </span>
            <span className="text-2xl sm:text-3xl font-black font-mono text-[#FC5200] tabular-nums block leading-none">
              {summary30d.load}
            </span>
            <span className="text-xs text-[#989dab] mt-1.5 block">Total TSS</span>
          </div>
        </div>
      </section>
      )}

      {/* Power Bests Strip (web only, when power curve data is available) */}
      {!isAndroidApp && powerBests && (
        <section className="pt-8 border-t border-white/10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#FC5200]">
                Power Bests
              </h4>
              <span className="text-[11px] text-[#989dab]">{powerBests.label}</span>
            </div>
            <button
              onClick={() => (onNavigateAnalytics ? onNavigateAnalytics('power') : onNavigateTab('fitness'))}
              className="text-xs font-semibold text-[#989dab] hover:text-[#FC5200] transition-colors flex items-center gap-1"
            >
              <span>Power Curve</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
            {powerBests.items.map((item, idx) => (
              <div
                key={item.secs}
                onClick={() => (onNavigateAnalytics ? onNavigateAnalytics('power') : onNavigateTab('fitness'))}
                className={`pl-3.5 border-l-2 cursor-pointer group transition-colors ${
                  idx === powerBests.items.length - 1 ? 'col-span-2 sm:col-span-1' : ''
                }`}
                style={{ borderColor: `${item.color}99` }}
              >
                <span className="text-[10px] font-bold text-[#989dab] uppercase tracking-widest block">
                  {item.label}
                </span>
                <span className="text-2xl font-black font-mono text-white group-hover:text-[#00E5A3] transition-colors tabular-nums block mt-0.5">
                  {item.reading ? (
                    <>
                      {item.reading.interpolated ? '~' : ''}
                      {item.reading.watts}
                      <span className="text-xs font-semibold text-slate-400 ml-1">W</span>
                    </>
                  ) : (
                    '--'
                  )}
                </span>
                <span className="text-[11px] font-semibold" style={{ color: item.color }}>
                  {item.reading && item.reading.wkg !== null
                    ? `${item.reading.interpolated ? '~' : ''}${item.reading.wkg.toFixed(1)} W/kg`
                    : '--'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Activities (Latest 5 Hairline Rows) */}
      {recentActivities.length > 0 && (
        <section className="pt-8 border-t border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#00E5A3]">
              Recent Activities
            </h4>
            <button
              onClick={() => onNavigateTab('activities')}
              className="text-xs font-semibold text-[#989dab] hover:text-[#00E5A3] transition-colors flex items-center gap-1"
            >
              <span>All Activities ({activities.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="border-t border-white/10">
            {recentActivities.map((act) => (
              <ActivityCard
                key={act.id}
                activity={act}
                useImperial={useImperial}
                onSelect={(selected) => {
                  if (onSelectActivity) {
                    onSelectActivity(selected);
                  } else {
                    onNavigateTab('activities');
                  }
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
