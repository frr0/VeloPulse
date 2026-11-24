import { Activity } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Wellness } from '../../types/intervals';
import { formatDateShort } from '../../utils/formatters';
import { isAndroid } from '../../utils/platform';

interface RestingHrChartProps {
  data: Wellness[];
  defaultRHR?: number | null;
}

type RangeOption = '14' | '30' | '90';

export const RestingHrChart: React.FC<RestingHrChartProps> = ({
  data,
  defaultRHR = null,
}) => {
  const [range, setRange] = useState<RangeOption>('30');

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const sorted = [...data]
      .filter((d) => typeof d.restingHR === 'number' && Number.isFinite(d.restingHR) && d.restingHR > 0)
      .sort((a, b) => new Date(a.id).getTime() - new Date(b.id).getTime());

    const limit = parseInt(range, 10);
    const sliced = sorted.slice(-limit);

    return sliced.map((item, idx) => {
      const windowStart = Math.max(0, idx - 6);
      const windowItems = sliced.slice(windowStart, idx + 1);
      const avg7d =
        windowItems.reduce((acc, curr) => acc + (curr.restingHR as number), 0) /
        windowItems.length;

      return {
        id: item.id,
        restingHR: item.restingHR as number,
        rhr7d: Math.round(avg7d * 10) / 10,
      };
    });
  }, [data, range]);

  const { latestRhr, lowestRhr, avg7d, overallAvg, rhrAlert } = useMemo(() => {
    const profileFallback =
      typeof defaultRHR === 'number' && Number.isFinite(defaultRHR) && defaultRHR > 0
        ? defaultRHR
        : null;

    if (chartData.length === 0) {
      return {
        latestRhr: profileFallback,
        lowestRhr: null as number | null,
        avg7d: null as number | null,
        overallAvg: null as number | null,
        rhrAlert: null as { title: string; message: string; color: string } | null,
      };
    }

    const rhrValues = chartData.map((d) => d.restingHR);
    const min = Math.min(...rhrValues);
    const sum = rhrValues.reduce((a, b) => a + b, 0);
    const mean = Math.round((sum / rhrValues.length) * 10) / 10;

    const latest = chartData[chartData.length - 1];
    const latestVal = latest.restingHR;
    const latest7d = latest.rhr7d;

    let alert = null;
    if (latestVal > latest7d + 3) {
      alert = {
        title: 'Elevated Resting HR',
        message: 'Elevated by +3 bpm or more above 7-day average.',
        color: '#F59E0B',
      };
    } else if (latestVal <= min + 1) {
      alert = {
        title: 'Deep Recovery',
        message: 'Near period low. Cardiovascular efficiency is primed.',
        color: '#00E5A3',
      };
    }

    return {
      latestRhr: latestVal,
      lowestRhr: min,
      avg7d: latest7d,
      overallAvg: mean,
      rhrAlert: alert,
    };
  }, [chartData, defaultRHR]);

  const isAndroidApp = isAndroid();

  return (
    <div className={`bg-[#1F2025] rounded-2xl border border-[#383941] shadow-xl ${isAndroidApp ? 'p-3' : 'p-5'}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black tracking-wider text-slate-400 uppercase">
              Cardiovascular Efficiency
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#00B4D8]/20 text-[#00B4D8] border border-[#00B4D8]/30">
              Resting Heart Rate
            </span>
          </div>
          <h3 className="text-sm sm:text-base font-bold text-white mt-0.5">
            Daily Resting Pulse & 7-Day Baseline Trend
          </h3>
        </div>

        {/* Range Selector (hidden on Android header, placed below) */}
        {!isAndroidApp && (
          <div className="flex items-center bg-[#2F3037] p-1 rounded-xl border border-[#383941]">
            {(['14', '30', '90'] as RangeOption[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  range === r
                    ? 'bg-[#3E4049] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {r}D
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hero Stats (hidden on Android header, placed below) */}
      {!isAndroidApp && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-[#26272D] p-3.5 rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Latest Pulse
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-white">
                {latestRhr !== null ? latestRhr : '--'}
              </span>
              {latestRhr !== null && <span className="text-xs text-slate-400 font-bold">bpm</span>}
            </div>
            <span className="text-[11px] text-[#00B4D8] font-semibold">
              {chartData.length > 0 ? 'Morning waking pulse' : latestRhr !== null ? 'Profile value' : 'No data'}
            </span>
          </div>

          <div className="bg-[#26272D] p-3.5 rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              7-Day Rolling Avg
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-[#00B4D8]">
                {avg7d !== null ? avg7d : '--'}
              </span>
              {avg7d !== null && <span className="text-xs text-slate-400 font-bold">bpm</span>}
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Smoothed baseline</span>
          </div>

          <div className="bg-[#26272D] p-3.5 rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Lowest Recorded
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-[#00E5A3]">
                {lowestRhr !== null ? lowestRhr : '--'}
              </span>
              {lowestRhr !== null && <span className="text-xs text-slate-400 font-bold">bpm</span>}
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Period minimum</span>
          </div>

          <div className="bg-[#26272D] p-3.5 rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Period Average
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-white">
                {overallAvg !== null ? overallAvg : '--'}
              </span>
              {overallAvg !== null && <span className="text-xs text-slate-400 font-bold">bpm</span>}
            </div>
            <span className="text-[11px] text-slate-400 font-medium">{range}-day mean</span>
          </div>
        </div>
      )}

      {/* Chart Canvas */}
      <div className={`w-full ${isAndroidApp ? 'h-[250px]' : 'h-[280px]'}`}>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="rhrCyan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00B4D8" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#00B4D8" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#383941" vertical={false} />

              {/* Optimal Range Reference Band (lowest to lowest+6) */}
              {lowestRhr !== null && (
                <ReferenceArea
                  y1={lowestRhr}
                  y2={lowestRhr + 6}
                  fill="rgba(0, 180, 216, 0.08)"
                  strokeOpacity={0}
                />
              )}

              <XAxis
                dataKey="id"
                tickFormatter={(v) => formatDateShort(v)}
                stroke="#64748B"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#383941' }}
              />
              <YAxis
                domain={['dataMin - 5', 'dataMax + 5']}
                stroke="#64748B"
                tick={{ fill: '#94A3B8', fontSize: 10 }}
                fontSize={10}
                width={32}
                tickLine={false}
                axisLine={{ stroke: '#383941' }}
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload as { id: string; restingHR: number; rhr7d: number };
                    return (
                      <div className="bg-[#2F3037] border border-[#383941] p-3 rounded-xl shadow-2xl text-xs">
                        <div className="font-bold text-white border-b border-white/10 pb-1.5 mb-1.5">
                          {d.id}
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between gap-4 text-[#00B4D8]">
                            <span>Resting HR:</span>
                            <strong className="text-white">{d.restingHR} bpm</strong>
                          </div>
                          <div className="flex justify-between gap-4 text-slate-300">
                            <span>7-Day Average:</span>
                            <strong className="text-white">{d.rhr7d} bpm</strong>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Area
                type="monotone"
                dataKey="restingHR"
                stroke="#00B4D8"
                strokeWidth={2.5}
                fill="url(#rhrCyan)"
                name="Resting HR"
              />

              <Line
                type="monotone"
                dataKey="rhr7d"
                stroke="#38BDF8"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                name="7-Day Avg"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-center gap-1.5 bg-[#26272D] rounded-xl border border-[#383941] px-6">
            <Activity className="w-5 h-5 text-slate-500" />
            <span className="text-sm font-bold text-white">No Resting HR data available</span>
            <span className="text-xs text-slate-400 max-w-md">
              No daily Resting HR values were found in your synced wellness history.
            </span>
          </div>
        )}
      </div>

      {/* Android Controls & Compact Stats Below Chart */}
      {isAndroidApp ? (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Range:
            </span>
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
            <div className="bg-[#26272D] p-2 rounded-xl border border-white/5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                Latest Pulse
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black text-white">
                  {latestRhr !== null ? latestRhr : '--'}
                </span>
                {latestRhr !== null && <span className="text-[10px] text-slate-400 font-bold">bpm</span>}
              </div>
              <span className="text-[10px] text-[#00B4D8] font-semibold">Morning</span>
            </div>

            <div className="bg-[#26272D] p-2 rounded-xl border border-white/5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                7-Day Avg
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black text-[#00B4D8]">
                  {avg7d !== null ? avg7d : '--'}
                </span>
                {avg7d !== null && <span className="text-[10px] text-slate-400 font-bold">bpm</span>}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Smoothed</span>
            </div>

            <div className="bg-[#26272D] p-2 rounded-xl border border-white/5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                Lowest
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black text-[#00E5A3]">
                  {lowestRhr !== null ? lowestRhr : '--'}
                </span>
                {lowestRhr !== null && <span className="text-[10px] text-slate-400 font-bold">bpm</span>}
              </div>
              <span className="text-[10px] text-slate-400">Minimum</span>
            </div>

            <div className="bg-[#26272D] p-2 rounded-xl border border-white/5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                Period Mean
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black text-white">
                  {overallAvg !== null ? overallAvg : '--'}
                </span>
                {overallAvg !== null && <span className="text-[10px] text-slate-400 font-bold">bpm</span>}
              </div>
              <span className="text-[10px] text-slate-400">{range}d Avg</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-[#00B4D8]" />
            <span>
              {rhrAlert ? (
                <strong style={{ color: rhrAlert.color }}>
                  {rhrAlert.title}: {rhrAlert.message}
                </strong>
              ) : lowestRhr !== null ? (
                <span>
                  Resting pulse is steady within range ({lowestRhr}–{lowestRhr + 6} bpm)
                </span>
              ) : (
                <span>No daily Resting HR data recorded</span>
              )}
            </span>
          </div>
          <span className="text-slate-500 text-[11px]">
            Recorded Resting HR values from your wellness log
          </span>
        </div>
      )}
    </div>
  );
};
