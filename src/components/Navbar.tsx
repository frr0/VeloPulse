import {
  Activity,
  Calendar,
  Compass,
  RefreshCw,
  TrendingUp,
  User,
  Zap,
} from 'lucide-react';
import React from 'react';
import { useApp } from '../context/AppContext';
import { BluetoothDevicesState } from '../types';
import { isAndroid } from '../utils/platform';

export type NavTab = 'dashboard' | 'ride' | 'fitness' | 'activities' | 'plan' | 'profile';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  devicesState?: BluetoothDevicesState;
  onOpenBluetooth?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
}) => {
  const {
    athlete,
    credentials,
    isRefreshing,
    refreshData,
  } = useApp();

  const isDemo = credentials?.isDemo;
  const displayName = athlete?.firstname || athlete?.name || 'Athlete';
  const isAndroidApp = isAndroid();

  return (
    <>
      <header className="sticky top-0 z-30 bg-[#131316]/95 backdrop-blur-md border-b border-[#383941]">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Brand Logo & Name */}
          <div
            onClick={() => onSelectTab('dashboard')}
            className="flex items-center gap-2.5 shrink-0 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-2xl bg-[#A8C7FA]/15 border border-[#A8C7FA]/30 flex items-center justify-center text-[#A8C7FA] group-hover:bg-[#A8C7FA]/25 transition-all">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-none">
                <span className="text-sm font-black tracking-tight text-white block">
                  VELO<span className="text-[#A8C7FA]">PULSE</span>
                </span>
                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#2F3037] text-[#A8C7FA] border border-[#A8C7FA]/20">
                  SUITE
                </span>
              </div>
              <span className="text-[10px] font-medium text-[#9E9EA7] leading-tight block mt-0.5">
                Indoor Studio & Intervals
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 bg-[#1F2025] p-1.5 rounded-full border border-[#383941]">
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                currentTab === 'dashboard'
                  ? 'bg-[#A8C7FA]/15 text-[#A8C7FA]'
                  : 'text-[#9E9EA7] hover:text-white hover:bg-white/5'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Today</span>
            </button>

            <button
              onClick={() => onSelectTab('ride')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                currentTab === 'ride'
                  ? 'bg-[#A8C7FA]/15 text-[#A8C7FA]'
                  : 'text-[#9E9EA7] hover:text-white hover:bg-white/5'
              }`}
            >
              <Zap className={`w-4 h-4 ${currentTab === 'ride' ? 'fill-current' : ''}`} />
              <span>Ride Studio</span>
            </button>

            <button
              onClick={() => onSelectTab('fitness')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                currentTab === 'fitness'
                  ? 'bg-[#A8C7FA]/15 text-[#A8C7FA]'
                  : 'text-[#9E9EA7] hover:text-white hover:bg-white/5'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Fitness & Form</span>
            </button>

            <button
              onClick={() => onSelectTab('activities')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                currentTab === 'activities'
                  ? 'bg-[#A8C7FA]/15 text-[#A8C7FA]'
                  : 'text-[#9E9EA7] hover:text-white hover:bg-white/5'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Activities</span>
            </button>

            <button
              onClick={() => onSelectTab('plan')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                currentTab === 'plan'
                  ? 'bg-[#A8C7FA]/15 text-[#A8C7FA]'
                  : 'text-[#9E9EA7] hover:text-white hover:bg-white/5'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Training Plan</span>
            </button>

            <button
              onClick={() => onSelectTab('profile')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                currentTab === 'profile'
                  ? 'bg-[#A8C7FA]/15 text-[#A8C7FA]'
                  : 'text-[#9E9EA7] hover:text-white hover:bg-white/5'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Athlete</span>
            </button>
          </nav>

          {/* Right Action Icons & Hardware Indicators */}
          <div className="flex items-center gap-2">
            {/* Status Pill */}
            <span
              className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                isDemo
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-[#00E5A3]/10 text-[#00E5A3] border border-[#00E5A3]/20'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${isDemo ? 'bg-amber-400' : 'bg-[#00E5A3] animate-pulse'}`}
              />
              {isDemo ? 'Demo Mode' : 'Live API'}
            </span>

            {/* Sync Button */}
            <button
              onClick={refreshData}
              disabled={isRefreshing}
              title="Sync Data from Intervals.icu"
              className="w-9 h-9 rounded-xl bg-[#1F2025] hover:bg-[#2F3037] border border-[#383941] flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#00E5A3]' : ''}`} />
            </button>

            {/* Athlete Avatar (clickable for Profile) */}
            <div className="flex items-center gap-2 pl-2 border-l border-white/10">
              <button
                type="button"
                onClick={() => onSelectTab('profile')}
                title="Vai al profilo atleta"
                className={`rounded-full transition-all cursor-pointer ${
                  currentTab === 'profile'
                    ? 'ring-2 ring-[#00E5A3] ring-offset-2 ring-offset-[#131316]'
                    : 'hover:opacity-85'
                }`}
              >
                {athlete?.profile_medium ? (
                  <img
                    src={athlete.profile_medium}
                    alt={displayName}
                    className="w-8 h-8 rounded-full border border-[#00E5A3] object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#2F3037] border border-[#383941] flex items-center justify-center text-[#00E5A3] font-bold text-xs">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile / Tablet Sub-Navigation Bar (Desktop/Web & iOS) */}
        {!isAndroidApp && (
          <div className="flex lg:hidden items-center justify-around py-2 border-t border-[#383941]/60 text-xs overflow-x-auto gap-1">
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`px-3 py-1.5 font-bold rounded-full shrink-0 transition-all ${
                currentTab === 'dashboard' ? 'text-[#A8C7FA] bg-[#A8C7FA]/15' : 'text-[#9E9EA7]'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => onSelectTab('ride')}
              className={`px-3 py-1.5 font-bold rounded-full shrink-0 flex items-center gap-1 transition-all ${
                currentTab === 'ride' ? 'text-[#A8C7FA] bg-[#A8C7FA]/15' : 'text-[#9E9EA7]'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Studio</span>
            </button>
            <button
              onClick={() => onSelectTab('fitness')}
              className={`px-3 py-1.5 font-bold rounded-full shrink-0 transition-all ${
                currentTab === 'fitness' ? 'text-[#A8C7FA] bg-[#A8C7FA]/15' : 'text-[#9E9EA7]'
              }`}
            >
              Fitness
            </button>
            <button
              onClick={() => onSelectTab('activities')}
              className={`px-3 py-1.5 font-bold rounded-full shrink-0 transition-all ${
                currentTab === 'activities' ? 'text-[#A8C7FA] bg-[#A8C7FA]/15' : 'text-[#9E9EA7]'
              }`}
            >
              Activities
            </button>
            <button
              onClick={() => onSelectTab('plan')}
              className={`px-3 py-1.5 font-bold rounded-full shrink-0 transition-all ${
                currentTab === 'plan' ? 'text-[#A8C7FA] bg-[#A8C7FA]/15' : 'text-[#9E9EA7]'
              }`}
            >
              Plan
            </button>
            <button
              onClick={() => onSelectTab('profile')}
              className={`px-3 py-1.5 font-bold rounded-full shrink-0 transition-all ${
                currentTab === 'profile' ? 'text-[#A8C7FA] bg-[#A8C7FA]/15' : 'text-[#9E9EA7]'
              }`}
            >
              Profile
            </button>
          </div>
        )}
      </div>
    </header>

    {/* Android Bottom Navigation Bar */}
    {isAndroidApp && (
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#131316]/95 backdrop-blur-lg border-t border-[#383941] px-2 py-1.5 shadow-2xl">
        <div className="grid grid-cols-5 w-full gap-1">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              currentTab === 'dashboard'
                ? 'text-[#A8C7FA] bg-[#A8C7FA]/15'
                : 'text-[#9E9EA7] hover:text-white'
            }`}
          >
            <Compass className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-bold">Today</span>
          </button>
          <button
            onClick={() => onSelectTab('ride')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              currentTab === 'ride'
                ? 'text-[#A8C7FA] bg-[#A8C7FA]/15'
                : 'text-[#9E9EA7] hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-bold">Studio</span>
          </button>
          <button
            onClick={() => onSelectTab('fitness')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              currentTab === 'fitness'
                ? 'text-[#A8C7FA] bg-[#A8C7FA]/15'
                : 'text-[#9E9EA7] hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-bold">Fitness</span>
          </button>
          <button
            onClick={() => onSelectTab('activities')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              currentTab === 'activities'
                ? 'text-[#A8C7FA] bg-[#A8C7FA]/15'
                : 'text-[#9E9EA7] hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-bold">Activities</span>
          </button>
          <button
            onClick={() => onSelectTab('plan')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              currentTab === 'plan'
                ? 'text-[#A8C7FA] bg-[#A8C7FA]/15'
                : 'text-[#9E9EA7] hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-bold">Plan</span>
          </button>
        </div>
      </nav>
    )}
  </>
  );
};
