import { Activity as ActivityIcon, Bike, ChevronRight, Dumbbell, Flame, Footprints, Waves, Zap } from 'lucide-react';
import React from 'react';
import { Activity } from '../types/intervals';
import {
  formatDateRelative,
  formatDistance,
  formatDuration,
  formatHeartRate,
  formatPace,
  formatSpeed,
  formatWatts,
} from '../utils/formatters';

interface ActivityCardProps {
  activity: Activity;
  useImperial?: boolean;
  onSelect: (activity: Activity) => void;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({
  activity,
  useImperial = false,
  onSelect,
}) => {
  const typeLower = (activity.type || '').toLowerCase();
  const isRun = typeLower.includes('run');
  const isRide = typeLower.includes('ride') || typeLower.includes('cycl');
  const isSwim = typeLower.includes('swim');
  const isGym = typeLower.includes('weight') || typeLower.includes('strength') || typeLower.includes('gym');

  let SportIcon = ActivityIcon;
  let sportColor = '#FC5200';
  let sportLabel = 'Workout';

  if (isRide) {
    SportIcon = Bike;
    sportColor = '#FC5200';
    sportLabel = 'Cycling';
  } else if (isRun) {
    SportIcon = Footprints;
    sportColor = '#00E5A3';
    sportLabel = 'Running';
  } else if (isSwim) {
    SportIcon = Waves;
    sportColor = '#00B4D8';
    sportLabel = 'Swimming';
  } else if (isGym) {
    SportIcon = Dumbbell;
    sportColor = '#8B5CF6';
    sportLabel = 'Strength';
  }

  return (
    <div
      onClick={() => onSelect(activity)}
      className="bg-[#1F2025] hover:bg-[#26272D] border border-[#383941] hover:border-[#384666] rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-md cursor-pointer transition-all duration-200 group flex flex-col gap-1.5"
    >
      {/* Top Row: Sport Badge + Date + Title + Load Pill */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider shrink-0"
            style={{ backgroundColor: `${sportColor}20`, color: sportColor }}
          >
            <SportIcon className="w-3 h-3" />
            {sportLabel}
          </span>
          <span className="text-[11px] text-slate-400 font-medium shrink-0">
            {formatDateRelative(activity.start_date_local)}
          </span>
          <h4 className="text-sm font-bold text-white truncate group-hover:text-[#00E5A3] transition-colors">
            {activity.name}
          </h4>
        </div>

        {/* Training Load Pill */}
        {activity.icu_training_load !== undefined && (
          <div className="flex items-center gap-1 bg-[#FC5200]/10 border border-[#FC5200]/30 px-2 py-0.5 rounded-lg shrink-0">
            <span className="text-xs font-black text-[#FC5200] leading-none">
              {Math.round(activity.icu_training_load)}
            </span>
            <span className="text-[9px] font-extrabold text-[#FC5200] uppercase">
              Load
            </span>
          </div>
        )}
      </div>

      {/* Bottom Row: Metrics Strip + Sub-tags + Details Arrow */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5 text-xs">
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          {activity.distance ? (
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Dist</span>
              <span className="text-xs sm:text-sm font-black text-white">
                {formatDistance(activity.distance, useImperial)}
              </span>
            </div>
          ) : null}

          <div className="flex items-baseline gap-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Time</span>
            <span className="text-xs sm:text-sm font-black text-white">
              {formatDuration(activity.moving_time || activity.elapsed_time)}
            </span>
          </div>

          {activity.average_watts ? (
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Avg W</span>
              <span className="text-xs sm:text-sm font-black text-white">{formatWatts(activity.average_watts)}</span>
            </div>
          ) : isRun && activity.average_speed ? (
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Pace</span>
              <span className="text-xs sm:text-sm font-black text-white">
                {formatPace(activity.average_speed, useImperial)}
              </span>
            </div>
          ) : activity.average_speed ? (
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Speed</span>
              <span className="text-xs sm:text-sm font-black text-white">
                {formatSpeed(activity.average_speed, useImperial)}
              </span>
            </div>
          ) : null}

          {activity.average_heartrate ? (
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">HR</span>
              <span className="text-xs sm:text-sm font-black text-white">
                {formatHeartRate(activity.average_heartrate)}
              </span>
            </div>
          ) : null}

          {activity.total_elevation_gain ? (
            <span className="hidden md:inline bg-[#2F3037] px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-300">
              +{Math.round(activity.total_elevation_gain)}m Elev
            </span>
          ) : null}

          {activity.icu_intensity ? (
            <span className="hidden md:inline bg-[#2F3037] px-1.5 py-0.5 rounded text-[10px] font-medium text-amber-400">
              IF {(activity.icu_intensity > 2 ? activity.icu_intensity / 100 : activity.icu_intensity).toFixed(2)}
            </span>
          ) : null}
        </div>

        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" />
      </div>
    </div>
  );
};
