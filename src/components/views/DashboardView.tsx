import {
  Activity as PulseIcon,
  Calendar,
  ChevronRight,
  Heart,
  Moon,
  TrendingUp,
  Zap,
  BarChart3,
} from 'lucide-react';
import React from 'react';
import { useApp } from '../../context/AppContext';
import { Activity } from '../../types/intervals';
import { formatDuration, getFormStatus } from '../../utils/formatters';
import { MetricCard } from '../MetricCard';
import { RecoveryRing } from '../RecoveryRing';
import { WeeklyLoadBar } from '../WeeklyLoadBar';
import { AnalyticsTab } from './FitnessView';
import { isAndroid } from '../../utils/platform';

interface DashboardViewProps {
  onSelectActivity?: (activity: Activity) => void;
  onNavigateTab: (tab: any) => void;
  onNavigateAnalytics?: (tab: AnalyticsTab) => void;
  onOpenBluetooth?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateTab,
  onNavigateAnalytics,
}) => {
  const {
    athlete,
    latestWellness,
    activities,
    events,
    recoveryScore,
  } = useApp();

  const ctl = latestWellness?.ctl ?? 78;
  const atl = latestWellness?.atl ?? 82;
  const tsb = latestWellness?.tsb ?? (ctl - atl);
  const formStatus = getFormStatus(tsb);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayEvent = events.find((e) =>
    e.start_date_local && e.start_date_local.startsWith(todayStr)
  );

  const isAndroidApp = isAndroid();

  const biometricsList = [
    {
      id: 'sleep' as const,
      label: 'Sleep',
      value: latestWellness?.sleepSecs
        ? formatDuration(latestWellness.sleepSecs)
        : '7h 45m',
      subValue: latestWellness?.sleepScore
        ? `${latestWellness.sleepScore}% Sleep Score`
        : 'Good Quality',
      icon: <Moon className="w-4 h-4" />,
      accentColor: '#818CF8',
    },
    {
      id: 'hrv' as const,
      label: 'HRV (rMSSD)',
      value: latestWellness?.hrv ? `${latestWellness.hrv}` : '64',
      unit: 'ms',
      subValue: 'Within baseline',
      icon: <Heart className="w-4 h-4" />,
      accentColor: '#00E5A3',
    },
    {
      id: 'resting_hr' as const,
      label: 'Resting HR',
      value: latestWellness?.restingHR || athlete?.restingHR || 46,
      unit: 'bpm',
      subValue: 'Low & recovered',
      icon: <PulseIcon className="w-4 h-4" />,
      accentColor: '#00B4D8',
    },
    {
      id: 'vo2max' as const,
      label: 'VO2 Max',
      value: latestWellness?.vo2max
        ? `${latestWellness.vo2max}`
        : athlete?.vo2max
        ? `${athlete.vo2max}`
        : '56.4',
      unit: 'ml/kg',
      subValue: 'Superior fitness',
      icon: <TrendingUp className="w-4 h-4" />,
      accentColor: '#A855F7',
    },
  ];

  if (isAndroidApp) {
    return (
      <div className="space-y-4 animate-fadeIn">
        {/* Android Compact Hero: Recovery Ring & Fitness Triplet */}
        <div className="bg-[#1F2025] rounded-2xl p-3.5 border border-[#383941] shadow-lg flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Daily Recovery & Readiness
            </span>
            <button
              onClick={() => onNavigateTab('fitness')}
              className="text-[11px] font-bold text-[#00E5A3] hover:underline flex items-center gap-1"
            >
              <span>Trends</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <RecoveryRing
            score={recoveryScore}
            size={140}
            strokeWidth={11}
            restingHR={latestWellness?.restingHR}
            hrv={latestWellness?.hrv}
          />

          {/* Triplet Cards Row: Fitness, Fatigue, Form */}
          <div className="grid grid-cols-3 gap-2 w-full mt-3 pt-3 border-t border-white/5">
            <div className="bg-[#26272D] p-2 rounded-xl border border-[#38BDF8]/20 text-center">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">
                Fitness
              </span>
              <span className="text-xl font-black text-[#38BDF8] block tracking-tight">
                {Math.round(ctl)}
              </span>
              <span className="text-[9px] font-bold text-slate-400 block">CTL (42d)</span>
            </div>

            <div className="bg-[#26272D] p-2 rounded-xl border border-[#A855F7]/20 text-center">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">
                Fatigue
              </span>
              <span className="text-xl font-black text-[#A855F7] block tracking-tight">
                {Math.round(atl)}
              </span>
              <span className="text-[9px] font-bold text-slate-400 block">ATL (7d)</span>
            </div>

            <div
              className="bg-[#26272D] p-2 rounded-xl border text-center"
              style={{ borderColor: `${formStatus.color}30` }}
            >
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">
                Form
              </span>
              <span
                className="text-xl font-black block tracking-tight"
                style={{ color: formStatus.color }}
              >
                {tsb > 0 ? `+${Math.round(tsb)}` : Math.round(tsb)}
              </span>
              <span
                className="text-[9px] font-bold block capitalize"
                style={{ color: formStatus.color }}
              >
                {formStatus.label}
              </span>
            </div>
          </div>
        </div>

        {/* Today's Planned Workout Banner (if any) */}
        {todayEvent && (
          <div className="bg-[#1F2025] border border-[#00B4D8]/30 rounded-2xl p-3.5 shadow-md flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar className="w-3.5 h-3.5 text-[#00B4D8]" />
                <span className="text-[10px] font-black uppercase tracking-wider text-[#00B4D8]">
                  Planned Workout
                </span>
                {todayEvent.load && (
                  <span className="text-[10px] font-black text-[#FC5200] ml-1">
                    ~{todayEvent.load} Load
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-white truncate">{todayEvent.name}</h3>
              {todayEvent.moving_time && (
                <span className="text-[11px] text-slate-400 font-medium block">
                  {formatDuration(todayEvent.moving_time)}
                </span>
              )}
            </div>

            <button
              onClick={() => onNavigateTab('ride')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#00E5A3]/15 hover:bg-[#00E5A3]/25 border border-[#00E5A3]/30 text-xs font-bold text-[#00E5A3] shrink-0 transition-all"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Studio</span>
            </button>
          </div>
        )}

        {/* Daily Wellness Biometrics: Long & Horizontal cards stacked vertically */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Daily Wellness & Biometrics
            </h4>
            <button
              onClick={() => (onNavigateAnalytics ? onNavigateAnalytics('all') : onNavigateTab('fitness'))}
              className="text-[11px] font-bold text-[#00E5A3] hover:underline flex items-center gap-1"
            >
              <span>Tutti i grafici</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {biometricsList.map((item) => (
              <div
                key={item.id}
                onClick={() =>
                  onNavigateAnalytics ? onNavigateAnalytics(item.id) : onNavigateTab('fitness')
                }
                className="bg-[#1F2025] active:bg-[#26272D] border border-[#383941] px-3.5 py-2.5 rounded-2xl flex items-center justify-between shadow-md cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${item.accentColor}18`, color: item.accentColor }}
                  >
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block truncate">{item.label}</span>
                    <span className="text-[11px] text-slate-400 font-medium block truncate">
                      {item.subValue}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <span className="text-base font-black text-white">{item.value}</span>
                    {item.unit && (
                      <span className="text-[10px] text-slate-400 font-bold ml-1">{item.unit}</span>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 7-Day Training Load under the 4 cards */}
        <WeeklyLoadBar activities={activities} />

        {/* Poi i grafici: CTA banner directly into all graphs */}
        <div
          onClick={() => (onNavigateAnalytics ? onNavigateAnalytics('all') : onNavigateTab('fitness'))}
          className="bg-gradient-to-r from-[#1F2025] to-[#26272D] hover:from-[#26272D] hover:to-[#2F3037] border border-[#00E5A3]/30 p-3.5 rounded-2xl flex items-center justify-between shadow-lg cursor-pointer transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00E5A3]/15 border border-[#00E5A3]/30 flex items-center justify-center text-[#00E5A3]">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-black text-white block group-hover:text-[#00E5A3] transition-colors">
                Grafici Fitness & Trend
              </span>
              <span className="text-[10px] text-slate-400 block">
                Visualizza grafici completi, curva di potenza e parametri fisiologici
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#00E5A3] group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Grid: Recovery Ring + Fitness Triplet */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Recovery Hero Card (5 cols on lg) */}
        <div className="lg:col-span-5 bg-[#1F2025] rounded-3xl p-6 sm:p-7 border border-[#383941] shadow-xl flex flex-col items-center justify-between">
          <div className="w-full flex items-center justify-between mb-4">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
              Daily Recovery & Readiness
            </span>
            <button
              onClick={() => onNavigateTab('fitness')}
              className="text-xs font-bold text-[#00E5A3] hover:underline flex items-center gap-1"
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

          <p className="text-xs text-slate-400 text-center mt-4 max-w-xs leading-relaxed">
            {recoveryScore >= 67
              ? 'Your central nervous system is primed for high-strain training and intensity.'
              : recoveryScore >= 34
              ? 'Moderate readiness. Stick to aerobic baseline workouts or sweetspot.'
              : 'Elevated physiological fatigue. Prioritize sleep, nutrition, and active recovery.'}
          </p>
        </div>

        {/* Fitness Triplet & Training Load (7 cols on lg) */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-6">
          {/* Triplet Cards Row */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-[#1F2025] p-4 sm:p-5 rounded-2xl border border-[#38BDF8]/20 text-center shadow-lg">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                Fitness
              </span>
              <span className="text-3xl sm:text-4xl font-black text-[#38BDF8] block tracking-tight">
                {Math.round(ctl)}
              </span>
              <span className="text-[11px] font-bold text-slate-400 mt-1 block">CTL (42d)</span>
            </div>

            <div className="bg-[#1F2025] p-4 sm:p-5 rounded-2xl border border-[#A855F7]/20 text-center shadow-lg">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                Fatigue
              </span>
              <span className="text-3xl sm:text-4xl font-black text-[#A855F7] block tracking-tight">
                {Math.round(atl)}
              </span>
              <span className="text-[11px] font-bold text-slate-400 mt-1 block">ATL (7d)</span>
            </div>

            <div
              className="bg-[#1F2025] p-4 sm:p-5 rounded-2xl border text-center shadow-lg"
              style={{ borderColor: `${formStatus.color}30` }}
            >
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                Form
              </span>
              <span
                className="text-3xl sm:text-4xl font-black block tracking-tight"
                style={{ color: formStatus.color }}
              >
                {tsb > 0 ? `+${Math.round(tsb)}` : Math.round(tsb)}
              </span>
              <span
                className="text-[11px] font-bold mt-1 block capitalize"
                style={{ color: formStatus.color }}
              >
                {formStatus.label}
              </span>
            </div>
          </div>

          {/* Weekly Training Load */}
          <WeeklyLoadBar activities={activities} />
        </div>
      </div>

      {/* Today's Planned Workout Banner (if any) */}
      {todayEvent && (
        <div className="bg-[#1F2025] border border-[#00B4D8]/30 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Calendar className="w-4 h-4 text-[#00B4D8]" />
              <span className="text-xs font-black uppercase tracking-wider text-[#00B4D8]">
                Today's Planned Workout
              </span>
              {todayEvent.load && (
                <span className="text-xs font-black text-[#FC5200] ml-2">
                  ~{todayEvent.load} Load
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-white">{todayEvent.name}</h3>
            {todayEvent.description && (
              <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-xl">
                {todayEvent.description}
              </p>
            )}
            {todayEvent.moving_time && (
              <span className="text-xs text-slate-400 font-medium block mt-1.5">
                Target duration: {formatDuration(todayEvent.moving_time)}
              </span>
            )}
          </div>

          <button
            onClick={() => onNavigateTab('ride')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00E5A3]/15 hover:bg-[#00E5A3]/25 border border-[#00E5A3]/30 text-xs font-bold text-[#00E5A3] shrink-0 transition-all"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Ride in Studio</span>
          </button>
        </div>
      )}

      {/* Daily Wellness Biometrics Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Daily Wellness & Biometrics
          </h4>
          <button
            onClick={() => (onNavigateAnalytics ? onNavigateAnalytics('all') : onNavigateTab('fitness'))}
            className="text-xs font-bold text-[#00E5A3] hover:underline flex items-center gap-1"
          >
            <span>All Biometrics & Graphs</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricCard
            label="Sleep"
            value={
              latestWellness?.sleepSecs
                ? formatDuration(latestWellness.sleepSecs)
                : '7h 45m'
            }
            subValue={
              latestWellness?.sleepScore
                ? `${latestWellness.sleepScore}% Sleep Score`
                : 'Good Quality'
            }
            icon={<Moon className="w-4 h-4" />}
            accentColor="#818CF8"
            onClick={() => (onNavigateAnalytics ? onNavigateAnalytics('sleep') : onNavigateTab('fitness'))}
          />

          <MetricCard
            label="HRV (rMSSD)"
            value={latestWellness?.hrv ? `${latestWellness.hrv}` : '64'}
            unit="ms"
            subValue="Within baseline"
            icon={<Heart className="w-4 h-4" />}
            accentColor="#00E5A3"
            onClick={() => (onNavigateAnalytics ? onNavigateAnalytics('hrv') : onNavigateTab('fitness'))}
          />

          <MetricCard
            label="Resting HR"
            value={latestWellness?.restingHR || athlete?.restingHR || 46}
            unit="bpm"
            subValue="Low & recovered"
            icon={<PulseIcon className="w-4 h-4" />}
            accentColor="#00B4D8"
            onClick={() => (onNavigateAnalytics ? onNavigateAnalytics('resting_hr') : onNavigateTab('fitness'))}
          />

          <MetricCard
            label="VO2 Max"
            value={latestWellness?.vo2max ? `${latestWellness.vo2max}` : athlete?.vo2max ? `${athlete.vo2max}` : '56.4'}
            unit="ml/kg"
            subValue="Superior fitness"
            icon={<TrendingUp className="w-4 h-4" />}
            accentColor="#A855F7"
            onClick={() => (onNavigateAnalytics ? onNavigateAnalytics('vo2max') : onNavigateTab('fitness'))}
          />
        </div>
      </div>
    </div>
  );
};
