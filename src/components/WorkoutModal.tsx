import React, { useMemo, useState } from 'react';
import { X, Upload, CheckCircle2, Dumbbell, Clock, Flame, Zap } from 'lucide-react';
import { ParsedWorkout, WorkoutInterval } from '../types';
import { parseZwoWorkout, SAMPLE_WORKOUTS, WorkoutCategory } from '../services/workout/zwoParser';
import { POWER_ZONES_CONFIG } from '../utils/zones';

interface WorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWorkout: ParsedWorkout | null;
  ftp: number;
  onSelectWorkout: (workout: ParsedWorkout | null) => void;
}

const CATEGORIES: Array<'All' | WorkoutCategory> = [
  'All',
  'Recovery',
  'Endurance',
  'Sweet Spot',
  'Threshold',
  'VO2 Max',
  'Sprint',
  'Test',
];

const CATEGORY_BADGE_COLORS: Record<WorkoutCategory, string> = {
  Recovery: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  Endurance: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  'Sweet Spot': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  Threshold: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'VO2 Max': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  Sprint: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  Test: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

const getZoneColor = (powerRatio: number): string => {
  if (powerRatio <= 0.55) return POWER_ZONES_CONFIG[0].color;
  if (powerRatio <= 0.75) return POWER_ZONES_CONFIG[1].color;
  if (powerRatio <= 0.9) return POWER_ZONES_CONFIG[2].color;
  if (powerRatio <= 1.05) return POWER_ZONES_CONFIG[3].color;
  if (powerRatio <= 1.2) return POWER_ZONES_CONFIG[4].color;
  if (powerRatio <= 1.5) return POWER_ZONES_CONFIG[5].color;
  return POWER_ZONES_CONFIG[6].color;
};

const MiniWorkoutSparkline: React.FC<{ workout: ParsedWorkout }> = ({ workout }) => {
  const total = Math.max(1, workout.totalDurationSeconds);
  const maxP = Math.max(
    1.15,
    ...workout.intervals.map((i) => Math.max(i.powerLow, i.powerHigh, i.power))
  );
  const w = 220;
  const h = 40;
  const ftpY = h - (1.0 / maxP) * (h - 4);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10 block" preserveAspectRatio="none">
      <line
        x1="0"
        y1={ftpY}
        x2={w}
        y2={ftpY}
        stroke="#facc15"
        strokeDasharray="3 3"
        strokeWidth="0.8"
        opacity="0.4"
      />
      {workout.intervals.map((inv: WorkoutInterval) => {
        const x1 = (inv.startSecond / total) * w;
        const x2 = (inv.endSecond / total) * w;
        const y1 = h - Math.min(1, inv.powerLow / maxP) * (h - 4);
        const y2 = h - Math.min(1, inv.powerHigh / maxP) * (h - 4);
        const col = getZoneColor((inv.powerLow + inv.powerHigh) / 2);
        return (
          <polygon
            key={inv.id}
            points={`${x1},${h} ${x1},${y1} ${x2},${y2} ${x2},${h}`}
            fill={col}
            fillOpacity="0.85"
          />
        );
      })}
    </svg>
  );
};

