import React from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, Download, Dumbbell, Bluetooth, Settings as SettingsIcon } from 'lucide-react';
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
  workoutTitle?: string;
  onOpenWorkout?: () => void;
  onOpenBluetooth?: () => void;
  onOpenSettings?: () => void;
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
  workoutTitle,
  onOpenWorkout,
  onOpenBluetooth,
  onOpenSettings,
}) => {
  if (isCompact) {
    // Mobile / APK full-width tactile controls (never overflows horizontally)
    return (
      <div className="rounded-2xl bg-[#1F2025]/95 border border-[#383941] p-2.5 sm:p-3 shadow-lg backdrop-blur-md flex flex-col gap-2 w-full max-w-full overflow-hidden shrink-0">
        {/* Row 1: Primary Action Buttons */}
        <div className="flex items-center gap-2 w-full">
          {status === 'idle' && (
            <>
              <button
                onClick={onStart}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#00E5A3] hover:bg-[#26ebad] text-slate-950 font-black text-sm shadow-md shadow-[#00E5A3]/20 active:scale-95 transition-all"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>START WORKOUT</span>
              </button>

              {onExportFit && (
                <button
                  onClick={onExportFit}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#2F3037] hover:bg-[#3E4049] border border-emerald-500/40 text-emerald-300 font-bold text-xs active:scale-95 transition-all shrink-0"
                  title="Export .FIT with current training data"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.FIT</span>
                </button>
              )}
            </>
          )}

          {status === 'running' && (
            <>
              <button
                onClick={onPause}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs active:scale-95 transition-all"
              >
                <Pause className="w-4 h-4 fill-current" />
                <span>PAUSE</span>
              </button>
              <button
                onClick={onStop}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-300 font-bold text-xs active:scale-95 transition-all"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>STOP</span>
              </button>
              {onExportFit && (
                <button
                  onClick={onExportFit}
                  className="flex items-center justify-center gap-1 px-2.5 py-2.5 rounded-xl bg-[#2F3037] hover:bg-[#3E4049] border border-emerald-500/40 text-emerald-300 font-bold text-xs active:scale-95 transition-all shrink-0"
                  title="Export .FIT"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.FIT</span>
                </button>
              )}
            </>
          )}

          {status === 'paused' && (
            <>
              <button
                onClick={onResume}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#00E5A3] hover:bg-[#26ebad] text-slate-950 font-black text-xs active:scale-95 transition-all"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>RESUME</span>
              </button>
              <button
                onClick={onStop}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-300 font-bold text-xs active:scale-95 transition-all"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>FINISH</span>
              </button>
              {onExportFit && (
                <button
                  onClick={onExportFit}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#2F3037] hover:bg-[#3E4049] border border-emerald-500/40 text-emerald-300 font-bold text-xs active:scale-95 transition-all shrink-0"
                  title="Export .FIT with training data so far"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.FIT</span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Row 2: Tactical adjustments (Interval navigation & ERG/Power) */}
        <div className="flex items-center gap-2 w-full">
          {hasWorkout ? (
            <>
              {/* Interval Skip */}
              <div className="flex-1 flex items-center justify-between bg-[#2F3037] border border-[#383941] rounded-xl px-2 py-1">
                <button
                  onClick={() => onSkipInterval(false)}
                  title="Previous Interval"
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 active:scale-95"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Interval
                </span>
                <button
                  onClick={() => onSkipInterval(true)}
                  title="Next Interval"
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 active:scale-95"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* ERG Bias */}
              <div className="flex-1 flex items-center justify-between bg-[#2F3037] border border-[#383941] rounded-xl px-1.5 py-1 font-mono">
                <button
                  onClick={() => onAdjustErgBias(-5)}
                  className="px-2.5 py-1 rounded-lg hover:bg-white/10 text-slate-300 font-bold text-xs active:scale-95"
                >
                  -5%
                </button>
                <div className="text-center">
                  <span className="font-bold text-[#00E5A3] text-xs">
                    {ergBiasPercent}%
                  </span>
                  <span className="block text-[8px] text-slate-400 font-sans font-bold leading-none">
                    BIAS
                  </span>
                </div>
                <button
                  onClick={() => onAdjustErgBias(5)}
                  className="px-2.5 py-1 rounded-lg hover:bg-white/10 text-slate-300 font-bold text-xs active:scale-95"
                >
                  +5%
                </button>
              </div>
            </>
          ) : (
            /* Free Ride Manual Watts */
            <div className="w-full flex items-center justify-between bg-[#2F3037] border border-[#383941] rounded-xl px-2 py-1 font-mono">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onAdjustManualWatts(-10)}
                  className="px-2 py-1 rounded-lg hover:bg-white/10 text-slate-300 font-bold text-xs active:scale-95"
                >
                  -10W
                </button>
                <button
                  onClick={() => onAdjustManualWatts(-5)}
                  className="px-2 py-1 rounded-lg hover:bg-white/10 text-slate-300 font-bold text-xs active:scale-95"
                >
                  -5W
                </button>
              </div>
              <div className="text-center px-1">
                <span className="font-bold text-amber-400 text-xs">
                  {targetPower}W
                </span>
                <span className="block text-[8px] text-slate-400 font-sans font-bold leading-none">
                  TARGET
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onAdjustManualWatts(5)}
                  className="px-2 py-1 rounded-lg hover:bg-white/10 text-slate-300 font-bold text-xs active:scale-95"
                >
                  +5W
                </button>
                <button
                  onClick={() => onAdjustManualWatts(10)}
                  className="px-2 py-1 rounded-lg hover:bg-white/10 text-slate-300 font-bold text-xs active:scale-95"
                >
                  +10W
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Row 3: Studio Quick Tools */}
        <div className="flex items-center gap-2 w-full pt-1.5 border-t border-white/5">
          {onOpenWorkout && (
            <button
              onClick={onOpenWorkout}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-[11px] font-bold truncate ${
                workoutTitle
                  ? 'bg-[#00E5A3]/15 border-[#00E5A3]/40 text-[#00E5A3]'
                  : 'bg-[#2F3037] border-[#383941] text-slate-300'
              }`}
            >
              <Dumbbell className="w-3.5 h-3.5 text-[#00E5A3] shrink-0" />
              <span className="truncate">{workoutTitle || 'Workout (.zwo)'}</span>
            </button>
          )}

          {onOpenBluetooth && (
            <button
              onClick={onOpenBluetooth}
              className="flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg bg-[#2F3037] border border-[#383941] text-[11px] font-bold text-slate-200"
            >
              <Bluetooth className="w-3.5 h-3.5 text-[#00E5A3]" />
              <span>Sensors</span>
            </button>
          )}

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded-lg bg-[#2F3037] border border-[#383941] text-slate-300"
              title="Settings"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Standard Desktop Controls (Full Screen)
  return (
    <div className="rounded-xl sm:rounded-2xl bg-[#1F2025]/95 border border-[#383941] p-2.5 sm:px-4 sm:py-2.5 shadow-lg backdrop-blur-md flex flex-wrap items-center justify-between gap-3 w-full shrink-0">
      {/* 1. Main Action Buttons */}
      <div className="flex items-center gap-2.5">
        {status === 'idle' && (
          <>
            <button
              onClick={onStart}
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#00E5A3] hover:bg-[#26ebad] text-slate-950 font-black text-sm shadow-md shadow-[#00E5A3]/25 transition-all transform active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>START WORKOUT</span>
            </button>

            {onExportFit && (
              <button
                onClick={onExportFit}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#2F3037] hover:bg-[#3E4049] border border-emerald-500/40 text-emerald-300 font-bold text-xs shadow-sm transition-all transform active:scale-95"
                title="Genera e scarica file .FIT per la sessione corrente"
              >
                <Download className="w-3.5 h-3.5" />
                <span>SCARICA .FIT</span>
              </button>
            )}
          </>
        )}

        {status === 'running' && (
          <>
            <button
              onClick={onPause}
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-md shadow-amber-500/25 transition-all transform active:scale-95"
            >
              <Pause className="w-4 h-4 fill-current" />
              <span>PAUSE</span>
            </button>

            <button
              onClick={onStop}
              className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-300 font-bold text-xs transition-all transform active:scale-95"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>STOP & SAVE</span>
            </button>

            {onExportFit && (
              <button
                onClick={onExportFit}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#2F3037] hover:bg-[#3E4049] border border-emerald-500/40 text-emerald-300 font-bold text-xs shadow-sm transition-all transform active:scale-95"
                title="Esporta .FIT con i dati accumulati finora"
              >
                <Download className="w-3.5 h-3.5" />
                <span>.FIT</span>
              </button>
            )}
          </>
        )}

        {status === 'paused' && (
          <>
            <button
              onClick={onResume}
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#00E5A3] hover:bg-[#26ebad] text-slate-950 font-black text-sm shadow-md shadow-[#00E5A3]/25 transition-all transform active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>RESUME</span>
            </button>

            <button
              onClick={onStop}
              className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-300 font-bold text-xs transition-all transform active:scale-95"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>FINISH</span>
            </button>

            {onExportFit && (
              <button
                onClick={onExportFit}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#2F3037] hover:bg-[#3E4049] border border-emerald-500/40 text-emerald-300 font-bold text-xs shadow-sm transition-all transform active:scale-95"
                title="Esporta .FIT con i dati registrati"
              >
                <Download className="w-3.5 h-3.5" />
                <span>.FIT</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* 2. Tactical Adjustments: Interval Navigation & Intensity */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {hasWorkout && (
          <div className="flex items-center gap-1 bg-[#2F3037] border border-[#383941] rounded-xl p-1">
            <button
              onClick={() => onSkipInterval(false)}
              title="Previous Interval"
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider px-1.5">
              Interval
            </span>
            <button
              onClick={() => onSkipInterval(true)}
              title="Next Interval"
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {hasWorkout ? (
          <div className="flex items-center gap-1 bg-[#2F3037] border border-[#383941] rounded-xl p-1 font-mono">
            <button
              onClick={() => onAdjustErgBias(-5)}
              title="-5% ERG Bias"
              className="px-2 py-1 rounded-lg hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white"
            >
              -5%
            </button>
            <button
              onClick={() => onAdjustErgBias(-1)}
              title="-1% ERG Bias"
              className="px-1.5 py-1 rounded-lg hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white"
            >
              -1%
            </button>

            <div className="px-2.5 py-0.5 text-center">
              <div className="text-xs font-black text-[#00E5A3] font-mono leading-none">
                {ergBiasPercent}%
              </div>
              <div className="text-[8px] text-slate-400 uppercase tracking-wider font-sans font-bold mt-0.5">
                BIAS
              </div>
            </div>

            <button
              onClick={() => onAdjustErgBias(1)}
              title="+1% ERG Bias"
              className="px-1.5 py-1 rounded-lg hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white"
            >
              +1%
            </button>
            <button
              onClick={() => onAdjustErgBias(5)}
              title="+5% ERG Bias"
              className="px-2 py-1 rounded-lg hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white"
            >
              +5%
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 bg-[#2F3037] border border-[#383941] rounded-xl p-1 font-mono">
            <button
              onClick={() => onAdjustManualWatts(-10)}
              className="px-2 py-1 rounded-lg hover:bg-white/10 text-xs font-bold text-slate-300"
            >
              -10W
            </button>
            <button
              onClick={() => onAdjustManualWatts(-5)}
              className="px-2 py-1 rounded-lg hover:bg-white/10 text-xs font-bold text-slate-300"
            >
              -5W
            </button>

            <div className="px-2.5 py-0.5 text-center">
              <div className="text-xs font-black text-amber-400 font-mono leading-none">
                {targetPower}W
              </div>
              <div className="text-[8px] text-slate-400 uppercase tracking-wider font-sans font-bold mt-0.5">
                TARGET
              </div>
            </div>

            <button
              onClick={() => onAdjustManualWatts(5)}
              className="px-2 py-1 rounded-lg hover:bg-white/10 text-xs font-bold text-slate-300"
            >
              +5W
            </button>
            <button
              onClick={() => onAdjustManualWatts(10)}
              className="px-2 py-1 rounded-lg hover:bg-white/10 text-xs font-bold text-slate-300"
            >
              +10W
            </button>
          </div>
        )}
      </div>

      {/* 3. Studio Quick Tools: Workout, Sensors, Settings */}
      <div className="flex items-center gap-2">
        {onOpenWorkout && (
          <button
            onClick={onOpenWorkout}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
              workoutTitle
                ? 'bg-[#00E5A3]/15 border-[#00E5A3]/40 text-[#00E5A3]'
                : 'bg-[#2F3037] border-[#383941] text-slate-300 hover:bg-[#3E4049]'
            }`}
            title="Seleziona allenamento (.zwo)"
          >
            <Dumbbell className="w-3.5 h-3.5 text-[#00E5A3]" />
            <span className="max-w-[140px] truncate">
              {workoutTitle || 'Workout (.zwo)'}
            </span>
          </button>
        )}

        {onOpenBluetooth && (
          <button
            onClick={onOpenBluetooth}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#2F3037] hover:bg-[#3E4049] border border-[#383941] text-xs font-bold text-slate-200 transition-colors"
            title="Sensori Bluetooth"
          >
            <Bluetooth className="w-3.5 h-3.5 text-[#00E5A3]" />
            <span>Sensors</span>
          </button>
        )}

        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            title="Impostazioni Studio"
            className="p-2 rounded-xl bg-[#2F3037] hover:bg-[#3E4049] border border-[#383941] text-slate-300 hover:text-white transition-colors"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
