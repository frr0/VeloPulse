import { Moon } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Wellness } from '../../types/intervals';
import { formatDateShort } from '../../utils/formatters';
import { isAndroid } from '../../utils/platform';

interface SleepChartProps {
  data: Wellness[];
}

type SleepTab = 'duration' | 'score' | 'stages';
type RangeOption = '14' | '30' | '90';

interface SleepStageEntry {
  secs: number;
  hours: number;
  formatted: string;
  percent: number;
}

interface SleepStages {
  deep: SleepStageEntry;
  rem: SleepStageEntry;
  light: SleepStageEntry;
  awake: SleepStageEntry;
  totalBedFormatted: string;
}

interface SleepRow {
  id: string;
  hours: number | null;
  hoursFormatted: string | null;
  score: number | null;
  sleepQuality?: number;
  stages: SleepStages | null;
}

function isPositiveNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

function formatSecs(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export const SleepChart: React.FC<SleepChartProps> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<SleepTab>('duration');
  const [range, setRange] = useState<RangeOption>('30');
  const [selectedNightIndex, setSelectedNightIndex] = useState<number | null>(null);
  const targetHours = 8.0;

  const chartData = useMemo<SleepRow[]>(() => {
    if (!data || data.length === 0) return [];

    const sorted = [...data]
      .filter((d) => isPositiveNumber(d.sleepSecs) || isPositiveNumber(d.sleepScore))
      .sort((a, b) => new Date(a.id).getTime() - new Date(b.id).getTime());

    const limit = parseInt(range, 10);
    const sliced = sorted.slice(-limit);

    return sliced.map((item) => {
      const hasDuration = isPositiveNumber(item.sleepSecs);
      const rawHours = hasDuration ? (item.sleepSecs as number) / 3600 : null;
      const hours = rawHours !== null ? Math.round(rawHours * 10) / 10 : null;
      const hoursFormatted =
        rawHours !== null
          ? `${Math.floor(rawHours)}h ${Math.round((rawHours % 1) * 60)}m`
          : null;

      const score = isPositiveNumber(item.sleepScore) ? Math.round(item.sleepScore as number) : null;

      // Only build sleep stages if the provider actually supplied stage durations (never fabricated)
      const hasRealStages =
        isPositiveNumber(item.deepSleepSecs) ||
        isPositiveNumber(item.remSleepSecs) ||
        isPositiveNumber(item.lightSleepSecs) ||
        isPositiveNumber(item.awakeSleepSecs);

      let stages: SleepStages | null = null;
      if (hasRealStages) {
        const deepSecs = isPositiveNumber(item.deepSleepSecs) ? item.deepSleepSecs : 0;
        const remSecs = isPositiveNumber(item.remSleepSecs) ? item.remSleepSecs : 0;
        const lightSecs = isPositiveNumber(item.lightSleepSecs) ? item.lightSleepSecs : 0;
        const awakeSecs = isPositiveNumber(item.awakeSleepSecs) ? item.awakeSleepSecs : 0;
        const totalBedSecs = deepSecs + remSecs + lightSecs + awakeSecs;

        if (totalBedSecs > 0) {
          const mkStage = (secs: number): SleepStageEntry => ({
            secs,
            hours: Math.round((secs / 3600) * 10) / 10,
            formatted: formatSecs(secs),
            percent: Math.round((secs / totalBedSecs) * 100),
          });
          stages = {
            deep: mkStage(deepSecs),
            rem: mkStage(remSecs),
            light: mkStage(lightSecs),
            awake: mkStage(awakeSecs),
            totalBedFormatted: formatSecs(totalBedSecs),
          };
        }
      }

      return {
        id: item.id,
        hours,
        hoursFormatted,
        score,
        sleepQuality: item.sleepQuality,
        stages,
      };
    });
  }, [data, range]);

  const durationData = useMemo(
    () => chartData.filter((d): d is SleepRow & { hours: number; hoursFormatted: string } => d.hours !== null),
    [chartData]
  );

  const scoreData = useMemo(
    () => chartData.filter((d): d is SleepRow & { score: number } => d.score !== null),
    [chartData]
  );

  const stagesData = useMemo(
    () => chartData.filter((d): d is SleepRow & { stages: SleepStages } => d.stages !== null),
    [chartData]
  );

  const hasRealStagesData = stagesData.length > 0;
  const effectiveTab: SleepTab = activeTab === 'stages' && !hasRealStagesData ? 'duration' : activeTab;

  // Selected specific night for stages (defaults to most recent night with real stages)
  const currentNight = useMemo(() => {
    if (stagesData.length === 0) return null;
    if (selectedNightIndex !== null && stagesData[selectedNightIndex]) {
      return stagesData[selectedNightIndex];
    }
    return stagesData[stagesData.length - 1];
  }, [stagesData, selectedNightIndex]);

  // Calculations for 7-day stats & sleep debt strictly from real data
  const { avgHours, avgScore, sleepDebtMinutes, latestHours, latestScore } = useMemo(() => {
    const last7Duration = durationData.slice(-7);
    const last7Score = scoreData.slice(-7);

    let avgHoursStr: string | null = null;
    let debtMins: number | null = null;
    if (last7Duration.length > 0) {
      const totalHours7d = last7Duration.reduce((sum, item) => sum + item.hours, 0);
      const avgH = totalHours7d / last7Duration.length;
      avgHoursStr = `${Math.floor(avgH)}h ${Math.round((avgH % 1) * 60)}m`;
      const target7d = targetHours * last7Duration.length;
      debtMins = Math.round((totalHours7d - target7d) * 60);
    }

    const avgSc =
      last7Score.length > 0
        ? Math.round(last7Score.reduce((sum, item) => sum + item.score, 0) / last7Score.length)
        : null;

    const latestDur = durationData.length > 0 ? durationData[durationData.length - 1] : null;
    const latestSc = scoreData.length > 0 ? scoreData[scoreData.length - 1] : null;

    return {
      avgHours: avgHoursStr,
      avgScore: avgSc,
      sleepDebtMinutes: debtMins,
      latestHours: latestDur?.hoursFormatted ?? null,
      latestScore: latestSc?.score ?? null,
    };
  }, [durationData, scoreData, targetHours]);

  const getDurationColor = (hours: number) => {
    if (hours >= 7.5) return '#00E5A3';
    if (hours >= 7.0) return '#38BDF8';
    if (hours >= 6.0) return '#F59E0B';
    return '#EF4444';
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return '#00E5A3';
    if (score >= 70) return '#38BDF8';
    if (score >= 50) return '#F59E0B';
    return '#EF4444';
  };

  const isAndroidApp = isAndroid();

  return (
    <div className={`${isAndroidApp ? 'py-4' : 'py-6'} border-y border-white/10`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold tracking-[0.14em] text-[#818CF8] uppercase">
              Sleep &amp; Recovery
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#818CF8]/15 text-[#818CF8]">
              {effectiveTab === 'duration'
                ? 'Duration & Sleep Debt'
                : effectiveTab === 'score'
                ? 'Sleep Quality Score'
                : 'Sleep Stages'}
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-black text-white mt-0.5 tracking-tight">
            {effectiveTab === 'duration'
              ? 'Nightly Sleep Duration vs 8-Hour Target'
              : effectiveTab === 'score'
              ? 'Restoration & Physiological Sleep Quality %'
              : 'Recorded Sleep Stages Breakdown'}
          </h3>
        </div>

        {/* Tab & Range Controls (Desktop / Web only in header) */}
        {!isAndroidApp && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('duration')}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                  effectiveTab === 'duration'
                    ? 'bg-[#818CF8]/20 text-[#818CF8]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Duration
              </button>
              <button
                onClick={() => setActiveTab('score')}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                  effectiveTab === 'score'
                    ? 'bg-[#818CF8]/20 text-[#818CF8]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Score %
              </button>
              {hasRealStagesData && (
                <button
                  onClick={() => setActiveTab('stages')}
                  className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                    effectiveTab === 'stages'
                      ? 'bg-[#818CF8]/20 text-[#818CF8]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Stages
                </button>
              )}
            </div>

            <span className="h-4 w-[1px] bg-white/10" />

            <div className="flex items-center gap-1">
              {(['14', '30', '90'] as RangeOption[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                    range === r
                      ? 'bg-white/10 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {r}D
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Hero Stats (Desktop / Web only in header) */}
      {!isAndroidApp && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mb-6">
          <div className="pl-3.5 border-l-2 border-[#818CF8]/70">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              Latest Night
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-white tabular-nums">
                {effectiveTab === 'score'
                  ? latestScore !== null
                    ? `${latestScore}%`
                    : '--'
                  : latestHours ?? '--'}
              </span>
            </div>
            <span className="text-[11px] text-[#818CF8] font-semibold">
              {effectiveTab === 'score'
                ? latestHours ?? 'No duration'
                : latestScore !== null
                ? `${latestScore}% Quality`
                : 'No score recorded'}
            </span>
          </div>

          <div className="pl-3.5 border-l-2 border-[#00E5A3]/70">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              7-Day Avg Duration
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-[#00E5A3] tabular-nums">{avgHours ?? '--'}</span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Optimal 7h–9h target</span>
          </div>

          <div className="pl-3.5 border-l-2 border-[#38BDF8]/70">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              7-Day Avg Score
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-[#38BDF8] tabular-nums">
                {avgScore !== null ? `${avgScore}%` : '--'}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              {avgScore === null ? 'No score data' : avgScore >= 80 ? 'Optimal recovery' : 'Recorded average'}
            </span>
          </div>

          <div className="pl-3.5 border-l-2 border-white/25">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              7-Day Sleep Debt
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span
                className="text-2xl font-black tabular-nums"
                style={{
                  color:
                    sleepDebtMinutes === null
                      ? '#94A3B8'
                      : sleepDebtMinutes >= 0
                      ? '#00E5A3'
                      : '#F59E0B',
                }}
              >
                {sleepDebtMinutes === null
                  ? '--'
                  : sleepDebtMinutes >= 0
                  ? `+${sleepDebtMinutes}m`
                  : `${sleepDebtMinutes}m`}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              {sleepDebtMinutes === null
                ? 'vs 8h target'
                : sleepDebtMinutes >= 0
                ? 'Surplus ahead of target'
                : 'Deficit vs 8h target'}
            </span>
          </div>
        </div>
      )}

      {/* Chart Canvas or Stages View */}
      {effectiveTab === 'stages' ? (
        stagesData.length > 0 && currentNight ? (
          <div className="space-y-3.5">
            {/* Night selector pills scroll */}
            <div>
              <div className="flex items-center justify-between mb-1.5 px-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Select night:
                </span>
                <span className="text-[10px] text-[#818CF8] font-semibold">
                  {currentNight.id}
                </span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {stagesData.map((item, idx) => {
                  const isSelected =
                    selectedNightIndex === idx ||
                    (selectedNightIndex === null && idx === stagesData.length - 1);
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedNightIndex(idx)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold shrink-0 transition-all border ${
                        isSelected
                          ? 'bg-[#818CF8] text-white border-white/30 shadow'
                          : 'bg-[#26272D] text-slate-400 border-white/5 hover:text-white'
                      }`}
                    >
                      {formatDateShort(item.id)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Current Night Stages Breakdown Header & Stacked Progress Bar */}
            <div className="bg-[#26272D] p-3.5 rounded-2xl border border-white/5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Night of {currentNight.id}
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-xl font-black text-white">
                      {currentNight.hoursFormatted ?? '--'}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      in bed: {currentNight.stages.totalBedFormatted}
                    </span>
                  </div>
                </div>

                {currentNight.score !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">Score:</span>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-black"
                      style={{
                        backgroundColor: `${getScoreColor(currentNight.score)}20`,
                        color: getScoreColor(currentNight.score),
                        border: `1px solid ${getScoreColor(currentNight.score)}40`,
                      }}
                    >
                      {currentNight.score}%
                    </span>
                  </div>
                )}
              </div>

              {/* Stacked Proportional Stages Bar */}
              <div>
                <div className="h-4 w-full rounded-xl overflow-hidden flex bg-black/40 border border-white/5 shadow-inner">
                  <div
                    style={{ width: `${currentNight.stages.deep.percent}%` }}
                    className="h-full bg-[#3B82F6] transition-all"
                    title={`Deep: ${currentNight.stages.deep.formatted} (${currentNight.stages.deep.percent}%)`}
                  />
                  <div
                    style={{ width: `${currentNight.stages.rem.percent}%` }}
                    className="h-full bg-[#A855F7] transition-all"
                    title={`REM: ${currentNight.stages.rem.formatted} (${currentNight.stages.rem.percent}%)`}
                  />
                  <div
                    style={{ width: `${currentNight.stages.light.percent}%` }}
                    className="h-full bg-[#38BDF8] transition-all"
                    title={`Light: ${currentNight.stages.light.formatted} (${currentNight.stages.light.percent}%)`}
                  />
                  <div
                    style={{ width: `${currentNight.stages.awake.percent}%` }}
                    className="h-full bg-[#F59E0B] transition-all"
                    title={`Awake: ${currentNight.stages.awake.formatted} (${currentNight.stages.awake.percent}%)`}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 px-0.5">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#3B82F6]" /> Deep
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#A855F7]" /> REM
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#38BDF8]" /> Light
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#F59E0B]" /> Awake
                  </span>
                </div>
              </div>

              {/* 4 Detail Stage Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="bg-[#1F2025] p-2.5 rounded-xl border border-[#A855F7]/25">
                  <span className="text-[9px] font-extrabold text-[#A855F7] uppercase tracking-wider block">
                    REM Sleep
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-base font-black text-white">
                      {currentNight.stages.rem.formatted}
                    </span>
                    <span className="text-[10px] text-[#A855F7] font-bold">
                      {currentNight.stages.rem.percent}%
                    </span>
                  </div>
                </div>

                <div className="bg-[#1F2025] p-2.5 rounded-xl border border-[#3B82F6]/25">
                  <span className="text-[9px] font-extrabold text-[#3B82F6] uppercase tracking-wider block">
                    Deep Sleep
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-base font-black text-white">
                      {currentNight.stages.deep.formatted}
                    </span>
                    <span className="text-[10px] text-[#3B82F6] font-bold">
                      {currentNight.stages.deep.percent}%
                    </span>
                  </div>
                </div>

                <div className="bg-[#1F2025] p-2.5 rounded-xl border border-[#38BDF8]/25">
                  <span className="text-[9px] font-extrabold text-[#38BDF8] uppercase tracking-wider block">
                    Light Sleep
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-base font-black text-white">
                      {currentNight.stages.light.formatted}
                    </span>
                    <span className="text-[10px] text-[#38BDF8] font-bold">
                      {currentNight.stages.light.percent}%
                    </span>
                  </div>
                </div>

                <div className="bg-[#1F2025] p-2.5 rounded-xl border border-[#F59E0B]/25">
                  <span className="text-[9px] font-extrabold text-[#F59E0B] uppercase tracking-wider block">
                    Awake Time
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-base font-black text-white">
                      {currentNight.stages.awake.formatted}
                    </span>
                    <span className="text-[10px] text-[#F59E0B] font-bold">
                      {currentNight.stages.awake.percent}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Comparative Stacked Bar Chart for real stages */}
            <div className="w-full h-[180px] bg-[#1F2025] p-2 rounded-xl border border-white/5">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stagesData.map((d) => ({
                    id: d.id,
                    deep: d.stages.deep.hours,
                    rem: d.stages.rem.hours,
                    light: d.stages.light.hours,
                    awake: d.stages.awake.hours,
                  }))}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#383941" vertical={false} />
                  <XAxis
                    dataKey="id"
                    tickFormatter={(v) => formatDateShort(v)}
                    stroke="#64748B"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#383941' }}
                  />
                  <YAxis
                    stroke="#64748B"
                    tick={{ fill: '#94A3B8', fontSize: 10 }}
                    fontSize={10}
                    width={32}
                    tickLine={false}
                    axisLine={{ stroke: '#383941' }}
                    unit="h"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload as {
                          id: string;
                          deep: number;
                          rem: number;
                          light: number;
                          awake: number;
                        };
                        return (
                          <div className="bg-[#2F3037] border border-[#383941] p-2.5 rounded-xl text-xs space-y-1">
                            <div className="font-bold text-white border-b border-white/10 pb-1 mb-1">
                              {d.id}
                            </div>
                            <div className="text-[#3B82F6]">Deep: {d.deep}h</div>
                            <div className="text-[#A855F7]">REM: {d.rem}h</div>
                            <div className="text-[#38BDF8]">Light: {d.light}h</div>
                            <div className="text-[#F59E0B]">Awake: {d.awake}h</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="deep" stackId="stages" fill="#3B82F6" name="Deep" />
                  <Bar dataKey="rem" stackId="stages" fill="#A855F7" name="REM" />
                  <Bar dataKey="light" stackId="stages" fill="#38BDF8" name="Light" />
                  <Bar dataKey="awake" stackId="stages" fill="#F59E0B" name="Awake" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className={`w-full ${isAndroidApp ? 'h-[250px]' : 'h-[280px]'} flex flex-col items-center justify-center text-center gap-1.5 bg-[#26272D] rounded-xl border border-[#383941] px-6`}>
            <Moon className="w-5 h-5 text-slate-500" />
            <span className="text-sm font-bold text-white">Sleep stages not available</span>
            <span className="text-xs text-slate-400 max-w-md">
              Synced wellness data does not include recorded sleep stages (Deep, REM, Light, Awake).
            </span>
          </div>
        )
      ) : (
        <div className={`w-full ${isAndroidApp ? 'h-[250px]' : 'h-[280px]'}`}>
          {effectiveTab === 'duration' ? (
            durationData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={durationData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#383941" vertical={false} />

                  <ReferenceArea
                    y1={7.0}
                    y2={9.0}
                    fill="rgba(129, 140, 248, 0.08)"
                    strokeOpacity={0}
                  />

                  <ReferenceLine
                    y={targetHours}
                    stroke="#818CF8"
                    strokeDasharray="4 4"
                    label={{
                      value: 'Target 8h',
                      fill: '#818CF8',
                      fontSize: 10,
                      position: 'right',
                    }}
                  />

                  <XAxis
                    dataKey="id"
                    tickFormatter={(v) => formatDateShort(v)}
                    stroke="#64748B"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#383941' }}
                  />
                  <YAxis
                    domain={[0, 'auto']}
                    stroke="#64748B"
                    tick={{ fill: '#94A3B8', fontSize: 10 }}
                    fontSize={10}
                    width={32}
                    tickLine={false}
                    axisLine={{ stroke: '#383941' }}
                    unit="h"
                  />

                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload as {
                          id: string;
                          hours: number;
                          hoursFormatted: string;
                          score: number | null;
                        };
                        return (
                          <div className="bg-[#2F3037] border border-[#383941] p-3 rounded-xl shadow-2xl text-xs">
                            <div className="font-bold text-white border-b border-white/10 pb-1.5 mb-1.5">
                              {d.id}
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between gap-4 text-[#818CF8]">
                                <span>Sleep Duration:</span>
                                <strong className="text-white">{d.hoursFormatted}</strong>
                              </div>
                              {d.score !== null && (
                                <div className="flex justify-between gap-4 text-[#00E5A3]">
                                  <span>Sleep Score:</span>
                                  <strong className="text-white">{d.score}%</strong>
                                </div>
                              )}
                              <div className="flex justify-between gap-4 text-slate-400">
                                <span>vs 8h Target:</span>
                                <span
                                  style={{
                                    color: d.hours >= 8 ? '#00E5A3' : '#F59E0B',
                                  }}
                                >
                                  {d.hours >= 8
                                    ? `+${Math.round((d.hours - 8) * 60)}m`
                                    : `-${Math.round((8 - d.hours) * 60)}m`}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />

                  <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                    {durationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getDurationColor(entry.hours)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-center gap-1.5 bg-[#26272D] rounded-xl border border-[#383941] px-6">
                <Moon className="w-5 h-5 text-slate-500" />
                <span className="text-sm font-bold text-white">No sleep duration data</span>
                <span className="text-xs text-slate-400 max-w-md">
                  No recorded sleep duration values were found in your synced wellness history.
                </span>
              </div>
            )
          ) : scoreData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={scoreData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#383941" vertical={false} />

                <ReferenceArea
                  y1={85}
                  y2={100}
                  fill="rgba(0, 229, 163, 0.08)"
                  strokeOpacity={0}
                />

                <ReferenceLine
                  y={70}
                  stroke="#F59E0B"
                  strokeDasharray="3 3"
                  label={{
                    value: 'Min Good (70%)',
                    fill: '#F59E0B',
                    fontSize: 10,
                    position: 'right',
                  }}
                />

                <XAxis
                  dataKey="id"
                  tickFormatter={(v) => formatDateShort(v)}
                  stroke="#64748B"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: '#383941' }}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="#64748B"
                  tick={{ fill: '#94A3B8', fontSize: 10 }}
                  fontSize={10}
                  width={34}
                  tickLine={false}
                  axisLine={{ stroke: '#383941' }}
                  unit="%"
                />

                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload as {
                        id: string;
                        hoursFormatted: string | null;
                        score: number;
                      };
                      return (
                        <div className="bg-[#2F3037] border border-[#383941] p-3 rounded-xl shadow-2xl text-xs">
                          <div className="font-bold text-white border-b border-white/10 pb-1.5 mb-1.5">
                            {d.id}
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between gap-4 text-[#00E5A3]">
                              <span>Sleep Score:</span>
                              <strong className="text-white">{d.score}%</strong>
                            </div>
                            {d.hoursFormatted && (
                              <div className="flex justify-between gap-4 text-slate-300">
                                <span>Duration:</span>
                                <strong className="text-white">{d.hoursFormatted}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {scoreData.map((entry, index) => (
                    <Cell key={`cell-score-${index}`} fill={getScoreColor(entry.score)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-center gap-1.5 bg-[#26272D] rounded-xl border border-[#383941] px-6">
              <Moon className="w-5 h-5 text-slate-500" />
              <span className="text-sm font-bold text-white">No sleep score data</span>
              <span className="text-xs text-slate-400 max-w-md">
                No recorded sleep quality scores were found in your synced wellness history.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Android Controls & Compact Stats Below Chart */}
      {isAndroidApp ? (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center bg-[#2F3037] p-0.5 rounded-xl border border-[#383941]">
              <button
                onClick={() => setActiveTab('duration')}
                className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  effectiveTab === 'duration'
                    ? 'bg-[#818CF8] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Duration
              </button>
              <button
                onClick={() => setActiveTab('score')}
                className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  effectiveTab === 'score'
                    ? 'bg-[#818CF8] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Score
              </button>
              {hasRealStagesData && (
                <button
                  onClick={() => setActiveTab('stages')}
                  className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    effectiveTab === 'stages'
                      ? 'bg-[#818CF8] text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Stages
                </button>
              )}
            </div>

            <div className="flex items-center bg-[#2F3037] p-0.5 rounded-xl border border-[#383941]">
              {(['14', '30', '90'] as RangeOption[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    range === r
                      ? 'bg-[#3E4049] text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {r}D
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="pl-3 border-l-2 border-white/15">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                Latest Night
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black text-white">
                  {activeTab === 'score'
                    ? latestScore !== null
                      ? `${latestScore}%`
                      : '--'
                    : latestHours ?? '--'}
                </span>
              </div>
              <span className="text-[10px] text-[#818CF8] font-semibold truncate block">
                {activeTab === 'score'
                  ? latestHours ?? '--'
                  : latestScore !== null
                  ? `${latestScore}% Quality`
                  : '--'}
              </span>
            </div>

            <div className="pl-3 border-l-2 border-white/15">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                7-Day Avg Duration
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black text-[#00E5A3]">{avgHours ?? '--'}</span>
              </div>
              <span className="text-[10px] text-slate-400">Target 7–9h</span>
            </div>

            <div className="pl-3 border-l-2 border-white/15">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                7-Day Avg Score
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black text-[#38BDF8]">
                  {avgScore !== null ? `${avgScore}%` : '--'}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                {avgScore === null ? '--' : avgScore >= 80 ? 'Optimal' : 'Average'}
              </span>
            </div>

            <div className="pl-3 border-l-2 border-white/15">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                7-Day Sleep Debt
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span
                  className="text-lg font-black"
                  style={{
                    color:
                      sleepDebtMinutes === null
                        ? '#94A3B8'
                        : sleepDebtMinutes >= 0
                        ? '#00E5A3'
                        : '#F59E0B',
                  }}
                >
                  {sleepDebtMinutes === null
                    ? '--'
                    : sleepDebtMinutes >= 0
                    ? `+${sleepDebtMinutes}m`
                    : `${sleepDebtMinutes}m`}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 truncate block">
                {sleepDebtMinutes === null
                  ? 'No data'
                  : sleepDebtMinutes >= 0
                  ? 'Surplus'
                  : 'Deficit'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00E5A3]" />
              <span>Optimal (85%+)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8]" />
              <span>Good (70–84%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
              <span>Fair (&lt;70%)</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-slate-500 text-[11px]">
            <Moon className="w-3.5 h-3.5 text-[#818CF8]" />
            <span>Recorded sleep data from your wellness log</span>
          </div>
        </div>
      )}
    </div>
  );
};
