import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  heightClassName?: string;
  variant?: 'card' | 'hud';
}

interface PlotSize {
  width: number;
  height: number;
}

interface WorkoutProfilePlotProps {
  workout: ParsedWorkout;
  width: number;
  height: number;
  currentSecond: number;
  currentIntervalIndex: number;
  maxPowerPercent: number;
  isCompact: boolean;
  onSelectInterval?: (index: number) => void;
}

const getZoneColor = (powerRatio: number): string => {
  if (powerRatio <= 0.55) return POWER_ZONES_CONFIG[0].color;
  if (powerRatio <= 0.75) return POWER_ZONES_CONFIG[1].color;
  if (powerRatio <= 0.90) return POWER_ZONES_CONFIG[2].color;
  if (powerRatio <= 1.05) return POWER_ZONES_CONFIG[3].color;
  if (powerRatio <= 1.20) return POWER_ZONES_CONFIG[4].color;
  if (powerRatio <= 1.50) return POWER_ZONES_CONFIG[5].color;
  return POWER_ZONES_CONFIG[6].color;
};

/**
 * Draws the interval profile 1:1 in the measured pixel size of its container.
 * The viewBox matches the real size, so the drawing is never stretched:
 * horizontal span stays proportional to interval duration while ramps keep
 * their slope and strokes keep a uniform thickness.
 */
