import {
  Activity as ActivityIcon,
  Bike,
  Dumbbell,
  Footprints,
  Search,
  Waves,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
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
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search activities by name..."
            className="w-full bg-[#111622] border border-[#232D42] focus:border-[#00E5A3] focus:outline-none rounded-xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-slate-500 transition-colors"
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

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-[#111622] p-1 rounded-xl border border-[#232D42] overflow-x-auto">
          {[
            { id: 'ALL', label: 'All', icon: null },
            { id: 'RIDE', label: 'Cycling', icon: Bike },
            { id: 'RUN', label: 'Running', icon: Footprints },
            { id: 'SWIM', label: 'Swimming', icon: Waves },
            { id: 'WORKOUT', label: 'Strength', icon: Dumbbell },
          ].map((item) => {
            const active = filter === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setFilter(item.id as SportCategory)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                  active
                    ? 'bg-[#00E5A3] text-[#080A0F]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Totals Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#111622] p-4 rounded-2xl border border-[#232D42] text-center shadow-md">
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
      <div className="space-y-3">
        {filteredActivities.length === 0 ? (
          <div className="bg-[#111622] rounded-2xl p-12 border border-[#232D42] text-center">
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
