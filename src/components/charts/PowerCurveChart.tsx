import { AlertTriangle, Zap } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { powerAtSecs } from '../../services/intervals/api';
import { PowerCurveData, PowerCurveReading, PowerCurveSeries } from '../../types/intervals';
import {
  CriticalPowerResult,
  CriticalPowerUnavailableReason,
  estimateCriticalPower,
} from '../../utils/criticalPower';
import { isAndroid } from '../../utils/platform';

interface PowerCurveChartProps {
  data: PowerCurveData;
  ftp: number | null;
  isLoading?: boolean;
}

/** Why the critical power model has no estimate, in the language of this view. */
const CP_UNAVAILABLE_TEXT: Record<CriticalPowerUnavailableReason, string> = {
  'no-curve': 'Intervals.icu returned no power curve, so CP and W′ cannot be estimated.',
  'durations-missing':
    'The critical power model needs at least two efforts between 2 and 20 minutes: your curve does not cover them.',
  'durations-too-close':
    'The durations of your curve are too close together to fit the critical power model.',
  'model-not-applicable':
    'Your curve between 2 and 20 minutes does not fit the critical power model, so no estimate is shown.',
};

type PowerMetric = 'watts' | 'wkg';
type ComparisonMode = 'recent' | 'season';

interface ChartRow {
  secs: number;
  recentVal: number | null;
  seasonVal: number | null;
}

const BENCHMARKS: { secs: number; title: string; color: string }[] = [
  { secs: 5, title: '5s Sprint', color: '#FC5200' },
  { secs: 60, title: '1m Anaerobic', color: '#FC5200' },
  { secs: 300, title: '5m VO2 Max', color: '#38BDF8' },
  { secs: 1200, title: '20m Threshold', color: '#00E5A3' },
  { secs: 3600, title: '60m Hour', color: '#A855F7' },
];

const AXIS_TICKS = [1, 5, 15, 30, 60, 120, 300, 600, 1200, 3600, 7200, 14400];

function formatDurationLabel(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) {
    const minutes = secs / 60;
    return Number.isInteger(minutes) ? `${minutes}m` : `${minutes.toFixed(1)}m`;
  }
  const hours = secs / 3600;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function durationBand(secs: number): string {
  if (secs <= 15) return 'Neuromuscular';
  if (secs <= 120) return 'Anaerobic';
  if (secs <= 600) return 'VO2 Max';
  if (secs <= 3600) return 'Threshold';
  return 'Endurance';
}

function hasWkgValues(series: PowerCurveSeries | null): boolean {
  return !!series && series.samples.some((sample) => sample.wkg !== null);
}

