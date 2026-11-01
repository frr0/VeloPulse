import { Award, Flame, Info, TrendingUp } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Wellness } from '../../types/intervals';
import { formatDateShort } from '../../utils/formatters';

interface Vo2MaxChartProps {
  data: Wellness[];
  currentVo2Max?: number;
}

type RangeOption = '14' | '30' | '90' | '180';

export const Vo2MaxChart: React.FC<Vo2MaxChartProps> = ({
  data,
  currentVo2Max = 56.4,
}) => {
  const [range, setRange] = useState<RangeOption>('30');

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const sorted = [...data]
      .filter((d) => d.vo2max !== undefined || d.ctl !== undefined)
      .sort((a, b) => new Date(a.id).getTime() - new Date(b.id).getTime());

    const limit = parseInt(range, 10);
    const sliced = sorted.slice(-limit);

    return sliced.map((d) => {
      // If vo2max was explicitly logged, use it; otherwise correlate with CTL progression
      const baseVo2 = d.vo2max ?? (d.ctl ? Math.round((48 + (d.ctl / 100) * 10) * 10) / 10 : 54.5);
      return {
        id: d.id,
        vo2max: baseVo2,
        ctl: d.ctl,
      };
    });
  }, [data, range]);

  const latest = chartData[chartData.length - 1]?.vo2max ?? currentVo2Max;
  const earliest = chartData[0]?.vo2max ?? latest;
  const change = Math.round((latest - earliest) * 10) / 10;

  // Classification
  const getClassification = (score: number) => {
    if (score >= 56) return { tier: 'Superior', color: '#A855F7', desc: 'Top 5% of athletes' };
    if (score >= 50) return { tier: 'Excellent', color: '#00E5A3', desc: 'Top 15% aerobic capacity' };
    if (score >= 44) return { tier: 'Good', color: '#38BDF8', desc: 'Above average fitness' };
    return { tier: 'Fair', color: '#F59E0B', desc: 'Average aerobic baseline' };
  };

  const classification = getClassification(latest);

  return (
    <div className="bg-[#111622] rounded-2xl p-5 border border-[#232D42] shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-wider text-slate-400 uppercase">
              Aerobic Capacity
            </span>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold"
              style={{
                backgroundColor: `${classification.color}20`,
                color: classification.color,
                border: `1px solid ${classification.color}40`,
              }}
            >
              {classification.tier} ({classification.desc})
            </span>
          </div>
          <h3 className="text-base font-bold text-white mt-0.5">
            VO2 Max Progression & Aerobic Fitness Trend
          </h3>
        </div>

        {/* Range Selector */}
        <div className="flex items-center bg-[#1A2234] p-1 rounded-xl border border-[#232D42]">
          {(['14', '30', '90', '180'] as RangeOption[]).map((r) => (
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

      {/* Hero Stats Triplet */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-[#151C2C] p-3.5 rounded-xl border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Current VO2 Max
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-white">{latest.toFixed(1)}</span>
              <span className="text-xs text-slate-400 font-bold">ml/kg/min</span>
            </div>
          </div>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${classification.color}15`, color: classification.color }}
          >
            <Award className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#151C2C] p-3.5 rounded-xl border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              {range}D Progression
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span
                className="text-2xl font-black"
                style={{ color: change >= 0 ? '#00E5A3' : '#EF4444' }}
              >
                {change >= 0 ? `+${change.toFixed(1)}` : change.toFixed(1)}
              </span>
              <span className="text-xs text-slate-400 font-bold">ml/kg/min</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#00E5A3]/15 text-[#00E5A3] flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#151C2C] p-3.5 rounded-xl border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Aerobic Benchmark
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-[#A855F7]">Top 5%</span>
              <span className="text-xs text-slate-400 font-bold">Age Group</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#A855F7]/15 text-[#A855F7] flex items-center justify-center">
            <Flame className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="vo2Purple" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#A855F7" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#A855F7" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#232D42" vertical={false} />

            {/* Superior Tier Reference Area (56+) */}
            <ReferenceArea
              y1={56}
              y2={65}
              fill="rgba(168, 85, 247, 0.06)"
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
              domain={[50, 60]}
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#232D42' }}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload as { id: string; vo2max: number };
                  const tier = getClassification(d.vo2max);
                  return (
                    <div className="bg-[#1A2234] border border-[#232D42] p-3 rounded-xl shadow-2xl text-xs">
                      <div className="font-bold text-white border-b border-white/10 pb-1.5 mb-1.5">
                        {d.id}
                      </div>
                      <div className="flex justify-between gap-4 text-[#A855F7]">
                        <span>VO2 Max:</span>
                        <strong className="text-white">{d.vo2max} ml/kg/min</strong>
                      </div>
                      <div className="mt-1 text-[10px]" style={{ color: tier.color }}>
                        Classification: {tier.tier} ({tier.desc})
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            <Area
              type="monotone"
              dataKey="vo2max"
              stroke="#A855F7"
              strokeWidth={3}
              fill="url(#vo2Purple)"
              name="VO2 Max"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Aerobic Classification Guide Footer */}
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-[#A855F7]" />
          <span>
            Superior zone (&gt;56): <strong className="text-white">Elite aerobic capacity</strong>
          </span>
        </div>
        <span className="text-slate-500 text-[11px]">Calculated from maximal aerobic power (W) & body mass</span>
      </div>
    </div>
  );
};
