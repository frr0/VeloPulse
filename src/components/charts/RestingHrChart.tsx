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

interface RestingHrChartProps {
  data: Wellness[];
  defaultRHR?: number;
}

type RangeOption = '14' | '30' | '90';

export const RestingHrChart: React.FC<RestingHrChartProps> = ({
  data,
  defaultRHR = 46,
}) => {
  const [range, setRange] = useState<RangeOption>('30');

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const sorted = [...data]
      .filter((d) => d.restingHR !== undefined)
      .sort((a, b) => new Date(a.id).getTime() - new Date(b.id).getTime());

    const limit = parseInt(range, 10);
    const sliced = sorted.slice(-limit);

    return sliced.map((item, idx) => {
      const windowStart = Math.max(0, idx - 6);
      const windowItems = sliced.slice(windowStart, idx + 1);
      const avg7d =
        windowItems.reduce((acc, curr) => acc + (curr.restingHR ?? 46), 0) / windowItems.length;

      return {
        id: item.id,
        restingHR: item.restingHR ?? defaultRHR,
        rhr7d: Math.round(avg7d * 10) / 10,
      };
    });
  }, [data, range, defaultRHR]);

  const { latestRhr, lowestRhr, avg7d, overallAvg, rhrAlert } = useMemo(() => {
    if (chartData.length === 0) {
      return {
        latestRhr: defaultRHR,
        lowestRhr: defaultRHR - 3,
        avg7d: defaultRHR,
        overallAvg: defaultRHR,
        rhrAlert: null,
      };
    }

    const rhrValues = chartData.map((d) => d.restingHR);
    const min = Math.min(...rhrValues);
    const sum = rhrValues.reduce((a, b) => a + b, 0);
    const mean = Math.round((sum / rhrValues.length) * 10) / 10;

    const latest = chartData[chartData.length - 1];
    const latestVal = latest?.restingHR ?? defaultRHR;
    const latest7d = latest?.rhr7d ?? latestVal;

    let alert = null;
    if (latestVal > latest7d + 3) {
      alert = {
        title: 'Elevated Resting HR',
        message: 'Elevated by +3-5 bpm. Indicates acute fatigue, heat strain, or immune response.',
        color: '#F59E0B',
      };
    } else if (latestVal <= min + 1) {
      alert = {
        title: 'Deep Recovery',
        message: 'Near all-time low. Cardiovascular efficiency is primed for performance.',
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

  return (
    <div className="bg-[#111622] rounded-2xl p-5 border border-[#232D42] shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-wider text-slate-400 uppercase">
              Cardiovascular Efficiency
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#00B4D8]/20 text-[#00B4D8] border border-[#00B4D8]/30">
              Resting Heart Rate
            </span>
          </div>
          <h3 className="text-base font-bold text-white mt-0.5">
            Daily Resting Pulse & 7-Day Baseline Trend
          </h3>
        </div>

        {/* Range Selector */}
        <div className="flex items-center bg-[#1A2234] p-1 rounded-xl border border-[#232D42]">
          {(['14', '30', '90'] as RangeOption[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                range === r
                  ? 'bg-[#26334D] text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {r}D
            </button>
          ))}
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-[#151C2C] p-3.5 rounded-xl border border-white/5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Latest Pulse
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-2xl font-black text-white">{latestRhr}</span>
            <span className="text-xs text-slate-400 font-bold">bpm</span>
          </div>
          <span className="text-[11px] text-[#00B4D8] font-semibold">Morning waking pulse</span>
        </div>

        <div className="bg-[#151C2C] p-3.5 rounded-xl border border-white/5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            7-Day Rolling Avg
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-2xl font-black text-[#00B4D8]">{avg7d}</span>
            <span className="text-xs text-slate-400 font-bold">bpm</span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Smoothed baseline</span>
        </div>

        <div className="bg-[#151C2C] p-3.5 rounded-xl border border-white/5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Lowest Recorded
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-2xl font-black text-[#00E5A3]">{lowestRhr}</span>
            <span className="text-xs text-slate-400 font-bold">bpm</span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Peak adaptation</span>
        </div>

        <div className="bg-[#151C2C] p-3.5 rounded-xl border border-white/5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Period Average
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-2xl font-black text-white">{overallAvg}</span>
            <span className="text-xs text-slate-400 font-bold">bpm</span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">{range}-day mean</span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="rhrCyan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00B4D8" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#00B4D8" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#232D42" vertical={false} />

            {/* Optimal Range Reference Band (lowest to lowest+6) */}
            <ReferenceArea
              y1={lowestRhr}
              y2={lowestRhr + 6}
              fill="rgba(0, 180, 216, 0.08)"
              strokeOpacity={0}
            />

            <XAxis
              dataKey="id"
              tickFormatter={(v) => formatDateShort(v)}
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#232D42' }}
            />
            <YAxis
              domain={['dataMin - 3', 'dataMax + 4']}
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#232D42' }}
              unit=" bpm"
            />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload as { id: string; restingHR: number; rhr7d: number };
                  return (
                    <div className="bg-[#1A2234] border border-[#232D42] p-3 rounded-xl shadow-2xl text-xs">
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
      </div>

      {/* Footer Insight */}
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-[#00B4D8]" />
          <span>
            {rhrAlert ? (
              <strong style={{ color: rhrAlert.color }}>
                {rhrAlert.title}: {rhrAlert.message}
              </strong>
            ) : (
              <span>Resting pulse is steady within optimal baseline range ({lowestRhr}–{lowestRhr + 6} bpm)</span>
            )}
          </span>
        </div>
        <span className="text-slate-500 text-[11px]">Lower values correlate with aerobic adaptation</span>
      </div>
    </div>
  );
};
