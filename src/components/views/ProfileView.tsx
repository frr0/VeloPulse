import {
  Heart,
  LogOut,
  RefreshCw,
  Scale,
  Zap,
  Bluetooth,
  Gauge,
  Sliders,
  Volume2,
} from 'lucide-react';
import React from 'react';
import { DEMO_ONLY } from '../../config/demoOnly';
import { useApp } from '../../context/AppContext';
import { UserSettings } from '../../types';

interface ProfileViewProps {
  settings?: UserSettings;
  onOpenSettings?: () => void;
  onOpenBluetooth?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  settings,
  onOpenSettings,
  onOpenBluetooth,
}) => {
  const {
    athlete,
    credentials,
    useImperial,
    toggleUnits,
    refreshData,
    isRefreshing,
    logout,
  } = useApp();

  const isDemo = credentials?.isDemo;
  const displayName = athlete?.name || athlete?.firstname || 'Athlete';
  const effectiveFtp = athlete?.ftp || settings?.ftp || 250;
  const effectiveMaxHr = athlete?.maxHR || settings?.maxHeartRate || 190;
  const effectiveRestHr = athlete?.restingHR || settings?.restingHeartRate || 55;
  const effectiveWeightKg = athlete?.weight || settings?.riderWeightKg || 75;

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-fadeIn">
      {/* Athlete Hero Card */}
      <div className="bg-[#1F2025] border border-[#383941] rounded-3xl p-6 sm:p-7 shadow-xl">
        <div className="flex items-center gap-5 mb-6">
          {athlete?.profile_medium ? (
            <img
              src={athlete.profile_medium}
              alt={displayName}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-[#00E5A3]"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-[#2F3037] border border-[#383941] flex items-center justify-center text-[#00E5A3] font-black text-2xl">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}

          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white">{displayName}</h2>
            {(athlete?.city || athlete?.country) && (
              <span className="text-xs text-slate-400 block mt-0.5">
                {[athlete.city, athlete.country].filter(Boolean).join(', ')}
              </span>
            )}
            <span className="inline-block mt-2 bg-[#2F3037] px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Athlete ID: {athlete?.id || credentials?.athleteId || '0'}
            </span>
          </div>
        </div>

        {/* Baselines Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[#2F3037] rounded-2xl border border-white/5 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              <Zap className="w-3 h-3 text-[#FC5200]" />
              FTP
            </div>
            <span className="text-lg font-black text-white">
              {effectiveFtp} W
            </span>
          </div>

          <div>
            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              <Heart className="w-3 h-3 text-red-400" />
              Rest HR
            </div>
            <span className="text-lg font-black text-white">
              {effectiveRestHr} bpm
            </span>
          </div>

          <div>
            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              <Heart className="w-3 h-3 text-red-500" />
              Max HR
            </div>
            <span className="text-lg font-black text-white">
              {effectiveMaxHr} bpm
            </span>
          </div>

          <div>
            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              <Scale className="w-3 h-3 text-[#00B4D8]" />
              Weight
            </div>
            <span className="text-lg font-black text-white">
              {useImperial
                ? `${(effectiveWeightKg * 2.20462).toFixed(1)} lbs`
                : `${effectiveWeightKg.toFixed(1)} kg`}
            </span>
          </div>
        </div>
      </div>

      {/* Smart Trainer & Physics Settings */}
      <div className="bg-[#1F2025] border border-[#383941] rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-[#00E5A3]" />
            <span>Smart Trainer & Cycling Physics</span>
          </h3>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="px-3 py-1.5 rounded-xl bg-[#2F3037] border border-[#383941] text-xs font-bold text-[#00E5A3] hover:bg-[#3E4049] transition-colors"
            >
              Configure Parameters
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[#2F3037] rounded-2xl border border-white/5 text-center text-xs">
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Bike Weight</span>
            <span className="font-bold text-white text-sm">{settings?.bikeWeightKg ?? 9} kg</span>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">CdA (Aero Drag)</span>
            <span className="font-bold text-white text-sm">{settings?.cda ?? 0.32} m²</span>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Speed Source</span>
            <span className="font-bold text-[#00E5A3] text-sm uppercase">
              {settings?.speedSource === 'physics' ? 'Virtual Physics' : 'Flywheel'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Sound Audio Cues</span>
            <span className="font-bold text-white text-sm">
              {settings?.soundAlerts ? 'Enabled' : 'Muted'}
            </span>
          </div>
        </div>

        {onOpenBluetooth && (
          <div className="pt-2 flex items-center justify-between">
            <div>
              <span className="text-sm font-bold text-white block">Bluetooth Hardware Sensors</span>
              <span className="text-xs text-slate-400">
                Connect Smart Trainer (FTMS), Crank Cadence, or Heart Rate strap
              </span>
            </div>
            <button
              onClick={onOpenBluetooth}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#00E5A3]/15 hover:bg-[#00E5A3]/25 border border-[#00E5A3]/30 text-xs font-bold text-[#00E5A3] transition-colors"
            >
              <Bluetooth className="w-3.5 h-3.5" />
              <span>Sensors Modal</span>
            </button>
          </div>
        )}
      </div>

      {/* Preferences & Units */}
      <div className="bg-[#1F2025] border border-[#383941] rounded-3xl p-6 shadow-xl space-y-5">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
          Preferences & Intervals.icu Sync
        </h3>

        <div className="flex items-center justify-between py-2 border-b border-white/5">
          <div>
            <span className="text-sm font-bold text-white block">Units of Measurement</span>
            <span className="text-xs text-slate-400">
              {useImperial ? 'Imperial (Miles, Feet, Lbs)' : 'Metric (Kilometers, Meters, Kg)'}
            </span>
          </div>
          <button
            onClick={toggleUnits}
            className="px-3.5 py-1.5 rounded-xl bg-[#2F3037] border border-[#383941] text-xs font-bold text-[#00E5A3] hover:bg-[#3E4049] transition-colors"
          >
            Switch to {useImperial ? 'Metric' : 'Imperial'}
          </button>
        </div>

        <div className="flex items-center justify-between py-2 border-b border-white/5">
          <div>
            <span className="text-sm font-bold text-white block">Connection Type</span>
            <span className="text-xs text-slate-400">
              {isDemo ? 'Running in Simulated Demo Mode' : 'Connected directly to Intervals.icu API'}
            </span>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase ${
              isDemo ? 'bg-amber-500/10 text-amber-400' : 'bg-[#00E5A3]/10 text-[#00E5A3]'
            }`}
          >
            {isDemo ? 'Demo Mode' : 'Live Sync'}
          </span>
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <span className="text-sm font-bold text-white block">Force Re-sync</span>
            <span className="text-xs text-slate-400">Pull freshest workouts, wellness, and events</span>
          </div>
          <button
            onClick={refreshData}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#2F3037] border border-[#383941] text-xs font-bold text-white hover:bg-[#3E4049] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#00E5A3]' : ''}`} />
            <span>Sync Now</span>
          </button>
        </div>
      </div>

      {/* Disconnect Account: not in the published demo (DEMO_ONLY), which has
          no login and no logout. */}
      <div className="text-center pt-2">
        {!DEMO_ONLY && (
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-bold text-xs uppercase tracking-wider py-3 px-6 rounded-2xl transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Disconnect Intervals.icu Account</span>
          </button>
        )}
        <span className="text-[11px] text-slate-500 block mt-2">
          VeloPulse • Unified Smart Cycling & Intervals Platform
        </span>
        <div className="flex items-center justify-center gap-4 mt-3 text-[11px] text-slate-500">
          <a
            href="/privacy.html"
            target="_blank"
            rel="noopener"
            className="hover:text-slate-300 underline underline-offset-2"
          >
            Informativa sulla privacy
          </a>
          <span className="text-slate-600">&middot;</span>
          <a
            href="/termini.html"
            target="_blank"
            rel="noopener"
            className="hover:text-slate-300 underline underline-offset-2"
          >
            Termini di servizio
          </a>
        </div>
      </div>
    </div>
  );
};
