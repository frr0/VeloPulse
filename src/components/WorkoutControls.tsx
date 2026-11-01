import React from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, Download } from 'lucide-react';
import { SessionStatus } from '../types';

interface WorkoutControlsProps {
  status: SessionStatus;
  ergBiasPercent: number;
  hasWorkout: boolean;
  targetPower: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSkipInterval: (forward: boolean) => void;
  onAdjustErgBias: (delta: number) => void;
  onAdjustManualWatts: (delta: number) => void;
  onExportFit?: () => void;
  isCompact?: boolean;
}

export const WorkoutControls: React.FC<WorkoutControlsProps> = ({
  status,
  ergBiasPercent,
  hasWorkout,
  targetPower,
  onStart,
  onPause,
  onResume,
  onStop,
  onSkipInterval,
  onAdjustErgBias,
  onAdjustManualWatts,
  onExportFit,
  isCompact = false,
}) => {
  if (isCompact) {
    // Mobile / APK full-width tactile controls
    return (
      <div className="rounded-2xl bg-[#111622]/95 border border-[#232D42] p-2.5 sm:p-3 shadow-lg backdrop-blur-md flex items-center justify-between gap-2 w-full">
        {/* Main Action Buttons */}
        <div className="flex items-center gap-2">
          {status === 'idle' && (
            <button
              onClick={onStart}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00E5A3] hover:bg-[#26ebad] text-slate-950 font-black text-sm shadow-md shadow-[#00E5A3]/20 active:scale-95 transition-all"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>START</span>
            </button>
          )}

          {status === 'running' && (
            <>
              <button
                onClick={onPause}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs active:scale-95 transition-all"
              >
                <Pause className="w-4 h-4 fill-current" />
                <span>PAUSE</span>
              </button>
              <button
                onClick={onStop}
                className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-300 font-bold text-xs active:scale-95 transition-all"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>STOP</span>
              </button>
            </>
          )}

          {status === 'paused' && (
            <>
              <button
                onClick={onResume}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#00E5A3] hover:bg-[#26ebad] text-slate-950 font-black text-xs active:scale-95 transition-all"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>RESUME</span>
              </button>
              <button
                onClick={onStop}
                className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-300 font-bold text-xs active:scale-95 transition-all"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>FINISH</span>
              </button>
            </>
          )}

          {onExportFit && status === 'idle' && (
            <button
              onClick={onExportFit}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#1A2234] hover:bg-[#25324C] border border-emerald-500/40 text-emerald-300 font-bold text-xs active:scale-95 transition-all"
              title="Export .FIT"
            >
              <Download className="w-3.5 h-3.5" />
              <span>.FIT</span>
            </button>
          )}
        </div>

        {/* Interval Navigation (If workout active) */}
        {hasWorkout && (
          <div className="flex items-center gap-1 bg-[#1A2234] border border-[#232D42] rounded-xl p-1">
            <button
              onClick={() => onSkipInterval(false)}
              title="Previous Interval"
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 active:scale-95"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-bold text-slate-400 px-1">INT</span>
            <button
              onClick={() => onSkipInterval(true)}
              title="Next Interval"
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 active:scale-95"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Intensity Controls (ERG Bias or Manual Watts) */}
        <div className="flex items-center gap-1">
          {hasWorkout ? (
            <div className="flex items-center gap-1 bg-[#1A2234] border border-[#232D42] rounded-xl p-1 font-mono">
              <button
                onClick={() => onAdjustErgBias(-5)}
                className="px-2 py-1 rounded-lg hover:bg-white/10 text-slate-300 font-bold text-xs"
              >
                -5%
              </button>
              <span className="px-1.5 font-bold text-[#00E5A3] text-xs">
                {ergBiasPercent}%
              </span>
              <button
                onClick={() => onAdjustErgBias(5)}
                className="px-2 py-1 rounded-lg hover:bg-white/10 text-slate-300 font-bold text-xs"
              >
                +5%
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-[#1A2234] border border-[#232D42] rounded-xl p-1 font-mono">
              <button
                onClick={() => onAdjustManualWatts(-5)}
                className="px-2 py-1 rounded-lg hover:bg-white/10 text-slate-300 font-bold text-xs"
              >
                -5W
              </button>
              <span className="px-1.5 font-bold text-amber-400 text-xs">
                {targetPower}W
              </span>
              <button
                onClick={() => onAdjustManualWatts(5)}
                className="px-2 py-1 rounded-lg hover:bg-white/10 text-slate-300 font-bold text-xs"
              >
                +5W
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Standard Desktop Controls (Full Screen)
  return (
    <div className="rounded-2xl bg-[#111622]/90 border border-[#232D42] p-4 lg:p-5 shadow-xl backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4 w-full">
      {/* 1. Main Action Buttons */}
      <div className="flex items-center gap-3 w-full md:w-auto justify-center flex-wrap">
        {status === 'idle' && (
          <>
            <button
              onClick={onStart}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2.5 px-8 lg:px-10 py-3.5 lg:py-4 rounded-xl bg-[#00E5A3] hover:bg-[#26ebad] text-slate-950 font-black text-base lg:text-lg shadow-lg shadow-[#00E5A3]/25 transition-all transform active:scale-95"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>START WORKOUT</span>
            </button>

            {onExportFit && (
              <button
                onClick={onExportFit}
                className="flex items-center justify-center gap-2 px-6 py-3.5 lg:py-4 rounded-xl bg-[#1A2234] hover:bg-[#25324C] border border-[#00E5A3]/40 text-[#00E5A3] font-bold text-sm shadow-md transition-all transform active:scale-95"
                title="Genera e scarica file .FIT Garmin per la sessione corrente o demo"
              >
                <Download className="w-4 h-4" />
                <span>SCARICA .FIT</span>
              </button>
            )}
          </>
        )}

        {status === 'running' && (
          <>
            <button
              onClick={onPause}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2.5 px-8 lg:px-10 py-3.5 lg:py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-base lg:text-lg shadow-lg shadow-amber-500/25 transition-all transform active:scale-95"
            >
              <Pause className="w-5 h-5 fill-current" />
              <span>PAUSE</span>
            </button>

            <button
              onClick={onStop}
              className="flex items-center justify-center gap-2 px-6 py-3.5 lg:py-4 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-300 font-bold text-base transition-all transform active:scale-95"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>STOP & SAVE</span>
            </button>
          </>
        )}

        {status === 'paused' && (
          <>
            <button
              onClick={onResume}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2.5 px-8 lg:px-10 py-3.5 lg:py-4 rounded-xl bg-[#00E5A3] hover:bg-[#26ebad] text-slate-950 font-black text-base lg:text-lg shadow-lg shadow-[#00E5A3]/25 transition-all transform active:scale-95"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>RESUME</span>
            </button>

            <button
              onClick={onStop}
              className="flex items-center justify-center gap-2 px-6 py-3.5 lg:py-4 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-300 font-bold text-base transition-all transform active:scale-95"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>FINISH & FIT</span>
            </button>
          </>
        )}
      </div>

      {/* 2. Interval Navigation Controls (If structured workout loaded) */}
      {hasWorkout && (
        <div className="flex items-center gap-2 bg-[#1A2234] border border-[#232D42] rounded-xl p-2">
          <button
            onClick={() => onSkipInterval(false)}
            title="Previous Interval"
            className="p-2 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider px-2">
            Interval
          </span>
          <button
            onClick={() => onSkipInterval(true)}
            title="Next Interval"
            className="p-2 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. Intensity Controls (ERG Bias or Manual Watts) */}
      <div className="flex items-center gap-3">
        {hasWorkout ? (
          <div className="flex items-center gap-1.5 bg-[#1A2234] border border-[#232D42] rounded-xl p-2 font-mono">
            <button
              onClick={() => onAdjustErgBias(-5)}
              title="-5% ERG Bias"
              className="px-2.5 py-1 rounded-lg hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white"
            >
              -5%
            </button>
            <button
              onClick={() => onAdjustErgBias(-1)}
              title="-1% ERG Bias"
              className="px-2 py-1 rounded-lg hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white"
            >
              -1%
            </button>

            <div className="px-3 py-0.5 text-center">
              <div className="text-sm font-black text-[#00E5A3] font-mono">
                {ergBiasPercent}%
              </div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-sans font-bold">
                ERG BIAS
              </div>
            </div>

            <button
              onClick={() => onAdjustErgBias(1)}
              title="+1% ERG Bias"
              className="px-2.5 py-1 rounded-lg hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white"
            >
              +1%
            </button>
            <button
              onClick={() => onAdjustErgBias(5)}
              title="+5% ERG Bias"
              className="px-2.5 py-1 rounded-lg hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white"
            >
              +5%
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-[#1A2234] border border-[#232D42] rounded-xl p-2 font-mono">
            <button
              onClick={() => onAdjustManualWatts(-10)}
              className="px-2.5 py-1 rounded-lg hover:bg-white/10 text-xs font-bold text-slate-300"
            >
              -10W
            </button>
            <button
              onClick={() => onAdjustManualWatts(-5)}
              className="px-2.5 py-1 rounded-lg hover:bg-white/10 text-xs font-bold text-slate-300"
            >
              -5W
            </button>

            <div className="px-3 py-0.5 text-center">
              <div className="text-sm font-black text-amber-400 font-mono">
                {targetPower}W
              </div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-sans font-bold">
                TARGET
              </div>
            </div>

            <button
              onClick={() => onAdjustManualWatts(5)}
              className="px-2.5 py-1 rounded-lg hover:bg-white/10 text-xs font-bold text-slate-300"
            >
              +5W
            </button>
            <button
              onClick={() => onAdjustManualWatts(10)}
              className="px-2.5 py-1 rounded-lg hover:bg-white/10 text-xs font-bold text-slate-300"
            >
              +10W
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
