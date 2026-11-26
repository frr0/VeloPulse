import {
  Activity as ActivityIcon,
  Bike,
  ChevronDown,
  Dumbbell,
  Filter,
  Footprints,
  Search,
  Waves,
  X,
} from 'lucide-react';
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Activity } from '../../types/intervals';
import { formatDistance, formatDuration } from '../../utils/formatters';
import { ActivityCard } from '../ActivityCard';

interface ActivitiesViewProps {
  onSelectActivity: (activity: Activity) => void;
}

type SportCategory = 'ALL' | 'RIDE' | 'RUN' | 'SWIM' | 'WORKOUT';

export const ActivitiesView: React.FC<ActivitiesViewProps> = ({ onSelectActivity }) => {
  const { activities, useImperial } = useApp();
  const [filter, setFilter] = useState<SportCategory>('ALL');
  const [search, setSearch] = useState('');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    if (isFilterDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterDropdownOpen]);

  const filterOptions = [
    { id: 'ALL' as const, label: 'All', icon: ActivityIcon },
    { id: 'RIDE' as const, label: 'Cycling', icon: Bike },
    { id: 'RUN' as const, label: 'Running', icon: Footprints },
    { id: 'SWIM' as const, label: 'Swimming', icon: Waves },
    { id: 'WORKOUT' as const, label: 'Strength', icon: Dumbbell },
  ];

  const currentOption = filterOptions.find((opt) => opt.id === filter) || filterOptions[0];
  const CurrentIcon = currentOption.icon;

  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      const typeLower = (act.type || '').toLowerCase();
      if (filter === 'RIDE' && !typeLower.includes('ride') && !typeLower.includes('cycl')) {
        return false;
      }
      if (filter === 'RUN' && !typeLower.includes('run')) {
        return false;
      }
      if (filter === 'SWIM' && !typeLower.includes('swim')) {
        return false;
      }
      if (
        filter === 'WORKOUT' &&
        !typeLower.includes('weight') &&
        !typeLower.includes('strength') &&
        !typeLower.includes('gym') &&
        !typeLower.includes('workout')
      ) {
        return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const nameMatch = (act.name || '').toLowerCase().includes(q);
        const descMatch = (act.description || '').toLowerCase().includes(q);
        return nameMatch || descMatch;
      }

      return true;
    });
  }, [activities, filter, search]);

  const { totalCount, totalDistance, totalDuration, totalLoad } = useMemo(() => {
    let dist = 0;
    let dur = 0;
    let load = 0;

    filteredActivities.forEach((act) => {
      dist += act.distance || 0;
      dur += act.moving_time || act.elapsed_time || 0;
      load += act.icu_training_load || 0;
    });

    return {
      totalCount: filteredActivities.length,
      totalDistance: dist,
      totalDuration: dur,
      totalLoad: Math.round(load),
    };
  }, [filteredActivities]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header + Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-white/10">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#00E5A3] block mb-1">
            Training Log
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Activities</h2>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto sm:min-w-[360px]">
          {/* Frameless underline search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-0 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activities by name..."
              className="w-full bg-transparent border-b border-white/15 focus:border-[#00E5A3] focus:outline-none pl-7 pr-7 py-2 text-xs text-white placeholder-slate-500 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Minimal pill filter dropdown */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsFilterDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-bold text-white transition-all active:scale-95 cursor-pointer"
            >
              <CurrentIcon className="w-3.5 h-3.5 text-[#00E5A3]" />
              <span>{currentOption.label}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                  isFilterDropdownOpen ? 'rotate-180 text-[#00E5A3]' : ''
                }`}
              />
            </button>

            {isFilterDropdownOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-[#0f121a]/95 backdrop-blur-md border border-white/15 rounded-2xl shadow-2xl z-30 p-1.5 space-y-1 animate-fadeIn">
                {filterOptions.map((item) => {
                  const active = filter === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setFilter(item.id);
                        setIsFilterDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${
                        active
                          ? 'bg-[#00E5A3]/15 text-[#00E5A3]'
                          : 'text-slate-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#00E5A3]' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-[#00E5A3] ml-auto" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Totals Summary Strip (Card-Free Left-Accent Columns) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        <div className="pl-4 border-l-2 border-[#00E5A3]/70">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Activities</span>
          <span className="text-2xl sm:text-3xl font-black text-white tabular-nums">{totalCount}</span>
        </div>
        <div className="pl-4 border-l-2 border-[#38BDF8]/70">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Distance</span>
          <span className="text-2xl sm:text-3xl font-black text-white tabular-nums">{formatDistance(totalDistance, useImperial)}</span>
        </div>
        <div className="pl-4 border-l-2 border-white/25">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Time</span>
          <span className="text-2xl sm:text-3xl font-black text-white tabular-nums">{formatDuration(totalDuration)}</span>
        </div>
        <div className="pl-4 border-l-2 border-[#FC5200]/70">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Load</span>
          <span className="text-2xl sm:text-3xl font-black text-[#FC5200] tabular-nums">{totalLoad}</span>
        </div>
      </div>

      {/* Activities Hairline List */}
      <div className="border-t border-white/10">
        {filteredActivities.length === 0 ? (
          <div className="py-16 text-center">
            <ActivityIcon className="w-9 h-9 text-slate-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">No activities found</h3>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your search query or sport filter.</p>
          </div>
        ) : (
          filteredActivities.map((act) => (
            <ActivityCard
              key={act.id}
              activity={act}
              useImperial={useImperial}
              onSelect={onSelectActivity}
            />
          ))
        )}
      </div>
    </div>
  );
};
