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
    { id: 'ALL' as const, label: 'Tutte', icon: ActivityIcon },
    { id: 'RIDE' as const, label: 'Ciclismo', icon: Bike },
    { id: 'RUN' as const, label: 'Corsa', icon: Footprints },
    { id: 'SWIM' as const, label: 'Nuoto', icon: Waves },
    { id: 'WORKOUT' as const, label: 'Palestra', icon: Dumbbell },
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
    <div className="space-y-6 animate-fadeIn">
      {/* Search & Filter Bar on single row */}
      <div className="flex items-center gap-2.5 w-full">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca attività per nome..."
            className="w-full bg-[#1F2025] border border-[#383941] focus:border-[#00E5A3] focus:outline-none rounded-xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-slate-500 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dropdown Button beside search */}
        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsFilterDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#1F2025] hover:bg-[#2F3037] border border-[#383941] text-xs font-bold text-white transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <CurrentIcon className="w-4 h-4 text-[#00E5A3]" />
            <span>{currentOption.label}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                isFilterDropdownOpen ? 'rotate-180 text-[#00E5A3]' : ''
              }`}
            />
          </button>

          {/* Dropdown Menu Modal */}
          {isFilterDropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-44 bg-[#1F2025] border border-[#383941] rounded-2xl shadow-2xl z-30 p-1.5 space-y-1 animate-fadeIn">
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
                        ? 'bg-[#00E5A3]/15 text-[#00E5A3] border border-[#00E5A3]/30'
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

      {/* Totals Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#1F2025] p-4 rounded-2xl border border-[#383941] text-center shadow-md">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Activities</span>
          <span className="text-xl font-black text-white">{totalCount}</span>
        </div>
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Distance</span>
          <span className="text-xl font-black text-white">{formatDistance(totalDistance, useImperial)}</span>
        </div>
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Time</span>
          <span className="text-xl font-black text-white">{formatDuration(totalDuration)}</span>
        </div>
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Load</span>
          <span className="text-xl font-black text-[#FC5200]">{totalLoad}</span>
        </div>
      </div>

      {/* Activities Grid / List */}
      <div className="space-y-2.5">
        {filteredActivities.length === 0 ? (
          <div className="bg-[#1F2025] rounded-2xl p-12 border border-[#383941] text-center">
            <ActivityIcon className="w-10 h-10 text-slate-500 mx-auto mb-3" />
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
