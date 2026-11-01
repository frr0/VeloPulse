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
        className={`w-full rounded-2xl bg-[#1F2025]/90 border border-[#383941] flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#00E5A3]/40 transition-all shrink-0 ${
          isCompact ? 'p-3 h-36' : 'p-6 h-40 md:h-48'
        }`}
      >
        <div className="flex items-center gap-2 text-sm md:text-base text-[#00E5A3] font-bold">
          <Dumbbell className="w-4 h-4" />
          <span>Tap to Select Workout (.zwo)</span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Free Ride Mode Active • Tap to load interval profile & auto-control ERG resistance
        </p>
      </div>
    );
  }

  const totalDuration = Math.max(1, workout.totalDurationSeconds);

  // Dynamic power scale: adapt directly to workout's peak effort so bars fill vertical height
  const maxPowerPercent = useMemo(() => {
    let max = 0.5;
    workout.intervals.forEach((inv) => {
      max = Math.max(max, inv.powerHigh, inv.powerLow, inv.power);
    });
    return Math.max(max * 1.05, 1.02);
  }, [workout]);

  const chartHeight = 160;
  const chartWidth = 1000;
  const padTop = 8;
  const yBase = chartHeight;
  const drawHeight = yBase - padTop;

  const getX = (sec: number) => (sec / totalDuration) * chartWidth;
  const getY = (powerRatio: number) => {
    const fraction = Math.min(1, Math.max(0, powerRatio / maxPowerPercent));
    return yBase - fraction * drawHeight;
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

  const scrubberX = Math.max(0, Math.min(chartWidth, getX(currentSecond)));

  const formatMmSs = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = Math.floor(totalSec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div
      className={`w-full rounded-2xl bg-[#1F2025]/95 border border-[#383941] shadow-lg backdrop-blur-md flex flex-col overflow-hidden shrink-0 ${
        isCompact ? 'h-36 sm:h-40' : 'h-44 md:h-48'
      }`}
    >
      {/* Workout Header Info */}
      <div className="px-3.5 py-1.5 sm:px-4 sm:py-2 flex items-center justify-between text-xs sm:text-sm leading-none gap-2 min-w-0 bg-[#1F2025] border-b border-[#383941]/50 shrink-0">
        <div
          onClick={onOpenWorkoutModal}
          className="flex items-center gap-1.5 cursor-pointer hover:text-[#00E5A3] transition-colors min-w-0 truncate"
          title="Tap to change workout"
        >
          <Dumbbell className="w-3.5 h-3.5 text-[#00E5A3] shrink-0" />
          <span className="font-black text-slate-100 truncate">
            {workout.title}
          </span>
          <span className="text-slate-400 text-xs shrink-0">
            • {Math.floor(workout.totalDurationSeconds / 60)}m
          </span>
          <span className="text-[#00E5A3] font-semibold text-xs shrink-0 hidden xs:inline sm:inline">
            • TSS {workout.estimatedTss}
          </span>
          <span className="text-amber-400 font-semibold text-xs shrink-0 hidden sm:inline">
            • IF {workout.intensityFactor}
          </span>
        </div>

        {/* FTP threshold line indicator */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0">
          <div className="w-2.5 h-0.5 bg-yellow-400/80 rounded-full" />
          <span className="font-mono text-yellow-400/90 font-bold">{ftp}W</span>
        </div>
      </div>

      {/* SVG Chart - Edge-to-edge full width & vertical fill with zero dead margins */}
      <div className="relative w-full flex-1 overflow-hidden bg-slate-950/70 min-h-0">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-full block"
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
            opacity="0.45"
          />
          <text
            x={chartWidth - 8}
            y={getY(1.0) - 4}
            textAnchor="end"
            fill="#facc15"
            fontSize="9"
            opacity="0.6"
            fontFamily="monospace"
            fontWeight="bold"
          >
            FTP (100%)
          </text>

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

          {/* Intervals polygons (spanning full width from 0 to chartWidth) */}
          {workout.intervals.map((inv, idx) => {
            const x1 = getX(inv.startSecond);
            const x2 = getX(inv.endSecond);
            const y1 = getY(inv.powerLow);
            const y2 = getY(inv.powerHigh);

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
                  fillOpacity={isActive ? 0.94 : 0.55}
                  stroke={isActive ? '#ffffff' : color}
                  strokeWidth={isActive ? 2.5 : 1}
                />

                {/* If active, highlight overlay */}
                {isActive && (
                  <polygon
                    points={points}
                    fill={color}
                    fillOpacity={0.3}
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
            cy="6"
            r="4.5"
            fill="#00E5A3"
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      {/* Timeline labels - Clean integrated footer */}
      <div className="px-3.5 py-1 sm:px-4 sm:py-1.5 flex justify-between items-center text-[10px] sm:text-xs text-slate-400 font-mono leading-none bg-[#1F2025] border-t border-[#383941]/50 shrink-0">
        <span>00:00</span>
        <span>{formatMmSs(totalDuration / 2)}</span>
        <span>{formatMmSs(totalDuration)}</span>
      </div>
    </div>
  );
};
