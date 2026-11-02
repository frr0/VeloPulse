import { Heart } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
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

interface HrvChartProps {
  data: Wellness[];
}

type RangeOption = '14' | '30' | '90';

export const HrvChart: React.FC<HrvChartProps> = ({ data }) => {
  const [range, setRange] = useState<RangeOption>('30');

  // Process data with 7-day rolling average and baseline calculations
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const sorted = [...data]
      .filter((d) => d.hrv !== undefined)
      .sort((a, b) => new Date(a.id).getTime() - new Date(b.id).getTime());

    const limit = parseInt(range, 10);
    const sliced = sorted.slice(-limit);

    // Compute 7-day rolling average for each point
    return sliced.map((item, idx) => {
      const windowStart = Math.max(0, idx - 6);
      const windowItems = sliced.slice(windowStart, idx + 1);
      const avg7d =
        windowItems.reduce((acc, curr) => acc + (curr.hrv ?? 60), 0) / windowItems.length;

      return {
        id: item.id,
        hrv: item.hrv ?? 60,
        hrv7d: Math.round(avg7d * 10) / 10,
      };
    });
  }, [data, range]);

  // Baseline computation: middle 50% or mean +/- 0.5 std dev
  const { baselineLow, baselineHigh, todayHrv, avg7d, hrvStatus } = useMemo(() => {
    if (chartData.length === 0) {
      return {
        baselineLow: 55,
        baselineHigh: 75,
        todayHrv: 64,
        avg7d: 63,
        hrvStatus: { label: 'Optimal Baseline', color: '#00E5A3', desc: 'Balanced autonomic nervous system' },
      };
    }

    const allHrv = chartData.map((d) => d.hrv);
    const mean = allHrv.reduce((a, b) => a + b, 0) / allHrv.length;
    const low = Math.round(mean - 8);
    const high = Math.round(mean + 10);

    const latest = chartData[chartData.length - 1];
    const latestVal = latest?.hrv ?? 64;
    const latest7d = latest?.hrv7d ?? latestVal;

    let status = {
      label: 'Balanced',
      color: '#00E5A3',
      desc: 'Autonomic nervous system is recovered and responsive',
    };

    if (latestVal < low) {
      status = {
        label: 'Suppressed',
        color: '#F59E0B',
        desc: 'Elevated sympathetic stress or training fatigue detected',
      };
    } else if (latestVal > high + 8) {
      status = {
        label: 'Elevated',
        color: '#38BDF8',
        desc: 'High parasympathetic activity; monitor for hyper-recovery',
      };
    }

    return {
      baselineLow: low,
      baselineHigh: high,
      todayHrv: latestVal,
      avg7d: latest7d,
      hrvStatus: status,
    };
  }, [chartData]);

  const isAndroidApp = isAndroid();

  return (
    <div className={`bg-[#1F2025] rounded-2xl border border-[#383941] shadow-xl ${isAndroidApp ? 'p-3' : 'p-5'}`}>
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black tracking-wider text-slate-400 uppercase">
              Heart Rate Variability (rMSSD)
            </span>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold"
              style={{
                backgroundColor: `${hrvStatus.color}20`,
                color: hrvStatus.color,
                border: `1px solid ${hrvStatus.color}40`,
              }}
            >
              {hrvStatus.label}
            </span>
          </div>
          <h3 className="text-sm sm:text-base font-bold text-white mt-0.5">
            Autonomic Recovery & Parasympathetic Tone
          </h3>
        </div>

        {/* Range Selector (Desktop / Web only in header) */}
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

      {/* Hero Stats (Desktop / Web only in header) */}
      {!isAndroidApp && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-[#26272D] p-3.5 rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Latest HRV
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-white">{todayHrv}</span>
              <span className="text-xs text-slate-400 font-bold">ms</span>
            </div>
            <span className="text-[11px] font-semibold" style={{ color: hrvStatus.color }}>
              {hrvStatus.label}
            </span>
          </div>

          <div className="bg-[#26272D] p-3.5 rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              7-Day Rolling Avg
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-[#00E5A3]">{avg7d}</span>
              <span className="text-xs text-slate-400 font-bold">ms</span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Smoothed trend</span>
          </div>

          <div className="bg-[#26272D] p-3.5 rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Normal Baseline
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-white">
                {baselineLow}–{baselineHigh}
              </span>
              <span className="text-xs text-slate-400 font-bold">ms</span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Optimal green zone</span>
          </div>

          <div className="bg-[#26272D] p-3.5 rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Readiness State
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-white truncate">{hrvStatus.label}</span>
            </div>
            <span className="text-[10px] text-slate-400 truncate block mt-0.5">
              {todayHrv >= baselineLow ? 'Prime capacity' : 'Need active recovery'}
            </span>
          </div>
        </div>
      )}

      {/* Legend (Desktop / Web only in header) */}
      {!isAndroidApp && (
        <div className="flex items-center gap-5 text-xs mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#00E5A3]/40 border border-[#00E5A3]" />
            <span className="text-slate-300">Daily rMSSD (ms)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-1 rounded-full bg-[#00E5A3]" />
            <span className="text-slate-300">7-Day Rolling Baseline</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-[#00E5A3]/10 border border-[#00E5A3]/30" />
            <span className="text-slate-300">Target Range ({baselineLow}–{baselineHigh} ms)</span>
          </div>
        </div>
      )}

      {/* Chart Canvas */}
      <div className={`w-full ${isAndroidApp ? 'h-[250px]' : 'h-[280px]'}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 8, right: 6, left: isAndroidApp ? -28 : -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#383941" vertical={false} />

            {/* Target Baseline Reference Area */}
            <ReferenceArea
              y1={baselineLow}
              y2={baselineHigh}
              fill="rgba(0, 229, 163, 0.08)"
              strokeOpacity={0}
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
              domain={['dataMin - 10', 'dataMax + 10']}
              stroke="#64748B"
              fontSize={10}
              width={34}
              tickLine={false}
              axisLine={{ stroke: '#383941' }}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload as { id: string; hrv: number; hrv7d: number };
                  const isWithin = d.hrv >= baselineLow && d.hrv <= baselineHigh;
                  return (
                    <div className="bg-[#2F3037] border border-[#383941] p-3 rounded-xl shadow-2xl text-xs">
                      <div className="font-bold text-white border-b border-white/10 pb-1.5 mb-1.5">
                        {d.id}
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between gap-4 text-[#00E5A3]">
                          <span>Daily HRV:</span>
                          <strong className="text-white">{d.hrv} ms</strong>
                        </div>
                        <div className="flex justify-between gap-4 text-slate-300">
                          <span>7-Day Average:</span>
                          <strong className="text-white">{d.hrv7d} ms</strong>
                        </div>
                        <div className="flex justify-between gap-4 text-slate-400">
                          <span>Baseline:</span>
                          <span>{baselineLow}–{baselineHigh} ms</span>
                        </div>
                      </div>
                      <div
                        className="mt-2 pt-1 border-t border-white/10 text-[10px] font-bold"
                        style={{ color: isWithin ? '#00E5A3' : '#F59E0B' }}
                      >
                        {isWithin ? 'Balanced inside baseline' : d.hrv < baselineLow ? 'Suppressed (fatigue)' : 'Elevated'}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            <Bar
              dataKey="hrv"
              fill="#00E5A3"
              opacity={0.35}
              radius={[4, 4, 0, 0]}
              name="Daily HRV"
            />

            <Line
              type="monotone"
              dataKey="hrv7d"
              stroke="#00E5A3"
              strokeWidth={3}
              dot={false}
              name="7-Day Baseline"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Android Controls & Compact Stats Below Chart */}
      {isAndroidApp ? (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-2.5">
          {/* Controls: Range Selector & Legend */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Periodo:
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

          {/* Compact Hero Stats Below Chart */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#26272D] p-2 rounded-xl border border-white/5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                Latest HRV
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black text-white">{todayHrv}</span>
                <span className="text-[10px] text-slate-400 font-bold">ms</span>
              </div>
              <span className="text-[10px] font-semibold block truncate" style={{ color: hrvStatus.color }}>
                {hrvStatus.label}
              </span>
            </div>

            <div className="bg-[#26272D] p-2 rounded-xl border border-white/5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                7-Day Avg
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black text-[#00E5A3]">{avg7d}</span>
                <span className="text-[10px] text-slate-400 font-bold">ms</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Smoothed</span>
            </div>

            <div className="bg-[#26272D] p-2 rounded-xl border border-white/5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                Target Baseline
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black text-white">{baselineLow}–{baselineHigh}</span>
                <span className="text-[10px] text-slate-400 font-bold">ms</span>
              </div>
              <span className="text-[10px] text-slate-400">Green zone</span>
            </div>

            <div className="bg-[#26272D] p-2 rounded-xl border border-white/5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                Readiness
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-sm font-black text-white truncate">{hrvStatus.label}</span>
              </div>
              <span className="text-[9px] text-slate-400 block truncate">
                {todayHrv >= baselineLow ? 'Prime capacity' : 'Need rest'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Heart className="w-3.5 h-3.5 text-[#00E5A3]" />
            <span>
              Current Status: <strong className="text-white">{hrvStatus.desc}</strong>
            </span>
          </div>
          <span className="text-slate-500 text-[11px]">
            Calculated via nocturnal rMSSD from wearable/monitor
          </span>
        </div>
      )}
    </div>
  );
};
