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
      className="py-3.5 px-3 border-b border-white/10 border-l-2 border-l-transparent hover:border-l-[#00E5A3] hover:bg-white/[0.025] cursor-pointer transition-all duration-150 group flex flex-col gap-2"
    >
      {/* Top Row: Sport Pill + Date + Title + Load */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0"
            style={{ backgroundColor: `${sportColor}18`, color: sportColor }}
          >
            <SportIcon className="w-3 h-3" />
            {sportLabel}
          </span>
          <h4 className="text-sm sm:text-base font-bold text-white truncate group-hover:text-[#00E5A3] transition-colors">
            {activity.name}
          </h4>
          <span className="text-xs text-[#989dab] font-mono shrink-0 hidden sm:inline">
            &middot; {formatDateRelative(activity.start_date_local)}
          </span>
        </div>

        {/* Training Load */}
        <div className="flex items-center gap-3 shrink-0">
          {activity.icu_training_load !== undefined && (
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-sm font-black text-[#FC5200]">
                {Math.round(activity.icu_training_load)}
              </span>
              <span className="text-[10px] font-bold text-[#989dab] uppercase">TSS</span>
            </div>
          )}
          <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-[#00E5A3] group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>

      {/* Bottom Row: Clean inline metrics strip */}
      <div className="flex items-center gap-5 sm:gap-7 flex-wrap text-xs font-mono text-[#989dab]">
        <span className="sm:hidden text-[11px]">{formatDateRelative(activity.start_date_local)}</span>
        {activity.distance ? (
          <span>
            <span className="text-[10px] uppercase mr-1.5">Dist</span>
            <strong className="text-white font-bold">{formatDistance(activity.distance, useImperial)}</strong>
          </span>
        ) : null}

        <span>
          <span className="text-[10px] uppercase mr-1.5">Time</span>
          <strong className="text-white font-bold">
            {formatDuration(activity.moving_time || activity.elapsed_time)}
          </strong>
        </span>

        {activity.average_watts ? (
          <span>
            <span className="text-[10px] uppercase mr-1.5">Avg</span>
            <strong className="text-white font-bold">{formatWatts(activity.average_watts)}</strong>
          </span>
        ) : isRun && activity.average_speed ? (
          <span>
            <span className="text-[10px] uppercase mr-1.5">Pace</span>
            <strong className="text-white font-bold">{formatPace(activity.average_speed, useImperial)}</strong>
          </span>
        ) : activity.average_speed ? (
          <span>
            <span className="text-[10px] uppercase mr-1.5">Speed</span>
            <strong className="text-white font-bold">{formatSpeed(activity.average_speed, useImperial)}</strong>
          </span>
        ) : null}

        {activity.average_heartrate ? (
          <span>
            <span className="text-[10px] uppercase mr-1.5">HR</span>
            <strong className="text-white font-bold">{formatHeartRate(activity.average_heartrate)}</strong>
          </span>
        ) : null}

        {activity.total_elevation_gain ? (
          <span className="hidden md:inline text-slate-400">
            +{Math.round(activity.total_elevation_gain)}m
          </span>
        ) : null}

        {activity.icu_intensity ? (
          <span className="hidden md:inline text-amber-400/90 font-semibold">
            IF {(activity.icu_intensity > 2 ? activity.icu_intensity / 100 : activity.icu_intensity).toFixed(2)}
          </span>
        ) : null}
      </div>
    </div>
  );
};
