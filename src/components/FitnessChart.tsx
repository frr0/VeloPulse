import React, { useMemo, useState } from 'react';
import {
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Wellness } from '../types/intervals';
import { formatDateShort, getFormStatus } from '../utils/formatters';

interface FitnessChartProps {
  data: Wellness[];
}

type RangeOption = '14' | '30' | '90' | '180' | 'ALL';

export const FitnessChart: React.FC<FitnessChartProps> = ({ data }) => {
  const [range, setRange] = useState<RangeOption>('30');
  const [showCtl, setShowCtl] = useState(true);
  const [showAtl, setShowAtl] = useState(true);
  const [showTsb, setShowTsb] = useState(true);

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const sorted = [...data].sort(
      (a, b) => new Date(a.id).getTime() - new Date(b.id).getTime()
    );

    if (range === 'ALL') return sorted;
    const limit = parseInt(range, 10);
    return sorted.slice(-limit);
  }, [data, range]);

  const latest = chartData[chartData.length - 1];
  const latestTsb = latest?.tsb ?? (latest?.ctl && latest?.atl ? latest.ctl - latest.atl : 0);
  const formStatus = getFormStatus(latestTsb);

  return (
    <div className="bg-[#111622] rounded-2xl p-5 border border-[#232D42] shadow-xl">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-wider text-slate-400 uppercase">
              Fitness & Form
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: formStatus.badgeBg, color: formStatus.color }}>
              {formStatus.label}
            </span>
          </div>
          <h3 className="text-base font-bold text-white mt-0.5">
            Chronic Training Load (CTL) vs Acute Fatigue (ATL)
          </h3>
        </div>

        {/* Range Selector */}
        <div className="flex items-center bg-[#1A2234] p-1 rounded-xl self-start sm:self-auto border border-[#232D42]">
          {(['14', '30', '90', '180', 'ALL'] as RangeOption[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                range === r
                  ? 'bg-[#26334D] text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {r === 'ALL' ? 'ALL' : `${r}D`}
            </button>
          ))}
        </div>
      </div>

      {/* Legend & Toggle Controls */}
      <div className="flex items-center gap-4 sm:gap-6 text-xs mb-3 flex-wrap">
        <button
          onClick={() => setShowCtl(!showCtl)}
          className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border transition-all ${
            showCtl
              ? 'border-[#38BDF8]/40 bg-[#38BDF8]/10 text-white'
              : 'border-transparent text-slate-500 opacity-60'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8]" />
          <span className="font-semibold">Fitness (CTL)</span>
          {latest?.ctl !== undefined && (
            <span className="text-slate-400 font-bold ml-1">{Math.round(latest.ctl)}</span>
          )}
        </button>

        <button
          onClick={() => setShowAtl(!showAtl)}
          className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border transition-all ${
            showAtl
              ? 'border-[#A855F7]/40 bg-[#A855F7]/10 text-white'
              : 'border-transparent text-slate-500 opacity-60'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-[#A855F7]" />
          <span className="font-semibold">Fatigue (ATL)</span>
          {latest?.atl !== undefined && (
            <span className="text-slate-400 font-bold ml-1">{Math.round(latest.atl)}</span>
          )}
        </button>

        <button
          onClick={() => setShowTsb(!showTsb)}
          className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border transition-all ${
            showTsb
              ? 'border-[#00E5A3]/40 bg-[#00E5A3]/10 text-white'
              : 'border-transparent text-slate-500 opacity-60'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-[#00E5A3]" />
          <span className="font-semibold">Form (TSB)</span>
          {latestTsb !== undefined && (
            <span className="font-bold ml-1" style={{ color: formStatus.color }}>
              {latestTsb > 0 ? `+${Math.round(latestTsb)}` : Math.round(latestTsb)}
            </span>
          )}
        </button>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            {/* Zero Form baseline */}
            <ReferenceLine y={0} stroke="rgba(255, 255, 255, 0.25)" strokeDasharray="3 3" />

            {/* Optimal training zone shading (-30 to -10) */}
            <ReferenceArea
              y1={-30}
              y2={-10}
              fill="rgba(56, 189, 248, 0.05)"
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
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#232D42' }}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload as Wellness;
                  const itemTsb = d.tsb ?? (d.ctl && d.atl ? d.ctl - d.atl : 0);
                  const st = getFormStatus(itemTsb);
                  return (
                    <div className="bg-[#1A2234] border border-[#232D42] p-3 rounded-xl shadow-2xl text-xs">
                      <div className="font-bold text-white border-b border-white/10 pb-1.5 mb-1.5">
                        {d.id}
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between gap-4 text-[#38BDF8]">
                          <span>Fitness (CTL):</span>
                          <strong className="text-white">{d.ctl ?? '--'}</strong>
                        </div>
                        <div className="flex justify-between gap-4 text-[#A855F7]">
                          <span>Fatigue (ATL):</span>
                          <strong className="text-white">{d.atl ?? '--'}</strong>
                        </div>
                        <div className="flex justify-between gap-4 text-[#00E5A3]">
                          <span>Form (TSB):</span>
                          <strong style={{ color: st.color }}>
                            {itemTsb > 0 ? `+${itemTsb}` : itemTsb}
                          </strong>
                        </div>
                        {d.hrv ? (
                          <div className="flex justify-between gap-4 text-slate-400">
                            <span>HRV:</span>
                            <strong className="text-white">{d.hrv} ms</strong>
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-2 pt-1 border-t border-white/10 text-[10px]" style={{ color: st.color }}>
                        {st.label} — {st.description}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            {showCtl && (
              <Line
                type="monotone"
                dataKey="ctl"
                stroke="#38BDF8"
                strokeWidth={2.5}
                dot={false}
                name="Fitness (CTL)"
              />
            )}

            {showAtl && (
              <Line
                type="monotone"
                dataKey="atl"
                stroke="#A855F7"
                strokeWidth={2}
                dot={false}
                name="Fatigue (ATL)"
              />
            )}

            {showTsb && (
              <Line
                type="monotone"
                dataKey="tsb"
                stroke="#00E5A3"
                strokeWidth={2}
                dot={false}
                name="Form (TSB)"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Form Interpretation Guide Footer */}
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: formStatus.color }} />
          <span>Current Zone: <strong className="text-white">{formStatus.label}</strong> ({formStatus.description})</span>
        </div>
        <span className="text-slate-500 text-[11px]">Hover or tap on points for daily breakdown</span>
      </div>
    </div>
  );
};
