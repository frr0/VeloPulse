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
      className="bg-[#111622] hover:bg-[#151C2C] border border-[#232D42] hover:border-[#384666] rounded-2xl p-5 shadow-lg cursor-pointer transition-all duration-200 group"
    >
      {/* Top Row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase tracking-wider"
              style={{ backgroundColor: `${sportColor}20`, color: sportColor }}
            >
              <SportIcon className="w-3.5 h-3.5" />
              {sportLabel}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {formatDateRelative(activity.start_date_local)}
            </span>
          </div>

          <h4 className="text-base font-bold text-white truncate group-hover:text-[#00E5A3] transition-colors">
            {activity.name}
          </h4>
        </div>

        {/* Training Load Pill */}
        {activity.icu_training_load !== undefined && (
          <div className="flex flex-col items-center bg-[#FC5200]/10 border border-[#FC5200]/30 px-3 py-1.5 rounded-xl shrink-0">
            <span className="text-base font-black text-[#FC5200] leading-none">
              {Math.round(activity.icu_training_load)}
            </span>
            <span className="text-[9px] font-extrabold text-[#FC5200] tracking-wider mt-0.5 uppercase">
              Load
            </span>
          </div>
        )}
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-y border-white/5 my-2">
        {activity.distance ? (
          <div>
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Distance</span>
            <span className="text-base font-black text-white">
              {formatDistance(activity.distance, useImperial)}
            </span>
          </div>
        ) : null}

        <div>
          <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Time</span>
          <span className="text-base font-black text-white">
            {formatDuration(activity.moving_time || activity.elapsed_time)}
          </span>
        </div>

        {activity.average_watts ? (
          <div>
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Avg Power</span>
            <span className="text-base font-black text-white">{formatWatts(activity.average_watts)}</span>
          </div>
        ) : isRun && activity.average_speed ? (
          <div>
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Avg Pace</span>
            <span className="text-base font-black text-white">
              {formatPace(activity.average_speed, useImperial)}
            </span>
          </div>
        ) : activity.average_speed ? (
          <div>
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Avg Speed</span>
            <span className="text-base font-black text-white">
              {formatSpeed(activity.average_speed, useImperial)}
            </span>
          </div>
        ) : null}

        {activity.average_heartrate ? (
          <div>
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Avg HR</span>
            <span className="text-base font-black text-white">
              {formatHeartRate(activity.average_heartrate)}
            </span>
          </div>
        ) : null}
      </div>

      {/* Bottom Sub-tags & Details Arrow */}
      <div className="flex items-center justify-between mt-3 pt-1">
        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
          {activity.total_elevation_gain ? (
            <span className="bg-[#1A2234] px-2 py-0.5 rounded text-[11px] font-medium text-slate-300">
              +{Math.round(activity.total_elevation_gain)}m Elev
            </span>
          ) : null}

          {activity.icu_intensity ? (
            <span className="inline-flex items-center gap-1 bg-[#1A2234] px-2 py-0.5 rounded text-[11px] font-medium text-amber-400">
              <Zap className="w-3 h-3" />
              IF {(activity.icu_intensity > 2 ? activity.icu_intensity / 100 : activity.icu_intensity).toFixed(2)}
            </span>
          ) : null}

          {activity.weighted_average_watts ? (
            <span className="bg-[#1A2234] px-2 py-0.5 rounded text-[11px] font-medium text-slate-300">
              NP {Math.round(activity.weighted_average_watts)}W
            </span>
          ) : null}

          {activity.icu_joules ? (
            <span className="inline-flex items-center gap-1 bg-[#1A2234] px-2 py-0.5 rounded text-[11px] font-medium text-slate-300">
              <Flame className="w-3 h-3 text-amber-500" />
              {Math.round(activity.icu_joules / 1000)} kJ
            </span>
          ) : null}
        </div>

        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
      </div>
    </div>
  );
};