export const WorkoutModal: React.FC<WorkoutModalProps> = ({
  isOpen,
  onClose,
  currentWorkout,
  ftp,
  onSelectWorkout,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'All' | WorkoutCategory>('All');

  // Pre-parse built-in workouts so every card shows live SVG profile, duration, TSS & IF
  const parsedLibrary = useMemo(() => {
    return SAMPLE_WORKOUTS.map((sample) => {
      try {
        return { sample, parsed: parseZwoWorkout(sample.xml, ftp) };
      } catch {
        return null;
      }
    }).filter((x): x is { sample: typeof SAMPLE_WORKOUTS[0]; parsed: ParsedWorkout } => x !== null);
  }, [ftp]);

  const filteredLibrary = useMemo(() => {
    if (selectedCategory === 'All') return parsedLibrary;
    return parsedLibrary.filter((item) => item.sample.category === selectedCategory);
  }, [parsedLibrary, selectedCategory]);

  if (!isOpen) return null;

  const handleFileUpload = (file: File) => {
    setError(null);
    if (!file.name.endsWith('.zwo') && !file.name.endsWith('.xml')) {
      setError('Carica un file .zwo o .xml valido.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = parseZwoWorkout(content, ftp);
        onSelectWorkout(parsed);
        onClose();
      } catch (err: any) {
        setError(err.message || 'Errore nel parsing del file .zwo');
      }
    };
    reader.onerror = () => setError('Errore nella lettura del file');
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-4xl rounded-3xl bg-[#131316] border border-[#383941] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#383941] flex items-center justify-between gap-3 bg-[#1A1B20]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-[#00E5A3]/15 text-[#00E5A3] border border-[#00E5A3]/30 shrink-0">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-black text-white truncate">
                Libreria Allenamenti
              </h2>
              <p className="text-xs text-slate-400 truncate">
                Scegli un protocollo strutturato (calibrato su FTP {ftp}W) oppure carica un file .zwo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {currentWorkout && (
              <button
                onClick={() => {
                  onSelectWorkout(null);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-colors"
              >
                Free Ride
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top Bar: Category Filter Pills + Compact .zwo Upload */}
        <div className="px-5 py-3 border-b border-[#383941]/70 bg-[#17181D] flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-[#00E5A3] text-slate-950 shadow-sm'
                    : 'bg-[#25262E] text-slate-300 hover:text-white hover:bg-[#30323C]'
                }`}
              >
                {cat === 'All' ? `Tutti (${parsedLibrary.length})` : cat}
              </button>
            ))}
          </div>

          <label
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer border transition-all shrink-0 ${
              dragActive
                ? 'border-[#00E5A3] bg-[#00E5A3]/15 text-[#00E5A3]'
                : 'border-[#383941] bg-[#25262E] hover:bg-[#30323C] text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5 text-[#00E5A3]" />
            <span>Carica .zwo</span>
            <input
              type="file"
              accept=".zwo,.xml"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />
          </label>
        </div>

        {error && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Workout Cards Grid */}
        <div className="overflow-y-auto p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredLibrary.map(({ sample, parsed }) => {
              const isActive = currentWorkout?.title === parsed.title;
              const mins = Math.round(parsed.totalDurationSeconds / 60);

              return (
                <button
                  key={sample.name}
                  type="button"
                  onClick={() => {
                    onSelectWorkout(parsed);
                    onClose();
                  }}
                  className={`text-left p-4 rounded-2xl border transition-all flex flex-col gap-2.5 group ${
                    isActive
                      ? 'bg-[#00E5A3]/10 border-[#00E5A3]/60 shadow-lg shadow-[#00E5A3]/5'
                      : 'bg-[#1C1D24] border-[#32333D] hover:border-[#00E5A3]/50 hover:bg-[#22242C]'
                  }`}
                >
                  {/* Title + Category */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {isActive && <CheckCircle2 className="w-4 h-4 text-[#00E5A3] shrink-0" />}
                        <h3 className="text-sm font-black text-white group-hover:text-[#00E5A3] transition-colors truncate">
                          {sample.name}
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                        {sample.description}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide border shrink-0 ${
                        CATEGORY_BADGE_COLORS[sample.category]
                      }`}
                    >
                      {sample.category}
                    </span>
                  </div>

                  {/* Mini SVG Power Profile */}
                  <div className="rounded-xl bg-[#111216] border border-white/5 px-2 pt-2 pb-1 overflow-hidden">
                    <MiniWorkoutSparkline workout={parsed} />
                  </div>

                  {/* Stats Footer */}
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#00E5A3]" />
                        <strong>{mins}m</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Flame className="w-3 h-3 text-amber-400" />
                        TSS <strong>{parsed.estimatedTss}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-sky-400" />
                        IF <strong>{parsed.intensityFactor}</strong>
                      </span>
                    </div>
                    <span className="text-[#00E5A3] font-sans font-bold opacity-80 group-hover:opacity-100">
                      {isActive ? 'Attivo' : 'Carica →'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
