import {
  Activity,
  Calendar,
  Compass,
  RefreshCw,
  TrendingUp,
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
      <header className="sticky top-0 z-30 bg-[#090a0e]/85 backdrop-blur-md border-b border-white/10">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Brand Logo & Name (matches landing page lockup) */}
          <div
            onClick={() => onSelectTab('dashboard')}
            className="flex items-center gap-2.5 shrink-0 cursor-pointer group"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-7 h-7 shrink-0 transition-transform group-hover:scale-105"
              fill="none"
              stroke="#F1F5F9"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4.5 6.5L12 18.5L19.5 6.5" />
              <path d="M9.5 10.5L12 14.5L14.5 10.5" stroke="#38BDF8" />
            </svg>
            <span className="text-base font-extrabold tracking-tight text-white leading-none">
              VeloLab
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 bg-[#11131b]/90 p-1.5 rounded-full border border-white/10">
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                currentTab === 'dashboard'
                  ? 'bg-[#00E5A3]/15 text-[#00E5A3]'
                  : 'text-[#989dab] hover:text-white hover:bg-white/5'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Today</span>
            </button>

            <button
              onClick={() => onSelectTab('ride')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                currentTab === 'ride'
                  ? 'bg-[#00E5A3]/15 text-[#00E5A3]'
                  : 'text-[#989dab] hover:text-white hover:bg-white/5'
              }`}
            >
              <Zap className={`w-4 h-4 ${currentTab === 'ride' ? 'fill-current' : ''}`} />
              <span>Ride Studio</span>
            </button>

            <button
              onClick={() => onSelectTab('fitness')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                currentTab === 'fitness'
                  ? 'bg-[#00E5A3]/15 text-[#00E5A3]'
                  : 'text-[#989dab] hover:text-white hover:bg-white/5'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Fitness & Form</span>
            </button>

            <button
              onClick={() => onSelectTab('activities')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                currentTab === 'activities'
                  ? 'bg-[#00E5A3]/15 text-[#00E5A3]'
                  : 'text-[#989dab] hover:text-white hover:bg-white/5'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Activities</span>
            </button>

            <button
              onClick={() => onSelectTab('plan')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                currentTab === 'plan'
                  ? 'bg-[#00E5A3]/15 text-[#00E5A3]'
                  : 'text-[#989dab] hover:text-white hover:bg-white/5'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Training Plan</span>
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
              className="w-9 h-9 rounded-xl bg-[#11131b] hover:bg-[#1a1f2e] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#00E5A3]' : ''}`} />
            </button>

            {/* Athlete Avatar (clickable for Profile; hidden in Demo mode) */}
            {!isDemo && (
              <div className="flex items-center gap-2 pl-2 border-l border-white/10">
                <button
                  type="button"
                  onClick={() => onSelectTab('profile')}
                  title="Athlete Profile"
                  className={`rounded-full transition-all cursor-pointer ${
                    currentTab === 'profile'
                      ? 'ring-2 ring-[#00E5A3] ring-offset-2 ring-offset-[#090a0e]'
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
            )}
          </div>
        </div>

        {/* Mobile / Tablet Sub-Navigation Bar (Desktop/Web & iOS) */}
        {!isAndroidApp && (
          <div className="flex lg:hidden items-center justify-around py-2 border-t border-white/10 text-xs overflow-x-auto gap-1">
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`px-3 py-1.5 font-bold rounded-full shrink-0 transition-all ${
                currentTab === 'dashboard' ? 'text-[#00E5A3] bg-[#00E5A3]/15' : 'text-[#989dab]'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => onSelectTab('ride')}
              className={`px-3 py-1.5 font-bold rounded-full shrink-0 flex items-center gap-1 transition-all ${
                currentTab === 'ride' ? 'text-[#00E5A3] bg-[#00E5A3]/15' : 'text-[#989dab]'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Studio</span>
            </button>
            <button
              onClick={() => onSelectTab('fitness')}
              className={`px-3 py-1.5 font-bold rounded-full shrink-0 transition-all ${
                currentTab === 'fitness' ? 'text-[#00E5A3] bg-[#00E5A3]/15' : 'text-[#989dab]'
              }`}
            >
              Fitness
            </button>
            <button
              onClick={() => onSelectTab('activities')}
              className={`px-3 py-1.5 font-bold rounded-full shrink-0 transition-all ${
                currentTab === 'activities' ? 'text-[#00E5A3] bg-[#00E5A3]/15' : 'text-[#989dab]'
              }`}
            >
              Activities
            </button>
            <button
              onClick={() => onSelectTab('plan')}
              className={`px-3 py-1.5 font-bold rounded-full shrink-0 transition-all ${
                currentTab === 'plan' ? 'text-[#00E5A3] bg-[#00E5A3]/15' : 'text-[#989dab]'
              }`}
            >
              Plan
            </button>
          </div>
        )}
      </div>
    </header>

    {/* Mobile Bottom Navigation Bar (Android & iOS) */}
    {isAndroidApp && (
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#090a0e]/95 backdrop-blur-lg border-t border-white/10 px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="grid grid-cols-5 w-full gap-1">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              currentTab === 'dashboard'
                ? 'text-[#00E5A3] bg-[#00E5A3]/15'
                : 'text-[#989dab] hover:text-white'
            }`}
          >
            <Compass className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-bold">Today</span>
          </button>
          <button
            onClick={() => onSelectTab('ride')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              currentTab === 'ride'
                ? 'text-[#00E5A3] bg-[#00E5A3]/15'
                : 'text-[#989dab] hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-bold">Studio</span>
          </button>
          <button
            onClick={() => onSelectTab('fitness')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              currentTab === 'fitness'
                ? 'text-[#00E5A3] bg-[#00E5A3]/15'
                : 'text-[#989dab] hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-bold">Fitness</span>
          </button>
          <button
            onClick={() => onSelectTab('activities')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              currentTab === 'activities'
                ? 'text-[#00E5A3] bg-[#00E5A3]/15'
                : 'text-[#989dab] hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-bold">Activities</span>
          </button>
          <button
            onClick={() => onSelectTab('plan')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              currentTab === 'plan'
                ? 'text-[#00E5A3] bg-[#00E5A3]/15'
                : 'text-[#989dab] hover:text-white'
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