export const PowerCurveChart: React.FC<PowerCurveChartProps> = ({ data, ftp, isLoading = false }) => {
  const [metric, setMetric] = useState<PowerMetric>('watts');
  const [mode, setMode] = useState<ComparisonMode>('recent');

  const hasRecent = data.recent !== null;
  const hasSeason = data.season !== null;
  const hasWkg = hasWkgValues(data.recent) || hasWkgValues(data.season);

  // The toggles never claim data that is missing: without a season curve, or
  // without a weight, the app falls back to what Intervals.icu really gave.
  const activeMode: ComparisonMode = hasRecent
    ? mode === 'season' && hasSeason
      ? 'season'
      : 'recent'
    : 'season';
  const activeMetric: PowerMetric = metric === 'wkg' && hasWkg ? 'wkg' : 'watts';
  const activeSeries: PowerCurveSeries | null =
    activeMode === 'season' ? data.season : data.recent;

  const chartRows = useMemo<ChartRow[]>(() => {
    const rowsBySecs = new Map<number, ChartRow>();

    const addSeries = (series: PowerCurveSeries | null, key: 'recentVal' | 'seasonVal') => {
      if (!series) return;
      for (const sample of series.samples) {
        const value = activeMetric === 'watts' ? sample.watts : sample.wkg;
        if (value === null) continue;
        const row = rowsBySecs.get(sample.secs) ?? {
          secs: sample.secs,
          recentVal: null,
          seasonVal: null,
        };
        row[key] = value;
        rowsBySecs.set(sample.secs, row);
      }
    };

    addSeries(data.recent, 'recentVal');
    addSeries(data.season, 'seasonVal');

    return Array.from(rowsBySecs.values()).sort((a, b) => a.secs - b.secs);
  }, [data.recent, data.season, activeMetric]);

  const xDomain = useMemo<[number, number]>(() => {
    if (chartRows.length === 0) return [1, 3600];
    return [chartRows[0].secs, chartRows[chartRows.length - 1].secs];
  }, [chartRows]);

  const xTicks = useMemo(
    () => AXIS_TICKS.filter((tick) => tick >= xDomain[0] && tick <= xDomain[1]),
    [xDomain]
  );

  const readings = useMemo<(PowerCurveReading | null)[]>(
    () =>
      BENCHMARKS.map((benchmark) =>
        activeSeries ? powerAtSecs(activeSeries.samples, benchmark.secs) : null
      ),
    [activeSeries]
  );

  // CP and W' fitted on the curve the user is looking at: switching between the
  // recent and the season curve re-fits the model on that curve.
  const criticalPower = useMemo<CriticalPowerResult>(
    () => estimateCriticalPower(activeSeries?.samples ?? null, activeSeries?.label ?? ''),
    [activeSeries]
  );

  const ftpWkg = ftp !== null && data.weightKg !== null ? ftp / data.weightKg : null;
  const ftpReference = activeMetric === 'watts' ? ftp : ftpWkg;

  const recentLabel = data.recent?.label ?? 'Recent';
  const seasonLabel = data.season?.label ?? 'Season';
  const hasChartData = chartRows.length > 0;

  const emptyMessage = isLoading
    ? 'Loading the power curves from Intervals.icu...'
    : data.error ?? 'No power data available for this athlete.';

  // The note must match the real reason, so it never blames a missing weight
  // when the problem is that Intervals.icu returned no curve at all.
  let footerNote: string;
  if (!hasChartData) {
    footerNote = 'No value is shown: this chart only reports data from Intervals.icu.';
  } else if (hasWkg) {
    footerNote = 'Values from Intervals.icu. "~" marks a duration interpolated between two samples.';
  } else if (data.weightKg === null) {
    footerNote = 'Intervals.icu has no weight on your profile: W/kg are not available.';
  } else {
    footerNote = 'Intervals.icu returned no W/kg for these curves.';
  }

  const formatValue = (value: number): string =>
    activeMetric === 'watts' ? `${Math.round(value)}` : value.toFixed(1);

  const unitLabel = activeMetric === 'watts' ? 'W' : 'W/kg';
  const isAndroidApp = isAndroid();

  return (
    <div className={`bg-[#1F2025] rounded-2xl border border-[#383941] shadow-xl ${isAndroidApp ? 'p-3' : 'p-5'}`}>
      {/* Header & Controls */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-black tracking-wider text-slate-400 uppercase">
              Power Duration Curve
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FC5200]/20 text-[#FC5200] border border-[#FC5200]/30">
              MMP & Best Efforts
            </span>
            {data.simulated && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30">
                Simulated demo data
              </span>
            )}
          </div>
          <h3 className="text-sm sm:text-base font-bold text-white mt-0.5">
            Mean Maximal Power across Critical Durations
          </h3>
        </div>

        {/* Toggle Switches (Desktop / Web only in header) */}
        {!isAndroidApp && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Watts vs W/kg */}
            <div className="flex items-center bg-[#2F3037] p-1 rounded-xl border border-[#383941]">
              <button
                onClick={() => setMetric('watts')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  activeMetric === 'watts'
                    ? 'bg-[#FC5200] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Watts (W)
              </button>
              <button
                onClick={() => setMetric('wkg')}
                disabled={!hasWkg}
                title={hasWkg ? undefined : 'Add your weight on Intervals.icu to see W/kg'}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  activeMetric === 'wkg'
                    ? 'bg-[#FC5200] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                } ${hasWkg ? '' : 'opacity-40 cursor-not-allowed hover:text-slate-400'}`}
              >
                W/kg
              </button>
            </div>

            {/* Recent vs Season */}
            <div className="flex items-center bg-[#2F3037] p-1 rounded-xl border border-[#383941]">
              <button
                onClick={() => setMode('recent')}
                disabled={!hasRecent}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  activeMode === 'recent'
                    ? 'bg-[#3E4049] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                } ${hasRecent ? '' : 'opacity-40 cursor-not-allowed hover:text-slate-400'}`}
              >
                {recentLabel}
              </button>
              <button
                onClick={() => setMode('season')}
                disabled={!hasSeason}
                title={hasSeason ? undefined : 'Intervals.icu returned no season curve'}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  activeMode === 'season'
                    ? 'bg-[#3E4049] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                } ${hasSeason ? '' : 'opacity-40 cursor-not-allowed hover:text-slate-400'}`}
              >
                {seasonLabel}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Benchmark Summary Pills (Desktop / Web only in header) */}
      {!isAndroidApp && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-5">
          {BENCHMARKS.map((benchmark, index) => {
            const reading = readings[index];
            return (
              <div
                key={benchmark.secs}
                className={`bg-[#26272D] p-3 rounded-xl border border-white/5 ${
                  index === BENCHMARKS.length - 1 ? 'col-span-2 sm:col-span-1' : ''
                }`}
              >
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {benchmark.title}
                </span>
                <span className="text-lg font-black text-white mt-0.5 block">
                  {reading ? (
                    <>
                      {reading.interpolated ? '~' : ''}
                      {reading.watts} <span className="text-xs font-semibold text-slate-400">W</span>
                    </>
                  ) : (
                    '--'
                  )}
                </span>
                <span className="text-[11px] font-semibold" style={{ color: benchmark.color }}>
                  {reading && reading.wkg !== null
                    ? `${reading.interpolated ? '~' : ''}${reading.wkg.toFixed(1)} W/kg`
                    : '--'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Critical power model (Desktop / Web only in header) */}
      {!isAndroidApp && (
        <div className="bg-[#26272D] p-3.5 rounded-xl border border-white/5 mb-5">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Critical Power Model
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#A855F7]/20 text-[#A855F7] border border-[#A855F7]/30">
                Estimates
              </span>
            </div>
            {criticalPower.status === 'ok' && (
              <span className="text-[10px] text-slate-500">
                Fitted on {criticalPower.estimate.durationsSecs.length} durations between 2 and 20 min
                of the {criticalPower.estimate.sourceLabel} curve
              </span>
            )}
          </div>

          {criticalPower.status === 'ok' ? (
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                  CP (estimated)
                </span>
                <span className="text-lg sm:text-xl font-black text-[#00E5A3]">
                  {criticalPower.estimate.cpWatts}{' '}
                  <span className="text-xs font-semibold text-slate-400">W</span>
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                  W&prime; (estimated)
                </span>
                <span className="text-lg sm:text-xl font-black text-[#A855F7]">
                  {(criticalPower.estimate.wPrimeJoules / 1000).toFixed(1)}{' '}
                  <span className="text-xs font-semibold text-slate-400">kJ</span>
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                  FTP (profile)
                </span>
                <span className="text-lg sm:text-xl font-black text-white">
                  {ftp !== null ? (
                    <>
                      {ftp} <span className="text-xs font-semibold text-slate-400">W</span>
                    </>
                  ) : (
                    '--'
                  )}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">{CP_UNAVAILABLE_TEXT[criticalPower.reason]}</p>
          )}

          <p className="mt-2 text-[11px] text-slate-500">
            Two-parameter critical power model (P = CP + W&prime;/t), fitted on your Intervals.icu
            curve. These are estimates: they do not replace the FTP on your profile.
          </p>
        </div>
      )}

      {/* Chart Canvas */}
      <div className={`w-full ${isAndroidApp ? 'h-[250px]' : 'h-[280px]'}`}>
        {hasChartData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartRows}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="powerOrange" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FC5200" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#FC5200" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="seasonCyan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#383941" vertical={false} />

              <XAxis
                dataKey="secs"
                type="number"
                scale="log"
                domain={xDomain}
                ticks={xTicks}
                tickFormatter={formatDurationLabel}
                allowDataOverflow
                stroke="#64748B"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#383941' }}
              />
              <YAxis
                stroke="#64748B"
                tick={{ fill: '#94A3B8', fontSize: 10 }}
                width={36}
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#383941' }}
                unit={activeMetric === 'watts' ? 'W' : ''}
              />

              {/* Reference FTP line */}
              {ftpReference !== null && (
                <ReferenceLine
                  y={ftpReference}
                  stroke="#00E5A3"
                  strokeDasharray="4 4"
                  label={{
                    value: `FTP ${activeMetric === 'watts' ? `${ftp}W` : `${ftpReference.toFixed(1)} W/kg`}`,
                    fill: '#00E5A3',
                    fontSize: 10,
                    position: 'right',
                  }}
                />
              )}

              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const row = payload[0].payload as ChartRow;
                  return (
                    <div className="bg-[#2F3037] border border-[#383941] p-3 rounded-xl shadow-2xl text-xs">
                      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-1.5 mb-1.5">
                        <strong className="text-white text-sm">
                          {formatDurationLabel(row.secs)} Effort
                        </strong>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                          {durationBand(row.secs)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {row.recentVal !== null && (
                          <div className="flex justify-between gap-4 text-[#FC5200]">
                            <span>{recentLabel}:</span>
                            <strong className="text-white">
                              {formatValue(row.recentVal)} {unitLabel}
                            </strong>
                          </div>
                        )}
                        {row.seasonVal !== null && (
                          <div className="flex justify-between gap-4 text-[#38BDF8]">
                            <span>{seasonLabel}:</span>
                            <strong className="text-white">
                              {formatValue(row.seasonVal)} {unitLabel}
                            </strong>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }}
              />

              {activeMode === 'season' && (
                <Area
                  type="monotone"
                  dataKey="seasonVal"
                  stroke="#38BDF8"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fill="url(#seasonCyan)"
                  name={seasonLabel}
                  dot={false}
                  connectNulls
                />
              )}

              {hasRecent && (
                <Area
                  type="monotone"
                  dataKey="recentVal"
                  stroke="#FC5200"
                  strokeWidth={3}
                  fill="url(#powerOrange)"
                  name={recentLabel}
                  dot={false}
                  connectNulls
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-center gap-2 bg-[#26272D] rounded-xl border border-[#383941] px-6">
            <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />
            <span className="text-sm font-bold text-white">Power curve not available</span>
            <span className="text-xs text-slate-400 max-w-md">{emptyMessage}</span>
          </div>
        )}
      </div>

      {/* Android Controls & Compact Stats Below Chart */}
      {isAndroidApp ? (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-2.5">
          {/* Controls: Metric Switcher & Mode Selector */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center bg-[#2F3037] p-0.5 rounded-xl border border-[#383941]">
              <button
                onClick={() => setMetric('watts')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  activeMetric === 'watts'
                    ? 'bg-[#FC5200] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Watts (W)
              </button>
              <button
                onClick={() => setMetric('wkg')}
                disabled={!hasWkg}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  activeMetric === 'wkg'
                    ? 'bg-[#FC5200] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                } ${hasWkg ? '' : 'opacity-40 cursor-not-allowed'}`}
              >
                W/kg
              </button>
            </div>

            <div className="flex items-center bg-[#2F3037] p-0.5 rounded-xl border border-[#383941]">
              <button
                onClick={() => setMode('recent')}
                disabled={!hasRecent}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  activeMode === 'recent'
                    ? 'bg-[#3E4049] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                } ${hasRecent ? '' : 'opacity-40 cursor-not-allowed'}`}
              >
                {recentLabel}
              </button>
              <button
                onClick={() => setMode('season')}
                disabled={!hasSeason}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  activeMode === 'season'
                    ? 'bg-[#3E4049] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                } ${hasSeason ? '' : 'opacity-40 cursor-not-allowed'}`}
              >
                {seasonLabel}
              </button>
            </div>
          </div>

          {/* Compact Benchmark Pills Below Chart */}
          <div className="grid grid-cols-5 gap-1.5">
            {BENCHMARKS.map((benchmark, index) => {
              const reading = readings[index];
              return (
                <div
                  key={benchmark.secs}
                  className="bg-[#26272D] p-1.5 rounded-xl border border-white/5 text-center"
                >
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">
                    {benchmark.title}
                  </span>
                  <span className="text-xs font-black text-white mt-0.5 block truncate">
                    {reading ? `${reading.watts}W` : '--'}
                  </span>
                  <span className="text-[9px] font-bold block truncate" style={{ color: benchmark.color }}>
                    {reading && reading.wkg !== null ? `${reading.wkg.toFixed(1)}` : '--'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Compact CP & FTP Row */}
          {criticalPower.status === 'ok' && (
            <div className="grid grid-cols-3 gap-2 p-2 bg-[#26272D] rounded-xl border border-white/5 text-center">
              <div>
                <span className="text-[8px] font-bold text-slate-400 uppercase block">CP Model</span>
                <span className="text-sm font-black text-[#00E5A3]">
                  {criticalPower.estimate.cpWatts}W
                </span>
              </div>
              <div>
                <span className="text-[8px] font-bold text-slate-400 uppercase block">W&prime; Energy</span>
                <span className="text-sm font-black text-[#A855F7]">
                  {(criticalPower.estimate.wPrimeJoules / 1000).toFixed(1)}kJ
                </span>
              </div>
              <div>
                <span className="text-[8px] font-bold text-slate-400 uppercase block">FTP Profile</span>
                <span className="text-sm font-black text-white">
                  {ftp !== null ? `${ftp}W` : '--'}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-[#FC5200]" />
            <span>
              Functional Threshold Power:{' '}
              <strong className="text-white">{ftp !== null ? `${ftp} W` : '--'}</strong>
              {ftpWkg !== null ? ` (${ftpWkg.toFixed(1)} W/kg)` : ''}
            </span>
          </div>
          <span className="text-slate-500 text-[11px]">{footerNote}</span>
        </div>
      )}
    </div>
  );
};