const WorkoutProfilePlot: React.FC<WorkoutProfilePlotProps> = ({
  workout,
  width,
  height,
  currentSecond,
  currentIntervalIndex,
  maxPowerPercent,
  isCompact,
  onSelectInterval,
}) => {
  const totalDuration = Math.max(1, workout.totalDurationSeconds);

  // Breathing room above the peak and below the baseline, scaled to the box.
  const padTop = Math.max(12, Math.min(18, height * 0.12));
  const padBottom = Math.max(6, Math.min(12, height * 0.07));
  const yBase = Math.max(1, height - padBottom);
  const drawHeight = Math.max(1, yBase - padTop);

  const getX = (sec: number) => (sec / totalDuration) * width;
  const getY = (powerRatio: number) => {
    const fraction = Math.min(1, Math.max(0, powerRatio / maxPowerPercent));
    return yBase - fraction * drawHeight;
  };

  const ftpY = getY(1.0);
  const scrubberX = Math.max(0, Math.min(width, getX(currentSecond)));

  const ftpLabelWidth = 62;
  const ftpLabelHeight = 14;
  const ftpLabelY = Math.max(1, Math.min(ftpY - ftpLabelHeight - 3, yBase - ftpLabelHeight));

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="absolute inset-0 block"
    >
      {/* Endurance guide line (75% FTP) */}
      <line
        x1="0"
        y1={getY(0.75)}
        x2={width}
        y2={getY(0.75)}
        stroke="#A8C7FA"
        strokeDasharray="2 4"
        strokeWidth="1"
        opacity="0.22"
      />

      {/* FTP threshold line */}
      <line
        x1="0"
        y1={ftpY}
        x2={width}
        y2={ftpY}
        stroke="#facc15"
        strokeDasharray="4 4"
        strokeWidth="1"
        opacity="0.45"
      />

      {!isCompact && (
        <g>
          <rect
            x={width - ftpLabelWidth - 6}
            y={ftpLabelY}
            width={ftpLabelWidth}
            height={ftpLabelHeight}
            rx="4"
            fill="#1F2025"
            fillOpacity="0.85"
          />
          <text
            x={width - 11}
            y={ftpLabelY + ftpLabelHeight - 4}
            textAnchor="end"
            fill="#facc15"
            fontSize="10"
            opacity="0.85"
            fontFamily="monospace"
            fontWeight="bold"
          >
            FTP (100%)
          </text>
        </g>
      )}

      {/* Interval polygons: width proportional to duration, slopes undistorted */}
      {workout.intervals.map((inv: WorkoutInterval, idx: number) => {
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
              strokeWidth={isActive ? 2 : 1}
              strokeLinejoin="round"
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

      {/* Baseline the profile rests on */}
      <line
        x1="0"
        y1={yBase}
        x2={width}
        y2={yBase}
        stroke="#383941"
        strokeWidth="1"
      />

      {/* Elapsed Progress Shade */}
      <rect
        x="0"
        y="0"
        width={scrubberX}
        height={height}
        fill="#ffffff"
        fillOpacity="0.08"
      />

      {/* Scrubber / Current Position Line */}
      <line
        x1={scrubberX}
        y1="0"
        x2={scrubberX}
        y2={height}
        stroke="#ffffff"
        strokeWidth="2"
      />
      <circle
        cx={scrubberX}
        cy="6"
        r="4"
        fill="#00E5A3"
        stroke="#ffffff"
        strokeWidth="1.5"
      />
    </svg>
  );
};

export const WorkoutProfileChart: React.FC<WorkoutProfileChartProps> = ({
  workout,
  currentSecond,
  currentIntervalIndex,
  ftp,
  onSelectInterval,
  onOpenWorkoutModal,
  isCompact = false,
  heightClassName,
  variant = 'card',
}) => {
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotSize, setPlotSize] = useState<PlotSize | null>(null);

  const hasWorkout = !!workout && workout.intervals.length > 0;

  // Dynamic power scale: adapt directly to workout's peak effort
  const maxPowerPercent = useMemo(() => {
    let max = 0.5;
    workout?.intervals.forEach((inv: WorkoutInterval) => {
      max = Math.max(max, inv.powerHigh, inv.powerLow, inv.power);
    });
    return Math.max(max * 1.05, 1.02);
  }, [workout]);

  // Measure the plot area so the SVG can be drawn in real pixels (no stretching)
  useEffect(() => {
    const node = plotRef.current;
    if (!node) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      const { width, height } = entry.contentRect;
      setPlotSize((prev) => {
        if (prev && Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5) {
          return prev;
        }
        return { width: Math.round(width), height: Math.round(height) };
      });
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasWorkout]);

  if (!workout || workout.intervals.length === 0) {
    if (variant === 'hud') {
      return (
        <button
          type="button"
          onClick={onOpenWorkoutModal}
          className="text-left pl-3 border-l-[3px] border-[#00E5A3] py-1 group cursor-pointer"
          style={{ textShadow: '0 2px 10px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.95)' }}
        >
          <div className="flex items-center gap-1.5 text-sm font-black text-white group-hover:text-[#00E5A3] transition-colors">
            <Dumbbell className="w-4 h-4 text-[#00E5A3]" />
            <span>Scegli Workout (.zwo)</span>
          </div>
          <div className="text-[11px] font-bold text-white/80 mt-0.5">
            Free Ride attivo • Clicca per caricare un allenamento
          </div>
        </button>
      );
    }
    return (
      <div
        onClick={onOpenWorkoutModal}
        className={`w-full rounded-xl sm:rounded-2xl bg-[#1F2025]/85 backdrop-blur-md border border-[#383941] flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#00E5A3]/40 transition-all p-3 ${
          heightClassName || 'h-32 sm:h-40 md:h-44'
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

  const formatMmSs = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = Math.floor(totalSec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  if (variant === 'hud') {
    const hudShadow: React.CSSProperties = {
      textShadow: '0 2px 10px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.95)',
    };
    return (
      <div
        className={`w-full pl-3 border-l-[3px] border-[#00E5A3] flex flex-col overflow-hidden ${
          heightClassName || 'h-28 sm:h-32'
        }`}
      >
        {/* Frameless HUD Header */}
        <div
          className="flex items-center justify-between gap-2 pb-1 text-xs leading-none shrink-0"
          style={hudShadow}
        >
          <button
            type="button"
            onClick={onOpenWorkoutModal}
            className="flex items-center gap-1.5 min-w-0 truncate text-left hover:text-[#00E5A3] transition-colors"
            title="Cambia workout"
          >
            <Dumbbell className="w-3.5 h-3.5 text-[#00E5A3] shrink-0" />
            <span className="font-black text-white truncate">{workout.title}</span>
            <span className="text-white/80 font-mono text-[11px] shrink-0">
              • {Math.floor(workout.totalDurationSeconds / 60)}m
            </span>
          </button>
          <span className="font-mono font-extrabold text-yellow-300 text-[11px] shrink-0">
            FTP {ftp}W
          </span>
        </div>

        {/* Transparent SVG Plot with crisp drop-shadow */}
        <div
          ref={plotRef}
          className="relative w-full flex-1 overflow-hidden min-h-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
        >
          {plotSize && plotSize.width > 0 && plotSize.height > 0 && (
            <WorkoutProfilePlot
              workout={workout}
              width={plotSize.width}
              height={plotSize.height}
              currentSecond={currentSecond}
              currentIntervalIndex={currentIntervalIndex}
              maxPowerPercent={maxPowerPercent}
              isCompact={true}
              onSelectInterval={onSelectInterval}
            />
          )}
        </div>

        {/* Frameless Timeline */}
        <div
          className="flex justify-between items-center pt-0.5 text-[10px] font-mono font-bold text-white/80 leading-none shrink-0"
          style={hudShadow}
        >
          <span>00:00</span>
          <span>{formatMmSs(totalDuration / 2)}</span>
          <span>{formatMmSs(totalDuration)}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-full rounded-xl sm:rounded-2xl bg-[#1F2025]/85 border border-[#383941] shadow-lg backdrop-blur-md flex flex-col overflow-hidden ${
        heightClassName || 'h-40 sm:h-48 md:h-52 lg:h-56'
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

      {/* SVG Chart - drawn 1:1 in the measured size of this box */}
      <div
        ref={plotRef}
        className="relative w-full flex-1 overflow-hidden bg-slate-950/70 min-h-0"
      >
        {plotSize && plotSize.width > 0 && plotSize.height > 0 && (
          <WorkoutProfilePlot
            workout={workout}
            width={plotSize.width}
            height={plotSize.height}
            currentSecond={currentSecond}
            currentIntervalIndex={currentIntervalIndex}
            maxPowerPercent={maxPowerPercent}
            isCompact={isCompact}
            onSelectInterval={onSelectInterval}
          />
        )}
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
