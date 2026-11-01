import React, { useMemo } from 'react';
import { ParsedWorkout, WorkoutInterval } from '../types';
import { POWER_ZONES_CONFIG } from '../utils/zones';
import { Dumbbell } from 'lucide-react';

interface WorkoutProfileChartProps {
  workout: ParsedWorkout | null;
  currentSecond: number;
  currentIntervalIndex: number;
  ftp: number;
  onSelectInterval?: (index: number) => void;
  onOpenWorkoutModal?: () => void;
  isCompact?: boolean;
}

export const WorkoutProfileChart: React.FC<WorkoutProfileChartProps> = ({
  workout,
  currentSecond,
  currentIntervalIndex,
  ftp,
  onSelectInterval,
  onOpenWorkoutModal,
  isCompact = false,
}) => {
  if (!workout || workout.intervals.length === 0) {
    return (
      <div
        onClick={onOpenWorkoutModal}
        className={`w-full rounded-xl bg-[#111622]/90 border border-[#232D42] flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#00E5A3]/40 transition-all ${
          isCompact ? 'p-2.5 h-20' : 'p-4 h-32 md:h-40'
        }`}
      >
        <div className="flex items-center gap-1.5 text-xs text-[#00E5A3] font-bold">
          <Dumbbell className="w-3.5 h-3.5" />
          <span>Tap to Select Workout (.zwo)</span>
        </div>
        <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
          Free Ride Mode Active • Tap to load interval profile
        </p>
      </div>
    );
  }

  const totalDuration = Math.max(1, workout.totalDurationSeconds);

  // Determine max power scale (at least 120% FTP, or higher if high intervals exist)
  const maxPowerPercent = useMemo(() => {
    let max = 1.25;
    workout.intervals.forEach((inv) => {
      max = Math.max(max, inv.powerHigh, inv.powerLow, inv.power);
    });
    return max * 1.1; // Add 10% headroom
  }, [workout]);

  // Compute SVG polygons/rectangles for each interval
  const chartHeight = 120; // SVG coordinate units
  const chartWidth = 1000;

  const getX = (sec: number) => (sec / totalDuration) * chartWidth;
  const getY = (powerRatio: number) => {
    const fraction = Math.min(1, Math.max(0, powerRatio / maxPowerPercent));
    return chartHeight - fraction * (chartHeight - 14);
  };

  const getZoneColor = (powerRatio: number): string => {
    const ratio = powerRatio;
    if (ratio <= 0.55) return POWER_ZONES_CONFIG[0].color;
    if (ratio <= 0.75) return POWER_ZONES_CONFIG[1].color;
    if (ratio <= 0.90) return POWER_ZONES_CONFIG[2].color;
    if (ratio <= 1.05) return POWER_ZONES_CONFIG[3].color;
    if (ratio <= 1.20) return POWER_ZONES_CONFIG[4].color;
    if (ratio <= 1.50) return POWER_ZONES_CONFIG[5].color;
    return POWER_ZONES_CONFIG[6].color;
  };

  const scrubberX = getX(Math.min(currentSecond, totalDuration));

  return (
    <div
      className={`w-full rounded-xl bg-[#111622]/95 border border-[#232D42] shadow-lg backdrop-blur-md ${
        isCompact ? 'p-2 sm:p-2.5' : 'p-4'
      }`}
    >
      {/* Workout Header Info */}
      <div
        className={`flex items-center justify-between text-xs leading-none ${
          isCompact ? 'mb-1.5' : 'mb-3'
        }`}
      >
        <div
          onClick={onOpenWorkoutModal}
          className="flex items-center gap-1.5 cursor-pointer hover:text-[#00E5A3] transition-colors overflow-hidden"
          title="Tap to change workout"
        >
          <Dumbbell className="w-3 h-3 text-[#00E5A3] shrink-0" />
          <span className="font-bold text-slate-100 truncate max-w-[150px] sm:max-w-xs md:max-w-md">
            {workout.title}
          </span>
          <span className="text-slate-400 text-[10px] shrink-0">
            • {Math.floor(workout.totalDurationSeconds / 60)}m
          </span>
          <span className="text-[#00E5A3] font-semibold text-[10px] shrink-0">
            • TSS {workout.estimatedTss}
          </span>
          <span className="text-amber-400 font-semibold text-[10px] shrink-0">
            • IF {workout.intensityFactor}
          </span>
        </div>

        {/* FTP threshold line indicator */}
        <div className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0">
          <div className="w-2.5 h-0.5 bg-yellow-400/80" />
          <span>{ftp}W</span>
        </div>
      </div>

      {/* SVG Chart */}
      <div
        className={`relative w-full overflow-hidden rounded-lg bg-slate-950/80 border border-[#232D42]/80 ${
          isCompact ? 'h-16 sm:h-20' : 'h-32 md:h-40'
        }`}
      >
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-full preserve-3d"
          preserveAspectRatio="none"
        >
          {/* Subtle grid lines */}
          <line
            x1="0"
            y1={getY(1.0)}
            x2={chartWidth}
            y2={getY(1.0)}
            stroke="#facc15"
            strokeDasharray="4 4"
            strokeWidth="1.2"
            opacity="0.4"
          />
          <line
            x1="0"
            y1={getY(0.75)}
            x2={chartWidth}
            y2={getY(0.75)}
            stroke="#38bdf8"
            strokeDasharray="2 4"
            strokeWidth="0.8"
            opacity="0.25"
          />

          {/* Intervals polygons */}
          {workout.intervals.map((inv, idx) => {
            const x1 = getX(inv.startSecond);
            const x2 = getX(inv.endSecond);
            const y1 = getY(inv.powerLow);
            const y2 = getY(inv.powerHigh);
            const yBase = chartHeight;

            const avgPowerRatio = (inv.powerLow + inv.powerHigh) / 2;
            const color = getZoneColor(avgPowerRatio);
            const isActive = idx === currentIntervalIndex;

            const points = `${x1},${yBase} ${x1},${y1} ${x2},${y2} ${x2},${yBase}`;

            return (
              <g
                key={inv.id}
                onClick={() => onSelectInterval?.(idx)}
                className="cursor-pointer transition-opacity duration-200"
              >
                {/* Interval Fill */}
                <polygon
                  points={points}
                  fill={color}
                  fillOpacity={isActive ? 0.9 : 0.45}
                  stroke={isActive ? '#ffffff' : color}
                  strokeWidth={isActive ? 2 : 0.8}
                />

                {/* If active, glow highlight */}
                {isActive && (
                  <polygon
                    points={points}
                    fill={color}
                    fillOpacity={0.25}
                  />
                )}
              </g>
            );
          })}

          {/* Elapsed Progress Shade */}
          <rect
            x="0"
            y="0"
            width={scrubberX}
            height={chartHeight}
            fill="#ffffff"
            fillOpacity="0.08"
          />

          {/* Scrubber / Current Position Line */}
          <line
            x1={scrubberX}
            y1="0"
            x2={scrubberX}
            y2={chartHeight}
            stroke="#ffffff"
            strokeWidth="2.5"
          />
          <circle
            cx={scrubberX}
            cy="5"
            r="4"
            fill="#00E5A3"
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      {/* Timeline labels */}
      <div
        className={`flex justify-between items-center text-[10px] text-slate-400 font-mono leading-none ${
          isCompact ? 'mt-1' : 'mt-2'
        }`}
      >
        <span>00:00</span>
        <span>
          {Math.floor(workout.totalDurationSeconds / 120)}:00
        </span>
        <span>
          {Math.floor(workout.totalDurationSeconds / 60)}:
          {String(workout.totalDurationSeconds % 60).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
};
