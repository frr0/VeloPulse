import React from 'react';
import { Bluetooth, Zap, Activity, Heart, Settings, Dumbbell, ShieldCheck, Download } from 'lucide-react';
import { BluetoothDevicesState, ParsedWorkout } from '../types';

interface HeaderProps {
  devicesState: BluetoothDevicesState;
  currentWorkout: ParsedWorkout | null;
  onOpenBluetooth: () => void;
  onOpenWorkout: () => void;
  onOpenSettings: () => void;
  onExportFit?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  devicesState,
  currentWorkout,
  onOpenBluetooth,
  onOpenWorkout,
  onOpenSettings,
  onExportFit,
}) => {
  const connectedCount = [
    devicesState.trainer.connected,
    devicesState.cadence.connected,
    devicesState.heartRate.connected,
  ].filter(Boolean).length;

  return (
    <header className="sticky top-0 z-30 w-full bg-[#131316]/90 backdrop-blur-md border-b border-[#383941] px-4 md:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-[#A8C7FA]/15 border border-[#A8C7FA]/30 text-[#A8C7FA]">
            <svg
              className="w-5 h-5 fill-current"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="18.5" cy="17.5" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <circle cx="5.5" cy="17.5" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <circle cx="15" cy="5" r="1.5" />
              <path d="M12 17.5V14l-3-3 4-3 2 3h2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base md:text-lg font-black tracking-tight text-white">
                Velo<span className="text-[#A8C7FA]">Pulse</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#A8C7FA] bg-[#2F3037] px-2 py-0.5 rounded-full border border-[#A8C7FA]/20">
                STUDIO
              </span>
            </div>
          </div>
        </div>

        {/* Center: Device Status Pills */}
        <div className="hidden sm:flex items-center gap-2">
          {/* Trainer Pill */}
          <button
            onClick={onOpenBluetooth}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-all ${
              devicesState.trainer.connected
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                : 'bg-[#1F2025] border-[#383941] text-[#9E9EA7] hover:text-white'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${devicesState.trainer.connected ? 'fill-current' : ''}`} />
            <span>Trainer</span>
            {devicesState.trainer.connected && <span className="w-1.5 h-1.5 rounded-full bg-[#6DD58C] animate-pulse" />}
          </button>

          {/* Cadence Pill */}
          <button
            onClick={onOpenBluetooth}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-all ${
              devicesState.cadence.connected
                ? 'bg-[#A8C7FA]/15 border-[#A8C7FA]/30 text-[#A8C7FA]'
                : 'bg-[#1F2025] border-[#383941] text-[#9E9EA7] hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Cadence</span>
            {devicesState.cadence.connected && <span className="w-1.5 h-1.5 rounded-full bg-[#6DD58C] animate-pulse" />}
          </button>

          {/* HR Pill */}
          <button
            onClick={onOpenBluetooth}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-all ${
              devicesState.heartRate.connected
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                : 'bg-[#1F2025] border-[#383941] text-[#9E9EA7] hover:text-white'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${devicesState.heartRate.connected ? 'fill-current' : ''}`} />
            <span>Heart Rate</span>
            {devicesState.heartRate.connected && <span className="w-1.5 h-1.5 rounded-full bg-[#6DD58C] animate-pulse" />}
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Mobile bluetooth button */}
          <button
            onClick={onOpenBluetooth}
            className="sm:hidden flex items-center gap-1.5 p-2 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400"
          >
            <Bluetooth className="w-4 h-4" />
            <span className="text-xs font-bold">{connectedCount}</span>
          </button>

          {/* Desktop Bluetooth Modal Trigger */}
          <button
            onClick={onOpenBluetooth}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-200 transition-colors"
          >
            <Bluetooth className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sensors ({connectedCount}/3)</span>
          </button>

          {/* Workout Selector Button */}
          <button
            onClick={onOpenWorkout}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
              currentWorkout
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Dumbbell className="w-3.5 h-3.5 text-cyan-400" />
            <span className="max-w-[120px] md:max-w-[160px] truncate">
              {currentWorkout ? currentWorkout.title : 'Workout (.zwo)'}
            </span>
          </button>

          {/* FIT Export Button */}
          {onExportFit && (
            <button
              onClick={onExportFit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-xs font-bold text-emerald-300 shadow-sm shadow-emerald-500/15 transition-all"
              title="Scarica o genera file .FIT compatibile con Garmin e Strava"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden xs:inline sm:inline">Esporta .FIT</span>
            </button>
          )}

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            title="Settings"
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

